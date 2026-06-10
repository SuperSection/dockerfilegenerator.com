/**
 * Microservice Builder — compose generator.
 *
 * Pure function: takes a `MicroserviceConfig`, returns a complete
 * `compose.yaml` string. Emits compose-spec v2 (no `version:` key)
 * with production defaults:
 *   - `name:` at top
 *   - exec-form healthcheck
 *   - long-form `depends_on` with `condition: service_healthy`
 *   - `deploy.resources.limits` for resource constraints
 *   - named volumes + networks
 *   - `init: true` on app services
 *   - hardened security preset materializes cap_drop/security_opt
 */

import type {
  EnvVar,
  LabelDef,
  MicroserviceConfig,
  NetworkDef,
  PortMapping,
  SecretDef,
  SecretMount,
  ServiceOverride,
  VolumeDef,
} from "./schema";
import type { ServiceDefinition } from "~/registry";
import { getService, resolveVersion, type VersionSelection } from "~/registry";

const ind = (n: number) => "  ".repeat(n);

const yamlStr = (s: string): string => {
  if (
    s === "" ||
    s === "true" ||
    s === "false" ||
    /[:#\-?{}[\],&*!|>'"%@`]/.test(s) ||
    /^\d+$/.test(s)
  ) {
    return JSON.stringify(s);
  }
  return s;
};

// ── resolveService — apply defaults ────────────────────────
// Given a raw `ServiceOverride` and the registry entry (if any),
// produce a fully-populated service description for the generator.
export interface ResolvedService {
  id: string;
  override: ServiceOverride;
  registry?: ServiceDefinition;
  /** Final image:tag, or null if build context is used. */
  image: { image: string; tag: string; isApp: boolean } | null;
  /** Effective healthcheck (exec form). null = no healthcheck. */
  healthcheck: {
    test: string[];
    interval: string;
    timeout: string;
    retries: number;
    startPeriod: string;
  } | null;
  /** Networks the service joins. Always includes the project network. */
  networks: string[];
  /** Default restart policy. */
  restart: "no" | "always" | "on-failure" | "unless-stopped";
  /** Whether to emit `init: true`. */
  init: boolean;
  /** Whether this is a build-context service (vs image). */
  isBuild: boolean;
}

const PROJECT_NETWORK = "appnet";

export const resolveService = (
  override: ServiceOverride,
): ResolvedService => {
  const reg = getService(override.id);
  const isBuild = !!override.build || (reg?.compose.isApp ?? false);

  // Image + tag
  let image: ResolvedService["image"] = null;
  if (!isBuild) {
    const baseImage = override.image ?? reg?.image ?? override.id;
    let tag: string;
    if (override.tagSelection) {
      try {
        tag = resolveVersion(override.id, override.tagSelection).tag;
      } catch {
        tag = override.tag ?? reg?.recommended ?? "latest";
      }
    } else if (override.tag) {
      tag = override.tag;
    } else if (reg) {
      tag = reg.recommended;
    } else {
      tag = "latest";
    }
    image = { image: baseImage, tag, isApp: false };
  } else if (reg) {
    // build-context service in the registry (the `app` entry)
    image = { image: reg.image, tag: reg.recommended, isApp: true };
  }

  // Healthcheck
  let healthcheck: ResolvedService["healthcheck"] = null;
  const hc = override.healthCheck;
  if (hc?.disable) {
    healthcheck = null;
  } else if (hc?.test && hc.test.length) {
    const test: string[] = hc.test[0] === "CMD" || hc.test[0] === "CMD-SHELL" || hc.test[0] === "NONE"
      ? [...hc.test]
      : ["CMD", ...hc.test];
    healthcheck = {
      test,
      interval: hc.interval ?? "30s",
      timeout: hc.timeout ?? "10s",
      retries: hc.retries ?? 3,
      startPeriod: hc.startPeriod ?? (isBuild ? "40s" : "30s"),
    };
  } else if (reg?.compose.hasHealthcheck && reg.compose.healthcheckCmd) {
    const rawCmd = reg.compose.healthcheckCmd;
    const test: string[] = rawCmd[0] === "CMD-SHELL"
      ? ["CMD-SHELL", rawCmd.slice(1).join(" ")]
      : rawCmd[0] === "CMD" || rawCmd[0] === "NONE"
      ? [...rawCmd]
      : ["CMD", ...rawCmd];
    healthcheck = {
      test,
      interval: "30s",
      timeout: "10s",
      retries: 3,
      startPeriod: isBuild ? "40s" : "30s",
    };
  }

  // Networks — always join the project network, plus any custom.
  const customNets = (override.networks ?? []).map((n) => n.name);
  const networks = Array.from(new Set([PROJECT_NETWORK, ...customNets]));

  return {
    id: override.id,
    override,
    registry: reg,
    image,
    healthcheck,
    networks,
    restart: override.restart ?? reg?.compose.defaultRestart ?? "unless-stopped",
    init: override.init ?? (isBuild ? true : false),
    isBuild,
  };
};

// ── Render helpers ────────────────────────────────────────

const renderImage = (svc: ResolvedService): string[] => {
  const lines: string[] = [];
  if (svc.isBuild) {
    const build = svc.override.build ?? { context: `./${svc.id}` };
    lines.push(`${ind(2)}build:`);
    lines.push(`${ind(3)}context: ${yamlStr(build.context)}`);
    if (build.dockerfile && build.dockerfile !== "Dockerfile") {
      lines.push(`${ind(3)}dockerfile: ${yamlStr(build.dockerfile)}`);
    }
    if (build.target) lines.push(`${ind(3)}target: ${yamlStr(build.target)}`);
    if (build.args && Object.keys(build.args).length) {
      lines.push(`${ind(3)}args:`);
      for (const [k, v] of Object.entries(build.args)) {
        lines.push(`${ind(4)}${k}: ${yamlStr(v)}`);
      }
    }
  } else if (svc.image) {
    lines.push(`${ind(2)}image: ${svc.image.image}:${svc.image.tag}`);
  }
  return lines;
};

const renderPorts = (ports: PortMapping[]): string[] => {
  if (!ports.length) return [];
  const lines: string[] = [`${ind(2)}ports:`];
  for (const p of ports) {
    const proto = p.protocol && p.protocol !== "tcp" ? `/${p.protocol}` : "";
    lines.push(`${ind(3)}- "${p.host}:${p.container}${proto}"`);
  }
  return lines;
};

const renderExpose = (expose: number[]): string[] => {
  if (!expose.length) return [];
  return [`${ind(2)}expose:`, ...expose.map((p) => `${ind(3)}-${ind(1)}${p}`)];
};

const renderEnv = (envVars: EnvVar[], useEnvFile: boolean): string[] => {
  if (!envVars.length) return [];
  const lines: string[] = [`${ind(2)}environment:`];
  for (const e of envVars) {
    const kind = e.kind ?? "literal";
    if (kind === "secret-ref" && e.secretName) {
      lines.push(`${ind(3)}${e.key}:`);
      lines.push(`${ind(4)}source: ${e.secretName}`);
    } else if (kind === "interpolation" || (useEnvFile && kind === "literal")) {
      lines.push(`${ind(3)}${e.key}: "\${${e.key}}"`);
    } else {
      lines.push(`${ind(3)}${e.key}: ${yamlStr(e.value)}`);
    }
  }
  return lines;
};

const renderEnvFile = (files: string[]): string[] => {
  if (!files.length) return [];
  return [`${ind(2)}env_file:`, ...files.map((f) => `${ind(3)}-${ind(1)}${yamlStr(f)}`)];
};

const renderVolumes = (vols: { host: string; container: string; readOnly?: boolean }[]): string[] => {
  if (!vols.length) return [];
  const lines: string[] = [`${ind(2)}volumes:`];
  for (const v of vols) {
    const ro = v.readOnly ? ":ro" : "";
    lines.push(`${ind(3)}- ${yamlStr(v.host)}:${v.container}${ro}`);
  }
  return lines;
};

const renderHealthcheck = (hc: NonNullable<ResolvedService["healthcheck"]>): string[] => {
  const cmd = hc.test.map((c) => JSON.stringify(c)).join(", ");
  return [
    `${ind(2)}healthcheck:`,
    `${ind(3)}test: [${cmd}]`,
    `${ind(3)}interval: ${hc.interval}`,
    `${ind(3)}timeout: ${hc.timeout}`,
    `${ind(3)}retries: ${hc.retries}`,
    `${ind(3)}start_period: ${hc.startPeriod}`,
  ];
};

const renderDependsOn = (deps: string[]): string[] => {
  if (!deps.length) return [];
  const lines: string[] = [`${ind(2)}depends_on:`];
  for (const d of deps) {
    lines.push(`${ind(3)}${d}:`);
    lines.push(`${ind(5)}condition: service_healthy`);
  }
  return lines;
};

const renderResources = (r: { cpus?: string; memory?: string; pidsLimit?: number }): string[] => {
  const limits: string[] = [];
  if (r.cpus) limits.push(`${ind(4)}cpus: "${r.cpus}"`);
  if (r.memory) limits.push(`${ind(4)}memory: "${r.memory}"`);
  if (r.pidsLimit !== undefined) limits.push(`${ind(4)}pids_limit: ${r.pidsLimit}`);
  if (!limits.length) return [];
  return [`${ind(2)}deploy:`, `${ind(3)}resources:`, `${ind(4)}limits:`, ...limits];
};

const renderSecurity = (
  svc: ServiceOverride,
): string[] => {
  const lines: string[] = [];
  const sec = svc.security;
  if (!sec) return lines;

  const preset = sec.preset ?? "relaxed";
  if (preset === "hardened") {
    if (sec.user) lines.push(`${ind(2)}user: "${sec.user}"`);
    if (sec.readOnly) lines.push(`${ind(2)}read_only: true`);
    if (sec.capDrop && sec.capDrop.length) {
      lines.push(`${ind(2)}cap_drop:`);
      for (const c of sec.capDrop) lines.push(`${ind(3)}-${ind(1)}${yamlStr(c)}`);
    }
    if (sec.capAdd && sec.capAdd.length) {
      lines.push(`${ind(2)}cap_add:`);
      for (const c of sec.capAdd) lines.push(`${ind(3)}-${ind(1)}${yamlStr(c)}`);
    }
    if (sec.securityOpt && sec.securityOpt.length) {
      lines.push(`${ind(2)}security_opt:`);
      for (const s of sec.securityOpt) lines.push(`${ind(3)}-${ind(1)}${yamlStr(s)}`);
    }
    if (sec.ulimits && sec.ulimits.length) {
      lines.push(`${ind(2)}ulimits:`);
      for (const u of sec.ulimits) {
        lines.push(`${ind(3)}${u.name}: ${u.soft}:${u.hard}`);
      }
    }
    if (sec.readOnly) {
      const tmpfs = sec.tmpfs ?? ["/tmp", "/run"];
      if (tmpfs.length) {
        lines.push(`${ind(2)}tmpfs:`);
        for (const t of tmpfs) lines.push(`${ind(3)}-${ind(1)}${yamlStr(t)}`);
      }
    }
    if (sec.privileged) lines.push(`${ind(2)}privileged: true`);
  } else if (preset === "custom") {
    if (sec.user) lines.push(`${ind(2)}user: "${sec.user}"`);
    if (sec.readOnly) lines.push(`${ind(2)}read_only: true`);
    if (sec.capDrop && sec.capDrop.length) {
      lines.push(`${ind(2)}cap_drop:`);
      for (const c of sec.capDrop) lines.push(`${ind(3)}-${ind(1)}${yamlStr(c)}`);
    }
    if (sec.capAdd && sec.capAdd.length) {
      lines.push(`${ind(2)}cap_add:`);
      for (const c of sec.capAdd) lines.push(`${ind(3)}-${ind(1)}${yamlStr(c)}`);
    }
    if (sec.securityOpt && sec.securityOpt.length) {
      lines.push(`${ind(2)}security_opt:`);
      for (const s of sec.securityOpt) lines.push(`${ind(3)}-${ind(1)}${yamlStr(s)}`);
    }
    if (sec.ulimits && sec.ulimits.length) {
      lines.push(`${ind(2)}ulimits:`);
      for (const u of sec.ulimits) {
        lines.push(`${ind(3)}${u.name}: ${u.soft}:${u.hard}`);
      }
    }
    if (sec.readOnly) {
      const tmpfs = sec.tmpfs ?? ["/tmp", "/run"];
      if (tmpfs.length) {
        lines.push(`${ind(2)}tmpfs:`);
        for (const t of tmpfs) lines.push(`${ind(3)}-${ind(1)}${yamlStr(t)}`);
      }
    }
    if (sec.privileged) lines.push(`${ind(2)}privileged: true`);
  }
  return lines;
};

const renderProfiles = (profiles: string[]): string[] => {
  if (!profiles.length) return [];
  return [`${ind(2)}profiles:`, ...profiles.map((p) => `${ind(3)}-${ind(1)}${yamlStr(p)}`)];
};

const renderSecretMounts = (mounts: SecretMount[]): string[] => {
  if (!mounts.length) return [];
  const lines: string[] = [`${ind(2)}secrets:`];
  for (const m of mounts) {
    lines.push(`${ind(3)}- source: ${m.source}`);
    lines.push(`${ind(4)}target: ${m.target ?? `/run/secrets/${m.source}`}`);
    if (m.uid) lines.push(`${ind(4)}uid: "${m.uid}"`);
    if (m.gid) lines.push(`${ind(4)}gid: "${m.gid}"`);
    if (m.mode !== undefined) lines.push(`${ind(4)}mode: 0${m.mode.toString(8)}`);
  }
  return lines;
};

const renderLabels = (
  labels: LabelDef[],
  projectName: string,
): string[] => {
  const out: string[] = [`${ind(2)}labels:`];
  // Always inject the project label
  out.push(`${ind(3)}com.docker.compose.project: ${yamlStr(projectName)}`);
  for (const l of labels) {
    out.push(`${ind(3)}${l.key}: ${yamlStr(l.value)}`);
  }
  return out;
};

const renderLogging = (logging: { driver: string; options?: Record<string, string> }): string[] => {
  const lines: string[] = [`${ind(2)}logging:`];
  lines.push(`${ind(3)}driver: ${logging.driver}`);
  if (logging.options && Object.keys(logging.options).length) {
    lines.push(`${ind(3)}options:`);
    for (const [k, v] of Object.entries(logging.options)) {
      lines.push(`${ind(4)}${k}: ${yamlStr(v)}`);
    }
  }
  return lines;
};

const renderNetworksList = (nets: string[]): string[] => {
  if (!nets.length) return [];
  return [`${ind(2)}networks:`, ...nets.map((n) => `${ind(3)}-${ind(1)}${n}`)];
};

const renderCommand = (cmd: string[]): string[] => {
  if (!cmd.length) return [];
  const cmdStr = cmd.map((c) => JSON.stringify(c)).join(", ");
  return [`${ind(2)}command: [${cmdStr}]`];
};

// ── renderService — top-level service block ────────────────
const renderService = (
  resolved: ResolvedService,
  cfg: MicroserviceConfig,
): string[] => {
  const { override, healthcheck, networks, restart, init, isBuild } = resolved;
  const lines: string[] = [`${ind(1)}${override.id}:`];

  // image / build
  lines.push(...renderImage(resolved));

  // container_name
  lines.push(`${ind(2)}container_name: ${override.containerName?.trim() || override.id}`);

  // restart
  lines.push(`${ind(2)}restart: ${restart}`);

  // init (only emit when true, for noise reduction; default off for db/cache)
  if (init) lines.push(`${ind(2)}init: true`);

  // stop_grace_period
  if (override.stopGracePeriod) lines.push(`${ind(2)}stop_grace_period: ${override.stopGracePeriod}`);

  // platform
  if (override.platform) lines.push(`${ind(2)}platform: ${override.platform}`);

  // ports / expose
  lines.push(...renderPorts(override.ports ?? []));
  lines.push(...renderExpose(override.expose ?? []));

  // env — fall back to registry defaults when not explicitly set
  const reg = resolved.registry;
  lines.push(...renderEnv(override.envVars ?? (reg?.compose.env as any[]) ?? [], cfg.useEnvFile));
  lines.push(...renderEnvFile(override.envFile ?? []));

  // volumes — fall back to registry defaults when not explicitly set
  lines.push(...renderVolumes(override.volumes ?? (reg?.compose.volumes as any[]) ?? []));

  // depends_on
  lines.push(...renderDependsOn(override.dependsOn ?? []));

  // healthcheck
  if (healthcheck) lines.push(...renderHealthcheck(healthcheck));

  // resources
  if (override.resources) lines.push(...renderResources(override.resources));

  // security
  lines.push(...renderSecurity(override));

  // profiles
  lines.push(...renderProfiles(override.profiles ?? []));

  // secrets (mounts)
  lines.push(...renderSecretMounts(override.secrets ?? []));

  // labels
  if (override.labels && override.labels.length) {
    lines.push(...renderLabels(override.labels, cfg.projectName));
  }

  // logging (only if non-default)
  if (override.logging) lines.push(...renderLogging(override.logging));

  // command
  if (override.command && override.command.length) {
    lines.push(...renderCommand(override.command));
  }

  // working_dir
  if (override.workingDir) lines.push(`${ind(2)}working_dir: ${yamlStr(override.workingDir)}`);

  // networks (always last, deduped)
  lines.push(...renderNetworksList(networks));

  // silence unused
  void isBuild;

  return lines;
};

// ── renderTopLevel — networks, volumes, secrets ───────────
const renderTopLevelNetworks = (nets: NetworkDef[]): string[] => {
  // Always include the project network as the first entry.
  const seen = new Set<string>();
  const out: string[] = [`${ind(0)}networks:`];
  const all: NetworkDef[] = [
    { name: PROJECT_NETWORK, driver: "bridge" },
    ...nets.filter((n) => n.name !== PROJECT_NETWORK),
  ];
  for (const n of all) {
    if (seen.has(n.name)) continue;
    seen.add(n.name);
    if (n.external) {
      out.push(`${ind(1)}${n.name}:`);
      out.push(`${ind(2)}external: true`);
    } else {
      out.push(`${ind(1)}${n.name}:`);
      if (n.driver && n.driver !== "bridge") {
        out.push(`${ind(2)}driver: ${n.driver}`);
      }
    }
  }
  return out;
};

const renderTopLevelVolumes = (vols: VolumeDef[], services: Record<string, ServiceOverride>): string[] => {
  const names = new Set<string>();
  for (const v of vols) names.add(v.name);
  for (const svc of Object.values(services)) {
    for (const v of svc.volumes ?? []) {
      if (!v.host.startsWith(".") && !v.host.startsWith("/")) {
        names.add(v.host);
      }
    }
  }
  if (!names.size) return [];
  const out: string[] = [`${ind(0)}volumes:`];
  for (const n of names) {
    const userDef = vols.find((v) => v.name === n);
    if (userDef?.external) {
      out.push(`${ind(1)}${n}:`);
      out.push(`${ind(2)}external: true`);
    } else {
      out.push(`${ind(1)}${n}:`);
    }
  }
  return out;
};

const renderTopLevelSecrets = (secrets: SecretDef[]): string[] => {
  if (!secrets.length) return [];
  const out: string[] = [`${ind(0)}secrets:`];
  for (const s of secrets) {
    out.push(`${ind(1)}${s.name}:`);
    if (s.source === "file") {
      out.push(`${ind(2)}file: ${yamlStr(s.file ?? `./secrets/${s.name}.txt`)}`);
    } else {
      out.push(`${ind(2)}environment: ${yamlStr(s.environment ?? s.name)}`);
    }
  }
  return out;
};

// ── Main entry: generateMicroserviceCompose ───────────────
export const generateMicroserviceCompose = (cfg: MicroserviceConfig): string => {
  const lines: string[] = [];
  lines.push(`# Generated by dockerfilegenerator.com`);
  lines.push(`# Architecture — ${Object.keys(cfg.services).length} service(s)`);
  if (cfg.description) lines.push(`# ${cfg.description}`);
  if (cfg.useEnvFile) {
    lines.push(`# Env values reference variables from .env (see .env.example).`);
  }
  lines.push("");
  lines.push(`name: ${cfg.projectName}`);
  lines.push("");

  // Services
  const serviceIds = Object.keys(cfg.services);
  if (!serviceIds.length) {
    lines.push("# No services configured. Pick a preset or add services to begin.");
    lines.push("");
    return lines.join("\n");
  }

  lines.push(`${ind(0)}services:`);
  serviceIds.forEach((id, i) => {
    if (i > 0) lines.push("");
    const resolved = resolveService(cfg.services[id]);
    lines.push(...renderService(resolved, cfg));
  });

  // Networks
  lines.push("");
  lines.push(...renderTopLevelNetworks(cfg.networks));

  // Volumes
  const volLines = renderTopLevelVolumes(cfg.volumes, cfg.services);
  if (volLines.length) {
    lines.push("");
    lines.push(...volLines);
  }

  // Secrets
  const secLines = renderTopLevelSecrets(cfg.secrets);
  if (secLines.length) {
    lines.push("");
    lines.push(...secLines);
  }

  lines.push("");
  return lines.join("\n");
};

// Re-export the version-selection type so consumers don't have to dig.
export type { VersionSelection };
