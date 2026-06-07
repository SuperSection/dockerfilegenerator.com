/**
 * Static provider — no network, no API. Returns hand-pinned overrides
 * for services whose tag metadata is hard to obtain programmatically
 * (e.g. images on `docker.elastic.co`, vendored releases like Apache
 * Kafka). The sync script always applies OVERRIDES LAST, so this
 * provider wins against Docker Hub and GitHub.
 */

import type { ImageProvider } from "./types";
import type { TagInfo } from "../types";

export interface StaticOverride {
  recommended?: string;
  latest?: string;
  tags?: ReadonlyArray<TagInfo>;
}

export const OVERRIDES: Readonly<Record<string, StaticOverride>> = {
  // Apache Kafka — tags are sparse on Docker Hub, hand-pinned.
  kafka: {
    recommended: "3.9.2",
    latest: "3.9.2",
    tags: [
      { tag: "3.9.2", isFloating: false, publishedAt: "2026-02-15T00:00:00Z" },
      { tag: "3.9.1", isFloating: false, publishedAt: "2026-01-20T00:00:00Z" },
      { tag: "3.9.0", isFloating: false, publishedAt: "2025-12-05T00:00:00Z" },
      { tag: "3.8.1", isFloating: false, publishedAt: "2025-09-15T00:00:00Z" },
      { tag: "3.7.2", isFloating: false, publishedAt: "2025-04-10T00:00:00Z" },
    ],
  },
  // Elasticsearch — image on docker.elastic.co, not Docker Hub.
  elasticsearch: {
    recommended: "8.13.0",
    latest: "8.15.0",
    tags: [
      { tag: "8.15.0", isFloating: false, publishedAt: "2025-01-10T00:00:00Z" },
      { tag: "8.13.0", isFloating: false, publishedAt: "2024-10-30T00:00:00Z" },
      { tag: "8.10.0", isFloating: false, publishedAt: "2024-04-01T00:00:00Z" },
      { tag: "8.0.0", isFloating: false, publishedAt: "2024-02-10T00:00:00Z" },
    ],
  },
  // Traefik — uses GitHub releases; the sync script can pull from
  // GitHub, but the static map is a reliable fallback.
  traefik: {
    recommended: "v3.2",
    latest: "v3.2",
    tags: [
      { tag: "v3.2", isFloating: false, publishedAt: "2024-10-29T00:00:00Z" },
      { tag: "v3.1", isFloating: false, publishedAt: "2024-04-29T00:00:00Z" },
      { tag: "v2.11", isFloating: false, publishedAt: "2024-02-12T00:00:00Z" },
    ],
  },
};

export const staticProvider: ImageProvider = {
  id: "static",
  async fetchTags() {
    return [];
  },
  async fetchLatestStable() {
    return null;
  },
  async verifyExists() {
    return true;
  },
};
