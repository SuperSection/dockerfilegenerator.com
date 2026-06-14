/**
 * Docker Compose — YAML generator.
 */

import type { ServiceConfig, PortMapping, VolumeMount, EnvVar } from "./services";
import { SERVICES } from "./services";
import { resolveVersion, type VersionSelection } from "~/registry";

export interface ServiceOverride {
  ports?: PortMapping[];
  volumes?: VolumeMount[];
  envVars?: EnvVar[];
  restart?: ServiceConfig["defaultRestart"];
  image?: string;
  tag?: string;
  /**
   * How the user picked the tag. Defaults to "recommended" when not set.
   * The generator routes this through `resolveVersion` so the actual
   * tag emitted in YAML is always pinned, never `latest` (unless the
   * user explicitly asked for it via "custom").
   */
  tagSelection?: VersionSelection;
  command?: string[];
  healthCheck?: boolean;
  cpuLimit?: string;
  memoryLimit?: string;
  /** Override the container_name (defaults to service key) */
  containerName?: string;
}

export interface ComposeConfig {
  /** Selected service names with overrides */
  services: Record<string, ServiceOverride>;
  /** Global project name (used in volume name suffix) */
  projectName: string;
  /** Whether to include networks section */
  useNetwork: boolean;
  /** Network name */
  networkName: string;
  /**
   * If true, env values are referenced as ${KEY} in compose — Compose
   * resolves them automatically from the project-level `.env` file at
   * startup. No `env_file: .env` directive is needed (and emitting one
   * is redundant). If false, env values are inlined directly.
   */
  useEnvFile: boolean;
}

const indent = (n: number) => "  ".repeat(n);

