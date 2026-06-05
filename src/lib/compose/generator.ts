/**
 * Docker Compose — YAML generator.
 */

import type { ServiceConfig, PortMapping, VolumeMount, EnvVar } from "./services";
import { SERVICES } from "./services";

export interface ServiceOverride {
  ports?: PortMapping[];
  volumes?: VolumeMount[];
  envVars?: EnvVar[];
  restart?: ServiceConfig["defaultRestart"];
  image?: string;
  tag?: string;
  command?: string[];
  healthCheck?: boolean;
  cpuLimit?: string;
  memoryLimit?: string;
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
}

const indent = (n: number) => "  ".repeat(n);

const yamlString = (s: string): string => {
  // Quote strings that contain special chars
  if (/[:#\-?{}[\],&*!|>'"%@`]/.test(s) || s === "" || s === "true" || s === "false" || /^\d+$/.test(s)) {
    return JSON.stringify(s);
  }
  return s;
};

const renderPorts = (ports: PortMapping[]): string => {
  if (!ports.length) return "";
  const lines = ports.map((p) => `${indent(4)}- "${p.host}:${p.container}"`);
  return `${indent(3)}ports:\n${lines.join("\n")}`;
};

const renderVolumes = (volumes: VolumeMount[]): string => {
  if (!volumes.length) return "";
  const lines = volumes.map((v) => {
    if (v.readOnly) {
      return `${indent(4)}- ${v.host}:${v.container}:ro`;
    }
    return `${indent(4)}- ${v.host}:${v.container}`;
  });
  return `${indent(3)}volumes:\n${lines.join("\n")}`;
};

const renderEnv = (envVars: EnvVar[]): string => {
  if (!envVars.length) return "";
  const lines = envVars.map((e) => `${indent(4)}${e.key}: ${yamlString(e.value)}`);
  return `${indent(3)}environment:\n${lines.join("\n")}`;
};

const renderHealthcheck = (service: ServiceConfig, port?: number): string => {
  if (!service.hasHealthcheck) return "";
  const path = service.healthcheckPath ?? "/";
  const probePort = port ?? service.defaultPorts[0]?.container ?? 80;
  const cmd = service.healthcheckCmd ?? ["wget", "--spider", "-q", `http://localhost:${probePort}${path}`];
  const cmdStr = cmd.map((c) => JSON.stringify(c)).join(", ");
  return [
    `${indent(3)}healthcheck:`,
    `${indent(4)}test: [${cmdStr}]`,
    `${indent(4)}interval: 30s`,
    `${indent(4)}timeout: 10s`,
    `${indent(4)}retries: 3`,
    `${indent(4)}start_period: 40s`,
  ].join("\n");
};

const renderDependsOn = (deps: string[]): string => {
  if (!deps.length) return "";
  // Use long syntax with service_healthy condition
  const lines = deps.map((d) => `${indent(4)}${d}:\n${indent(6)}condition: service_healthy`);
  return `${indent(3)}depends_on:\n${lines.join("\n")}`;
};

const renderDeploy = (override: ServiceOverride): string => {
  const lines: string[] = [];
  if (override.cpuLimit) {
    lines.push(`${indent(5)}cpus: "${override.cpuLimit}"`);
  }
  if (override.memoryLimit) {
    lines.push(`${indent(5)}memory: "${override.memoryLimit}"`);
  }
  if (!lines.length) return "";
  return `${indent(3)}deploy:\n${indent(4)}resources:\n${indent(5)}limits:\n${lines.join("\n")}`;
};

const renderService = (name: string, override: ServiceOverride): string => {
  const base = SERVICES[name];
  if (!base) return "";

  // Apply overrides with defaults
  const ports = override.ports ?? base.defaultPorts;
  const volumes = override.volumes ?? base.defaultVolumes;
  const envVars = override.envVars ?? base.defaultEnv;
  const restart = override.restart ?? base.defaultRestart;
  const image = override.image ?? base.image;
  const tag = override.tag ?? base.defaultTag;
  const command = override.command ?? base.defaultCommand;
  const includeHealthcheck = override.healthCheck ?? base.hasHealthcheck;

  // Image line: use build context for app, image:tag for everything else
  const imageLine = base.isApp
    ? `${indent(2)}build:\n${indent(3)}context: .\n${indent(3)}dockerfile: Dockerfile`
    : `${indent(2)}image: ${image}:${tag}`;

  const parts: string[] = [`${name}:`];
  parts.push(imageLine);
  parts.push(`${indent(2)}container_name: ${name}`);
  parts.push(`${indent(2)}restart: ${restart}`);

  if (ports.length) parts.push(renderPorts(ports));
  if (volumes.length) parts.push(renderVolumes(volumes));
  if (envVars.length) parts.push(renderEnv(envVars));
  if (base.dependsOn && base.dependsOn.length) parts.push(renderDependsOn(base.dependsOn));
  if (includeHealthcheck) parts.push(renderHealthcheck(base));
  if (command && command.length) {
    const cmdStr = command.map((c) => JSON.stringify(c)).join(", ");
    parts.push(`${indent(2)}command: [${cmdStr}]`);
  }
  if (override.cpuLimit || override.memoryLimit) parts.push(renderDeploy(override));

  // Networks
  parts.push(`${indent(2)}networks:\n${indent(3)}- ${"appnet"}`);

  return parts.filter(Boolean).join("\n");
};

export const generateCompose = (config: ComposeConfig): string => {
  const serviceNames = Object.keys(config.services);
  const lines: string[] = [];

  lines.push("# Generated by dockerfilegenerator.com");
  lines.push("# Production-ready docker-compose.yml");
  lines.push("");
  lines.push(`name: ${config.projectName}`);
  lines.push("");

  lines.push("services:");
  serviceNames.forEach((name) => {
    lines.push(renderService(name, config.services[name]));
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
    [...namedVolumes].forEach((v) => {
      lines.push(`  ${v}:`);
      lines.push(`    driver: local`);
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
          message: `${name} uses a default password. Set a strong secret via .env before deploying.`,
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
        message: `${name} will not restart on failure. Set restart: unless-stopped for production.`,
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
          title: "Database has no volume",
          message: `${svc} will lose data on container restart. Add a named volume.`,
        });
      }
    }
  });

  return issues;
};
