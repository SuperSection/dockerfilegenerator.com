#!/usr/bin/env node
/**
 * sync-registry.mjs
 *
 * Reads every seed in src/registry/seeds/, fetches tag data from the
 * configured providers, applies static overrides, and writes:
 *   - src/registry/data.ts         (runtime registry, committed)
 *   - src/registry/data.meta.ts    (lastSync timestamp)
 *   - registry.lock.json           (debug snapshot, committed)
 *
 * Designed for two execution contexts:
 *   1. Local: `npm run sync:registry` (Node 22+ with --experimental-strip-types)
 *   2. CI:    GitHub Action on weekly cron + manual dispatch
 *
 * Provider order is significant: static wins last.
 */

import { readdir, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SEEDS_DIR = path.join(ROOT, "src/registry/seeds");

// Helper: import a TS file as ESM under --experimental-strip-types.
// We rewrite `.ts` → `.ts` (Node already strips it), and let the
// custom resolution hook below handle missing extensions.
const importTs = async (relPath) => {
  return import(path.join(ROOT, relPath));
};

// ── Provider registry ──────────────────────────────────────────
const PROVIDERS = [];
try {
  const m = await importTs("src/registry/providers/dockerhub.ts");
  PROVIDERS.push(m.dockerHubProvider);
} catch (e) {
  console.warn("[sync] dockerhub provider not available:", e?.message);
}
try {
  const m = await importTs("src/registry/providers/github-release.ts");
  PROVIDERS.push(m.githubReleaseProvider);
} catch (e) {
  console.warn("[sync] github provider not available:", e?.message);
}
try {
  const m = await importTs("src/registry/providers/static.ts");
  PROVIDERS.push(m.staticProvider);
  // Static OVERRIDES map is consulted separately at apply time.
  globalThis.__STATIC_OVERRIDES__ = m.OVERRIDES;
} catch (e) {
  console.error("[sync] static provider missing — aborting", e);
  process.exit(1);
}

// ── Helpers ────────────────────────────────────────────────────

/** Strip a leading `v` and split into [major, minor, patch]. */
const parseSemver = (tag) => {
  const m = tag.replace(/^v/, "").match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
};

/** A tag counts as a stable release candidate iff it's a clean semver. */
const isStableTag = (tag) => {
  if (/-?(rc|alpha|beta|preview|dev|nightly|edge|main)/i.test(tag)) return false;
  if (/[+].*build/i.test(tag)) return false;
  return parseSemver(tag) !== null;
};

/** Compare two semver tags, returns positive if a > b. */
const cmpSemver = (a, b) => {
  const av = parseSemver(a.tag) ?? parseSemver(a.tag.replace(/-.*$/, ""));
  const bv = parseSemver(b.tag) ?? parseSemver(b.tag.replace(/-.*$/, ""));
  if (!av || !bv) return 0;
  for (let i = 0; i < 3; i++) {
    if (av[i] !== bv[i]) return av[i] - bv[i];
  }
  return 0;
};

const pickLatestStable = (tags) => {
  const stables = tags.filter((t) => isStableTag(t.tag));
  if (!stables.length) return null;
  stables.sort(cmpSemver);
  return stables[stables.length - 1] ?? null;
};

const isFloating = (tag) =>
  ["latest", "stable", "nightly", "lts", "edge"].includes(tag) ||
  /-(alpine|slim|bookworm|bullseye|jammy|noble)$/i.test(tag);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Mapping from Docker image name → GitHub {owner}/{repo}.
 * Only images whose GitHub repo differs from their Docker image name
 * need an entry here. Images not listed are skipped by the GitHub
 * provider (it can't resolve them).
 */
const GITHUB_REPO_MAP = {
  "jaegertracing/all-in-one": "jaegertracing/jaeger",
  "prom/prometheus": "prometheus/prometheus",
  "grafana/promtail": "grafana/loki",
  "otel/opentelemetry-collector-contrib": "open-telemetry/opentelemetry-collector-contrib",
};

// ── Load all seeds ─────────────────────────────────────────────

const loadSeeds = async () => {
  if (!existsSync(SEEDS_DIR)) {
    throw new Error(`Seeds directory not found: ${SEEDS_DIR}`);
  }
  const files = (await readdir(SEEDS_DIR)).filter((f) => f.endsWith(".ts"));
  const seeds = [];
  for (const f of files) {
    const mod = await importTs(`src/registry/seeds/${f}`);
    if (!mod.seed) {
      console.warn(`[sync] ${f}: no exported "seed" — skipping`);
      continue;
    }
    seeds.push(mod.seed);
  }
  return seeds;
};

// ── Build the registry ─────────────────────────────────────────

const buildRegistry = async (seeds) => {
  const registry = {};
  const lockEntries = [];
  const overrides = globalThis.__STATIC_OVERRIDES__ ?? {};

  for (const seed of seeds) {
    let tags = [];
    let latestStable = null;
    const providerResults = {};

    if (seed.versionSource === "sync") {
      // Try each provider in turn. First non-empty result wins, but
      // we still aggregate in `providerResults` for the lock file.
      for (const provider of PROVIDERS) {
        if (provider.id === "static") continue;

        // Skip GitHub provider for images that don't map to a GitHub repo
        if (provider.id === "github") {
          const ghRepo = GITHUB_REPO_MAP[seed.image];
          if (!ghRepo) {
            providerResults[provider.id] = { count: 0, ok: true, skipped: "no github repo mapping" };
            await sleep(100);
            continue;
          }
        }

        try {
          const fetchImage = provider.id === "github"
            ? (GITHUB_REPO_MAP[seed.image] ?? seed.image)
            : seed.image;
          const t = await provider.fetchTags(fetchImage);
          providerResults[provider.id] = { count: t.length, ok: true };
          if (t.length && !tags.length) tags = [...t];
        } catch (e) {
          providerResults[provider.id] = { count: 0, ok: false, error: String(e?.message ?? e) };
        }

        // Delay between providers to respect rate limits
        await sleep(100);
      }
    }

    // Apply static overrides — always wins
    const override = overrides[seed.id];
    if (override) {
      if (override.tags?.length) tags = [...override.tags];
      if (override.latest) latestStable = { tag: override.latest };
    }

    // Pick latest stable if not yet determined
    if (!latestStable) {
      const picked = pickLatestStable(tags);
      if (picked) latestStable = picked;
    }

    // Fallback to seed values on total failure
    if (!tags.length) {
      tags = [{ tag: seed.recommended, isFloating: isFloating(seed.recommended) }];
    }
    if (!latestStable) {
      latestStable = { tag: seed.recommended };
    }

    // Tag isFloating flag for UI hints
    tags = tags.map((t) => ({ ...t, isFloating: t.isFloating ?? isFloating(t.tag) }));

    // Sort DESC by publishedAt, trim to top 30
    tags = [...tags]
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
      .slice(0, 30);

    // Guard: recommended must never be a floating tag
    const recommended = override?.recommended ?? seed.recommended;

    registry[seed.id] = {
      ...seed,
      recommended,
      latest: latestStable.tag,
      availableTags: tags,
    };

    lockEntries.push({
      id: seed.id,
      image: seed.image,
      providerResults,
      tagCount: tags.length,
      recommended,
      latest: latestStable.tag,
    });

    // Delay between seeds to stay within DockerHub rate limits
    await sleep(150);
  }

  return { registry, lockEntries };
};

// ── Emitters ───────────────────────────────────────────────────

const emitDataTs = async (registry) => {
  const ts =
    `// AUTO-GENERATED by scripts/sync-registry.mjs\n` +
    `// Do not edit by hand — run \`npm run sync:registry\` to refresh.\n` +
    `// Last sync: ${new Date().toISOString()}\n\n` +
    `import type { ServiceDefinition } from "./types";\n\n` +
    `export const REGISTRY: Readonly<Record<string, ServiceDefinition>> = ` +
    JSON.stringify(registry, null, 2) +
    ` as const;\n`;
  await writeFile(path.join(ROOT, "src/registry/data.ts"), ts);
};

const emitMetaTs = async () => {
  const ts =
    `// AUTO-GENERATED — sync metadata.\n` +
    `// Last successful registry sync.\n` +
    `export const REGISTRY_META = {\n` +
    `  lastSync: ${JSON.stringify(new Date().toISOString())},\n` +
    `} as const;\n`;
  await writeFile(path.join(ROOT, "src/registry/data.meta.ts"), ts);
};

const emitLockJson = async (lockEntries) => {
  const lock = {
    schemaVersion: 1,
    lastSync: new Date().toISOString(),
    entryCount: lockEntries.length,
    entries: lockEntries,
  };
  await writeFile(
    path.join(ROOT, "registry.lock.json"),
    JSON.stringify(lock, null, 2) + "\n",
  );
};

// ── Linter: forbid `defaultTag: "latest"` anywhere ─────────────

const lintNoFloatingDefaults = async (registry) => {
  const violations = [];
  for (const [id, svc] of Object.entries(registry)) {
    if (svc.recommended === "latest" || svc.recommended === "stable" || svc.recommended === "nightly") {
      violations.push(`${id}: recommended tag "${svc.recommended}" is floating`);
    }
  }
  if (violations.length) {
    console.error("[sync] ❌ Floating recommended tags detected:");
    for (const v of violations) console.error("  -", v);
    throw new Error("Registry validation failed");
  }
};

// ── Main ───────────────────────────────────────────────────────

const main = async () => {
  const seeds = await loadSeeds();
  console.log(`[sync] loaded ${seeds.length} seeds`);

  const { registry, lockEntries } = await buildRegistry(seeds);

  await lintNoFloatingDefaults(registry);

  // Make sure target dir exists (data.ts may have been deleted)
  await mkdir(path.join(ROOT, "src/registry"), { recursive: true });

  await emitDataTs(registry);
  await emitMetaTs();
  await emitLockJson(lockEntries);

  console.log(`[sync] ✅ wrote ${Object.keys(registry).length} services to data.ts`);
  console.log(`[sync] ✅ wrote registry.lock.json with ${lockEntries.length} entries`);
};

main().catch((err) => {
  console.error("[sync] ❌", err?.message ?? err);
  process.exit(1);
});