const yamlString = (s: string): string => {
  // Quote strings that contain special chars
  if (/[:#\-?{}[\],&*!|>'"%@`]/.test(s) || s === "" || s === "true" || s === "false" || /^\d+$/.test(s)) {
    return JSON.stringify(s);
  }
  return s;
};

// YAML indent convention used throughout this file:
//   indent(0)  → top-level keys (services:, networks:, volumes:)
//   indent(1)  → service name (mysql:, kafka:, …) — child of services:
//   indent(2)  → service-level keys (image:, ports:, environment:, …)
//   indent(3)  → list items / nested mapping values (e.g. - "3306:3306")
//   indent(4)  → grandchildren of a service (e.g. healthcheck.test)
// This mirrors the on-disk layout Compose itself produces.

const renderPorts = (ports: PortMapping[]): string => {
  if (!ports.length) return "";
  const lines = ports.map((p) => `${indent(3)}- "${p.host}:${p.container}"`);
  return `${indent(2)}ports:\n${lines.join("\n")}`;
};

const renderVolumes = (volumes: VolumeMount[]): string => {
  if (!volumes.length) return "";
  const lines = volumes.map((v) => {
    if (v.readOnly) {
      return `${indent(3)}- ${v.host}:${v.container}:ro`;
    }
    return `${indent(3)}- ${v.host}:${v.container}`;
  });
  return `${indent(2)}volumes:\n${lines.join("\n")}`;
};

const renderEnv = (envVars: EnvVar[], useEnvFile: boolean): string => {
  if (!envVars.length) return "";
  const lines = envVars.map((e) => {
    if (useEnvFile) {
      // Reference the .env variable so secrets stay out of compose.
      return `${indent(3)}${e.key}: "\${${e.key}}"`;
    }
    return `${indent(3)}${e.key}: ${yamlString(e.value)}`;
  });
  return `${indent(2)}environment:\n${lines.join("\n")}`;
};

const renderHealthcheck = (service: ServiceConfig, port?: number): string => {
  if (!service.hasHealthcheck) return "";
  const path = service.healthcheckPath ?? "/";
  const probePort = port ?? service.defaultPorts[0]?.container ?? 80;
  // Default probe: a wget spider against localhost. Services can override
  // `healthcheckCmd` with their own probe (e.g. mysqladmin ping, redis-cli ping).
  // Always emit the explicit `CMD` form — it's portable across base images
  // (Alpine vs Debian) and matches what Docker / Compose docs recommend.
  const rawCmd = service.healthcheckCmd ?? ["wget", "--spider", "-q", `http://localhost:${probePort}${path}`];
  // If the first element is already a shell form directive, pass through;
  // otherwise wrap with the explicit `CMD` form.
  const HEAD = rawCmd[0];
  const isForm =
    HEAD === "CMD" || HEAD === "CMD-SHELL" || HEAD === "CMD-EXEC" || HEAD === "NONE";
  const cmd = isForm ? rawCmd : ["CMD", ...rawCmd];
  const cmdStr = cmd.map((c) => JSON.stringify(c)).join(", ");
  return [
    `${indent(2)}healthcheck:`,
    `${indent(3)}test: [${cmdStr}]`,
    `${indent(3)}interval: 30s`,
    `${indent(3)}timeout: 10s`,
    `${indent(3)}retries: 3`,
    `${indent(3)}start_period: 40s`,
  ].join("\n");
};

const renderDependsOn = (deps: string[]): string => {
  if (!deps.length) return "";
  // Use long syntax with service_healthy condition
  const lines = deps.map((d) => `${indent(3)}${d}:\n${indent(5)}condition: service_healthy`);
  return `${indent(2)}depends_on:\n${lines.join("\n")}`;
};

const renderDeploy = (override: ServiceOverride): string => {
  const lines: string[] = [];
  if (override.cpuLimit) {
    lines.push(`${indent(4)}cpus: "${override.cpuLimit}"`);
  }
  if (override.memoryLimit) {
    lines.push(`${indent(4)}memory: "${override.memoryLimit}"`);
  }
  if (!lines.length) return "";
  return `${indent(2)}deploy:\n${indent(3)}resources:\n${indent(4)}limits:\n${lines.join("\n")}`;
};

const renderService = (
  name: string,
  override: ServiceOverride,
  networkName: string,
  useEnvFile: boolean,
): string => {
  const base = SERVICES[name];
  if (!base) return "";

  // Apply overrides with defaults
  const ports = override.ports ?? base.defaultPorts;
  const volumes = override.volumes ?? base.defaultVolumes;
  const envVars = override.envVars ?? base.defaultEnv;
  const restart = override.restart ?? base.defaultRestart;
  const image = override.image ?? base.image;
  // Route tag selection through the registry so we never emit a
  // floating "latest" unless the user explicitly asked for it.
  // For "app" (build context) we keep the existing defaultTag — the
  // registry has no entry for it.
  const isAppService = base.isApp === true;
  const tagResolution = isAppService
    ? { tag: override.tag ?? base.defaultTag, source: "recommended" as const }
    : (() => {
        try {
          return resolveVersion(
            name,
            override.tagSelection
              ?? (override.tag
                ? ({ kind: "pinned", tag: override.tag } as const)
                : ({ kind: "recommended" } as const)),
          );
        } catch {
          return { tag: override.tag ?? base.defaultTag, source: "fallback" as const };
        }
      })();
  const tag = tagResolution.tag;
  const command = override.command ?? base.defaultCommand;
  const includeHealthcheck = override.healthCheck ?? base.hasHealthcheck;
  // Container name override (defaults to the service key)
  const containerName = override.containerName?.trim() || name;

  // Image line: use build context for app, image:tag for everything else
  const imageLine = base.isApp
    ? `${indent(2)}build:\n${indent(3)}context: .\n${indent(3)}dockerfile: Dockerfile`
    : `${indent(2)}image: ${image}:${tag}`;
  // When the user picked a non-recommended tag, emit a comment so the
  // generated YAML is self-documenting. Skipped for app services.
  const tagComment =
    !base.isApp && tagResolution.source !== "recommended"
      ? `${indent(2)}# image: ${image}:${tag} (${tagResolution.source})\n`
      : "";

  // Service header lives at indent level 1 (under `services:`). All child
  // keys below use indent(2) and the section helpers (renderPorts, etc.)
  // use indent(3)/(4) for keys and list items respectively, which produces
  // a uniform 2-space YAML layout.
  const parts: string[] = [`${indent(1)}${name}:`];
  if (tagComment) parts.push(tagComment.trimEnd());
  parts.push(imageLine);
  parts.push(`${indent(2)}container_name: ${containerName}`);
  parts.push(`${indent(2)}restart: ${restart}`);

  if (ports.length) parts.push(renderPorts(ports));
  if (volumes.length) parts.push(renderVolumes(volumes));
  // `environment` and `env_file` are siblings under the service. We do NOT
  // emit `env_file: .env` here — when env values are referenced as ${KEY},
  // Compose automatically resolves them from the project-level `.env` file
  // at startup, so an explicit `env_file: .env` directive would be redundant.
  if (envVars.length) parts.push(renderEnv(envVars, useEnvFile));
  if (base.dependsOn && base.dependsOn.length) parts.push(renderDependsOn(base.dependsOn));
  if (includeHealthcheck) parts.push(renderHealthcheck(base));
  if (command && command.length) {
    const cmdStr = command.map((c) => JSON.stringify(c)).join(", ");
    parts.push(`${indent(2)}command: [${cmdStr}]`);
  }
  if (override.cpuLimit || override.memoryLimit) parts.push(renderDeploy(override));

  // Networks (single, shared by all services in this compose)
  parts.push(`${indent(2)}networks:\n${indent(3)}- ${networkName}`);

  return parts.filter(Boolean).join("\n");
};

export const generateCompose = (config: ComposeConfig): string => {
  const serviceNames = Object.keys(config.services);
  const lines: string[] = [];

  lines.push("# Generated by dockerfilegenerator.com");
  lines.push("# Production-ready docker-compose.yml");
  if (config.useEnvFile) {
    lines.push("# Env values reference variables from .env (see .env.example).");
  }
  lines.push("");
  lines.push(`name: ${config.projectName}`);
  lines.push("");

  lines.push("services:");
  serviceNames.forEach((name, i) => {
    // Blank line between services for readability — many real-world
    // compose files (and `docker compose config` output) do this, and
    // it makes the diff between two configs much easier to scan.
    if (i > 0) lines.push("");
    lines.push(renderService(name, config.services[name], config.networkName, config.useEnvFile));
  });

  // Networks
  if (config.useNetwork) {
    lines.push("");
    lines.push("networks:");
    lines.push(`  ${config.networkName}:`);
    lines.push(`    driver: bridge`);
  }

  // Named volumes
  const namedVolumes = new Set<string>();
  serviceNames.forEach((name) => {
    const override = config.services[name];
    const base = SERVICES[name];
    if (!base) return;
    const vols = override.volumes ?? base.defaultVolumes;
    vols.forEach((v) => {
      // A host path is "named" if it doesn't start with . or /
      if (!v.host.startsWith(".") && !v.host.startsWith("/")) {
        namedVolumes.add(v.host);
      }
    });
    if (base.createsVolumes) {
      base.createsVolumes.forEach((v) => namedVolumes.add(v));
    }
  });

  if (namedVolumes.size) {
    lines.push("");
    lines.push("volumes:");
    // `driver: local` is the default — omit it. Empty mapping `name:` is the
    // valid short form for a Docker-named volume.
    [...namedVolumes].forEach((v) => {
      lines.push(`  ${v}:`);
    });
  }

  lines.push("");
  return lines.join("\n");
};

export const generateEnvExample = (config: ComposeConfig): string => {
  const lines: string[] = ["# Generated by dockerfilegenerator.com"];
  lines.push("# Copy this file to .env and fill in real values.");
  lines.push("");

  const envByService: Record<string, EnvVar[]> = {};
  Object.entries(config.services).forEach(([name, override]) => {
    const base = SERVICES[name];
    if (!base) return;
    const envs = override.envVars ?? base.defaultEnv;
    if (envs.length) envByService[name] = envs;
  });

  Object.entries(envByService).forEach(([svc, envs]) => {
    lines.push(`# ${svc}`);
    envs.forEach((e) => {
      lines.push(`${e.key}=${e.value}`);
    });
    lines.push("");
  });

  return lines.join("\n");
};

/* ─────────────────────────────────────────────────────────
 * Validation
 * ─────────────────────────────────────────────────────── */
export interface ValidationIssue {
  level: "error" | "warning" | "info";
  service?: string;
  title: string;
  message: string;
}

export const validateCompose = (config: ComposeConfig): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  // Port conflicts
  const portMap: Record<string, string[]> = {};
  Object.entries(config.services).forEach(([name, override]) => {
    const base = SERVICES[name];
    if (!base) return;
    const ports = override.ports ?? base.defaultPorts;
    ports.forEach((p) => {
      const key = String(p.host);
      if (!portMap[key]) portMap[key] = [];
      portMap[key].push(name);
    });
  });

  Object.entries(portMap).forEach(([port, services]) => {
    if (services.length > 1) {
      issues.push({
        level: "error",
        title: `Port ${port} conflict`,
        message: `Both ${services.join(" and ")} map to host port ${port}. Change one to avoid the conflict.`,
      });
    }
  });

  // Default passwords
  Object.entries(config.services).forEach(([name, override]) => {
    const base = SERVICES[name];
    if (!base) return;
    const envs = override.envVars ?? base.defaultEnv;
    envs.forEach((e) => {
      if (
        e.value === "changeme" ||
        e.value === "password" ||
        e.value === "guest" ||
        e.value === "minioadmin"
      ) {
        issues.push({
          level: "warning",
          service: name,
          title: "Default credentials",
          message: `${name} is using the default password <code>changeme</code>. Replace it with a strong secret via the .env file before deploying to production.`,
        });
      }
    });
  });

  // Missing restart policy
  Object.entries(config.services).forEach(([name, override]) => {
    if (!override.restart || override.restart === "no") {
      issues.push({
        level: "info",
        service: name,
        title: "No restart policy",
        message: `${name} will not restart if it crashes. Add <code>restart: unless-stopped</code> for production use.`,
      });
    }
  });

  // Database without volume
  ["postgres", "mysql", "mariadb", "mongodb", "redis"].forEach((svc) => {
    if (config.services[svc]) {
      const override = config.services[svc];
      const base = SERVICES[svc];
      const vols = override.volumes ?? base.defaultVolumes;
      if (!vols.length) {
        issues.push({
          level: "warning",
          service: svc,
          title: "No persistent volume",
          message: `${svc} has no volume mounted. All data will be lost when the container is recreated. Add a named volume to persist data.`,
        });
      }
    }
  });

  return issues;
};
