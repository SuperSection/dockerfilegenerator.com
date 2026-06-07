/**
 * DockerHub provider — fetches tag metadata from hub.docker.com.
 *
 * Used at sync time by scripts/sync-registry.mjs. Not used at runtime
 * in v1 — the static `data.ts` is the source of truth for builds.
 *
 * Public API: https://hub.docker.com/v2/repositories/{image}/tags/
 * Rate limit: ~60 req/IP/10s unauthenticated, 200/hr with token.
 */

import type { ImageProvider } from "./types";
import type { TagInfo } from "../types";

const BASE = "https://hub.docker.com/v2/repositories";

const isFloating = (tag: string): boolean =>
  ["latest", "stable", "nightly", "lts", "edge"].includes(tag) ||
  /-(alpine|slim|bookworm|bullseye|jammy|noble)$/i.test(tag);

/** Paged GET against hub.docker.com. */
async function* paginate(pathname: string, pageSize = 100): AsyncGenerator<unknown[]> {
  let url: string | null = `${BASE}${pathname}?page_size=${pageSize}`;
  while (url) {
    const res: Response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`DockerHub ${res.status} for ${url}`);
    }
    const body = (await res.json()) as { results?: unknown[]; next?: string | null };
    if (body.results?.length) yield body.results;
    url = body.next ?? null;
  }
}

export const dockerHubProvider: ImageProvider = {
  id: "dockerhub",

  async fetchTags(image: string): Promise<ReadonlyArray<TagInfo>> {
    const out: TagInfo[] = [];
    try {
      for await (const page of paginate(`/${image}/tags/`)) {
        for (const r of page as Array<Record<string, unknown>>) {
          const name = String(r.name ?? "");
          if (!name) continue;
          out.push({
            tag: name,
            publishedAt: typeof r.last_updated === "string" ? r.last_updated : undefined,
            sizeBytes: typeof r.full_size === "number" ? r.full_size : undefined,
            digest: typeof r.digest === "string" ? r.digest : undefined,
            isFloating: isFloating(name),
          });
        }
      }
    } catch (e) {
      // Re-throw so the sync script can record the failure in
      // registry.lock.json and fall back to static overrides.
      throw e;
    }
    return out;
  },

  async fetchLatestStable(image: string): Promise<{ tag: string; publishedAt?: string } | null> {
    const tags = await this.fetchTags(image);
    type Versioned = { tag: string; publishedAt?: string; _v: [number, number, number] };
    const stables: Versioned[] = [];
    for (const t of tags) {
      if (t.isFloating) continue;
      const v = parseSemver(t.tag);
      if (!v) continue;
      stables.push({ tag: t.tag, publishedAt: t.publishedAt, _v: v });
    }
    if (!stables.length) return null;
    stables.sort((a, b) => {
      for (let i = 0; i < 3; i++) {
        if (a._v[i] !== b._v[i]) return a._v[i] - b._v[i];
      }
      return 0;
    });
    const top = stables[stables.length - 1];
    return top ? { tag: top.tag, publishedAt: top.publishedAt } : null;
  },

  async verifyExists(image: string, tag: string): Promise<boolean> {
    try {
      const res = await fetch(`${BASE}/${image}/tags/${tag}/`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};

const parseSemver = (tag: string): [number, number, number] | null => {
  const m = tag.replace(/^v/, "").match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
};
