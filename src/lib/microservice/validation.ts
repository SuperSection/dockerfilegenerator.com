/**
 * Microservice Builder — validation.
 *
 * Extends the compose generator's `validateCompose` with microservice-
 * specific checks: DNS-1123 service ids, `:latest` tag detection,
 * depends_on cross-references, profiles consistency, read-only
 * tmpfs warnings.
 */

import type { MicroserviceConfig, ValidationIssue } from "./schema";
import { resolveService } from "./generator";

const DNS_1123 = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

export const validateMicroservice = (cfg: MicroserviceConfig): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const ids = Object.keys(cfg.services);
  const pinAll = cfg.pinAllTags ?? true;

  // 1. Service id DNS-1123
  for (const id of ids) {
    if (!DNS_1123.test(id) || id.length > 63) {
      issues.push({
        level: "error",
        service: id,
        title: "Invalid service id",
        message: `Service id "${id}" is not DNS-1123. Use lowercase letters, digits, and dashes; ≤63 chars; must start/end alphanumeric.`,
      });
    }
  }

  // 2. Duplicate ids (shouldn't happen, but defense)
  if (new Set(ids).size !== ids.length) {
    issues.push({
      level: "error",
      title: "Duplicate service id",
      message: "Two or more services share the same id.",
    });
  }

  // 3. :latest tag detection
  if (pinAll) {
    for (const [id, svc] of Object.entries(cfg.services)) {
      const resolved = resolveService(svc);
      if (resolved.image && resolved.image.tag === "latest") {
        issues.push({
          level: "warning",
          service: id,
          title: "Floating `:latest` tag",
          message: `${id} is using :latest. Pin a specific tag for reproducible builds (turn off "Pin all tags" to allow).`,
        });
      }
    }
  }

  // 4. Port conflicts on the host side
  const portMap: Record<string, string[]> = {};
  for (const [id, svc] of Object.entries(cfg.services)) {
    for (const p of svc.ports ?? []) {
      const key = String(p.host);
      (portMap[key] ??= []).push(id);
    }
  }
  for (const [port, svcs] of Object.entries(portMap)) {
    if (svcs.length > 1) {
      issues.push({
        level: "error",
        title: `Host port ${port} conflict`,
        message: `Both ${svcs.join(" and ")} map to host port ${port}. Change one to avoid the conflict.`,
      });
    }
  }

  // 5. depends_on cross-reference + healthcheck existence
  for (const [id, svc] of Object.entries(cfg.services)) {
    for (const dep of svc.dependsOn ?? []) {
      if (!ids.includes(dep)) {
        issues.push({
          level: "error",
          service: id,
          title: "Dangling depends_on",
          message: `${id} depends on "${dep}" but no such service exists.`,
        });
      }
    }
  }

  // 6. If a service is depended upon with `service_healthy`, it should have a healthcheck
  const dependedUpon = new Set<string>();
  for (const svc of Object.values(cfg.services)) {
    for (const d of svc.dependsOn ?? []) dependedUpon.add(d);
  }
  for (const dep of dependedUpon) {
    const svc = cfg.services[dep];
    if (!svc) continue;
    const resolved = resolveService(svc);
    if (!resolved.healthcheck) {
      issues.push({
        level: "warning",
        service: dep,
        title: "Depended upon without healthcheck",
        message: `\`${dep}\` is depended upon by other services but has no healthcheck. depends_on will use \`service_started\` instead of \`service_healthy\`.`,
      });
    }
  }

  // 7. read_only without tmpfs
  for (const [id, svc] of Object.entries(cfg.services)) {
    if (svc.security?.readOnly && (!svc.security.tmpfs || svc.security.tmpfs.length === 0)) {
      issues.push({
        level: "info",
        service: id,
        title: "read_only without tmpfs",
        message: `${id} has read_only: true but no tmpfs mounted. /tmp and /run will be read-only — most apps need tmpfs there.`,
      });
    }
  }

  // 8. Default credentials
  for (const [id, svc] of Object.entries(cfg.services)) {
    for (const e of svc.envVars ?? []) {
      const v = e.value ?? "";
      if (["changeme", "password", "guest", "minioadmin", "admin", "root"].includes(v)) {
        issues.push({
          level: "warning",
          service: id,
          title: "Default credentials",
          message: `${id} sets \`${e.key}=${v}\`. Set a strong secret via .env before deploying.`,
        });
      }
    }
  }

  // 9. Profiles sanity
  const referenced = new Set<string>();
  for (const svc of Object.values(cfg.services)) {
    for (const p of svc.profiles ?? []) referenced.add(p);
  }
  if (referenced.size > 0) {
    // Suggest top-level profile list (could be derived from references; warn
    // if a service references a profile not in any "common" set, which is
    // an info-level hint rather than an error).
    for (const p of referenced) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/.test(p)) {
        issues.push({
          level: "error",
          title: "Invalid profile name",
          message: `Profile "${p}" contains illegal characters. Allowed: [a-zA-Z0-9_.-], must start with alphanumeric.`,
        });
      }
    }
  }

  // 10. Empty services
  if (ids.length === 0) {
    issues.push({
      level: "info",
      title: "No services configured",
      message: "Pick a preset or add services to begin.",
    });
  }

  return issues;
};
