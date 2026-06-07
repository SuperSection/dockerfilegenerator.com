/**
 * Service Registry — public API.
 *
 * The single source of truth for image versions in the Compose and
 * Stack Builder generators. UI components and generators MUST go
 * through `getService`, `listServices`, and `resolveVersion` — never
 * import `data.ts` directly.
 */

import { REGISTRY } from "./data";
import { REGISTRY_META } from "./data.meta";
import type {
  ServiceDefinition,
  TagInfo,
  VersionSelection,
  ResolvedVersion,
  ServiceCategory,
} from "./types";
import { isFloatingTag, validateTag, validateImage, TAG_PATTERN, IMAGE_PATTERN } from "./providers/types";

/** Lookup by slug (e.g. "postgres"). Returns undefined for unknown ids. */
export const getService = (id: string): ServiceDefinition | undefined => REGISTRY[id];

/** All services as a stable array (insertion order of REGISTRY). */
export const listServices = (): ReadonlyArray<ServiceDefinition> => Object.values(REGISTRY);

/** Filter by category. */
export const listByCategory = (cat: ServiceCategory): ReadonlyArray<ServiceDefinition> =>
  listServices().filter((s) => s.category === cat);

/** Sorted tag list for the VersionPicker's "Specific" dropdown. */
export const availableTags = (svc: ServiceDefinition): ReadonlyArray<TagInfo> => {
  // Show all known tags sorted by recency. The picker groups them.
  return [...svc.availableTags].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
};

/**
 * Resolve a user selection into a concrete image:tag for the generator.
 * The generator never inspects this — it just reads `.tag` and `.image`.
 */
export const resolveVersion = (
  serviceId: string,
  selection: VersionSelection,
): ResolvedVersion => {
  const svc = REGISTRY[serviceId];
  if (!svc) throw new Error(`[registry] Unknown service: ${serviceId}`);

  switch (selection.kind) {
    case "recommended":
      return toResolved(svc, svc.recommended, "recommended");
    case "latest":
      return toResolved(svc, svc.latest, "latest");
    case "pinned": {
      // Allow tags that aren't in the registry yet — the user might be
      // tracking a brand-new release. We warn but don't block.
      if (!svc.availableTags.some((t) => t.tag === selection.tag)) {
        // In a real build we'd emit a console warning; in production
        // we silently accept and let the registry catch up via the Action.
      }
      return toResolved(svc, selection.tag, "pinned");
    }
    case "custom": {
      const v = validateTag(selection.tag);
      if (!v.valid) throw new Error(`[registry] Invalid custom tag "${selection.tag}": ${v.reason}`);
      return toResolved(svc, selection.tag, "custom");
    }
  }
};

const toResolved = (
  svc: ServiceDefinition,
  tag: string,
  source: ResolvedVersion["source"],
): ResolvedVersion => ({
  serviceId: svc.id,
  image: svc.image,
  tag,
  source,
  isFloating: isFloatingTag(tag),
});

/** Registry metadata — surfaced in the UI footer ("Registry last synced…"). */
export const registryMeta = () => REGISTRY_META;

export { validateImage, validateTag, TAG_PATTERN, IMAGE_PATTERN };
export type { ServiceDefinition, TagInfo, VersionSelection, ResolvedVersion, ServiceCategory };
