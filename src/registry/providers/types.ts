/**
 * ImageProvider — abstraction over upstream image registries.
 *
 * Implementations:
 *   - StaticProvider: no network, uses `OVERRIDES` map
 *   - DockerHubProvider: hits hub.docker.com
 *   - GitHubReleaseProvider: hits api.github.com
 *
 * The sync script runs all three in order; static always wins last.
 */

import type { TagInfo } from "../types";

export interface ImageProvider {
  readonly id: "dockerhub" | "github" | "static";

  fetchTags(image: string): Promise<ReadonlyArray<TagInfo>>;
  fetchLatestStable(image: string): Promise<{ tag: string; publishedAt?: string } | null>;
  verifyExists(image: string, tag: string): Promise<boolean>;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
}

/** Matches Docker tag rules: `[a-zA-Z0-9_][a-zA-Z0-9._-]{0,127}`. */
export const TAG_PATTERN = /^[a-zA-Z0-9_][a-zA-Z0-9._-]{0,127}$/;

/** Image reference (org/name); for Docker Hub, org is optional. */
export const IMAGE_PATTERN =
  /^(?:[a-z0-9]+(?:[._-][a-z0-9]+)*)(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*$/;

export const validateImage = (image: string): ValidationResult => {
  if (!image) return { valid: false, reason: "Image reference is empty" };
  if (image.length > 255) return { valid: false, reason: "Image reference too long" };
  if (!IMAGE_PATTERN.test(image)) {
    return { valid: false, reason: "Invalid characters in image reference" };
  }
  return { valid: true };
};

export const validateTag = (tag: string): ValidationResult => {
  if (!tag) return { valid: false, reason: "Tag is empty" };
  if (tag.length > 128) return { valid: false, reason: "Tag too long" };
  if (!TAG_PATTERN.test(tag)) {
    return { valid: false, reason: "Tag must match [a-zA-Z0-9_][a-zA-Z0-9._-]{0,127}" };
  }
  return { valid: true };
};

/** Tags we never want to ship as `recommended`. */
export const FLOATING_TAGS = new Set([
  "latest",
  "stable",
  "nightly",
  "lts",
  "edge",
  "main",
]);

/** Suffix patterns that indicate a "moving" tag (e.g. `16-alpine`). */
export const FLOATING_SUFFIX = /-(alpine|slim|bookworm|bullseye|jammy|noble)$/i;

export const isFloatingTag = (tag: string): boolean =>
  FLOATING_TAGS.has(tag) || FLOATING_SUFFIX.test(tag);
