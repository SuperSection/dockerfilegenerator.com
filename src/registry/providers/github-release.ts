/**
 * GitHubRelease provider — fetches release metadata from api.github.com.
 *
 * Some images (Traefik, Meilisearch) publish their canonical version
 * list as GitHub releases even though the Docker image is also on
 * Docker Hub. The sync script tries GitHub first when a `githubRepo`
 * mapping is configured, falling back to DockerHub.
 *
 * The actual org→repo mapping lives in scripts/sync-registry.mjs so
 * this provider stays pure (one repo per call).
 */

import type { ImageProvider } from "./types";
import type { TagInfo } from "../types";

const BASE = "https://api.github.com";

const isPreRelease = (name: string): boolean =>
  /-(rc|alpha|beta|preview|dev|nightly)/i.test(name);

const stripPrefix = (name: string): string =>
  name.replace(/^v/, "").replace(/^release[-_]?/i, "");

export const githubReleaseProvider: ImageProvider = {
  id: "github",

  /**
   * `image` here is interpreted as "{owner}/{repo}" — the sync script
   * maintains the mapping. The image reference itself is not used.
   */
  async fetchTags(image: string): Promise<ReadonlyArray<TagInfo>> {
    const [owner, repo] = image.split("/");
    if (!owner || !repo) return [];
    const token = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GITHUB_TOKEN;
    const res = await fetch(`${BASE}/repos/${owner}/${repo}/releases?per_page=100`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error(`GitHub ${res.status} for ${owner}/${repo}`);
    const releases = (await res.json()) as Array<Record<string, unknown>>;
    return releases
      .filter((r) => r.tag_name)
      .map<TagInfo>((r) => ({
        tag: String(r.tag_name),
        publishedAt: typeof r.published_at === "string" ? r.published_at : undefined,
        isFloating: isPreRelease(String(r.tag_name)),
      }));
  },

  async fetchLatestStable(image: string): Promise<{ tag: string; publishedAt?: string } | null> {
    const tags = await this.fetchTags(image);
    type Versioned = TagInfo & { _v: [number, number, number] };
    const parsed: Versioned[] = [];
    for (const t of tags) {
      if (t.isFloating) continue;
      const v = parseSemver(stripPrefix(t.tag));
      if (!v) continue;
      parsed.push({ ...t, _v: v });
    }
    if (!parsed.length) return null;
    parsed.sort((a, b) => {
      for (let i = 0; i < 3; i++) {
        if (a._v[i] !== b._v[i]) return b._v[i] - a._v[i];
      }
      return 0;
    });
    const top = parsed[0];
    return top ? { tag: top.tag, publishedAt: top.publishedAt } : null;
  },

  async verifyExists(image: string, tag: string): Promise<boolean> {
    const [owner, repo] = image.split("/");
    if (!owner || !repo) return false;
    try {
      const res = await fetch(`${BASE}/repos/${owner}/${repo}/git/refs/tags/${tag}`, {
        headers: { Accept: "application/vnd.github+json" },
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};

const parseSemver = (tag: string): [number, number, number] | null => {
  const m = tag.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
};
