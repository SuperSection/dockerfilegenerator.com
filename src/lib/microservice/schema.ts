/**
 * Microservice Builder — schema.
 *
 * The load-bearing type for the N-service builder. Every generator
 * (compose, env, dockerfile, readme) and every UI consumer
 * (StackBuilder → MicroserviceBuilder, ServiceConfigModal) flows
 * through these types. The legacy `ServiceOverride` in
 * `src/lib/compose/generator.ts` is re-typed as `Pick<MicroserviceServiceOverride, ...>`
 * for back-compat with the existing Compose Generator.
 */

import type { FrameworkId } from "../dockerfile/frameworks";
import type { VersionSelection } from "~/registry";

// ── Categories ────────────────────────────────────────────
// Mirrors the registry's ServiceCategory. Kept in this file as
// a stable export so the UI doesn't depend on the registry's
// internals.
export type ServiceCategory =
  | "application"
  | "database"
  | "cache"
  | "search"
  | "queue"
  | "proxy"
  | "storage"
  | "monitoring"
  | "auth"
  | "observability"
  | "ci-dev";

// ── Resources & security ──────────────────────────────────
export interface ResourceLimit {
  cpus?: string;     // e.g. "0.5", "1.5"
  memory?: string;   // e.g. "512M", "2G"
  pidsLimit?: number;
}

export type SecurityPreset = "relaxed" | "hardened" | "custom";

export interface SecurityConfig {
  preset: SecurityPreset;
  user?: string;                   // "1000:1000"
  readOnly?: boolean;
  capAdd?: string[];
  capDrop?: string[];              // default ["ALL"] when hardened
  securityOpt?: string[];          // default ["no-new-privileges:true"] when hardened
  ulimits?: { name: string; soft: number; hard: number }[];
  tmpfs?: string[];                // default ["/tmp","/run"] when readOnly
  privileged?: boolean;
}

// ── Healthcheck ───────────────────────────────────────────
export interface HealthcheckOverride {
  test?: string[];                 // exec form
  interval?: string;               // default "30s"
  timeout?: string;                // default "10s"
  retries?: number;
  startPeriod?: string;            // default "30s" db / "40s" app
  disable?: boolean;
}

// ── Secrets ───────────────────────────────────────────────
export interface SecretMount {
  name: string;
  /** secret definition name (must match a SecretDef.name) */
  source: string;
  target?: string;                 // default /run/secrets/<source>
  uid?: string;
  gid?: string;
  mode?: number;                   // 0o400 default
}

export type SecretSource = "file" | "environment";

export interface SecretDef {
  name: string;
  source: SecretSource;
  file?: string;                   // when source=file
  environment?: string;            // when source=environment
}

// ── Labels & logging ──────────────────────────────────────
export interface LabelDef {
  key: string;
  value: string;
}

export interface LoggingConfig {
  driver: string;                  // json-file | local | none | syslog | journald | fluentd
  options?: Record<string, string>;
}

// ── Ports ─────────────────────────────────────────────────
export interface PortMapping {
  host: number;
  container: number;
  protocol?: "tcp" | "udp";
}

// ── Env ───────────────────────────────────────────────────
export type EnvValueKind = "literal" | "interpolation" | "secret-ref";

export interface EnvVar {
  key: string;
  value: string;
  kind?: EnvValueKind;             // default "literal"
  /** when kind=secret-ref, the SecretDef name this references */
  secretName?: string;
}

// ── Build (only for application services) ─────────────────
export interface BuildConfig {
  context: string;                 // path, e.g. "./services/api"
  dockerfile?: string;             // default "Dockerfile"
  target?: string;                 // multi-stage target
  args?: Record<string, string>;
}

// ── Networks & volumes (project-level) ───────────────────
export interface NetworkAttachment {
  name: string;
  aliases?: string[];
}

export interface NetworkDef {
  name: string;
  driver?: string;                 // default "bridge"
  external?: boolean;
}

export interface VolumeDef {
  name: string;
  external?: boolean;
  driverOpts?: Record<string, string>;
}

// ── Service override (the big one) ────────────────────────
export interface ServiceOverride {
  // Identity
  id: string;                       // DNS-1123, ≤63 chars, validated
  displayName?: string;             // free-form for the card UI
  category?: ServiceCategory;
  framework?: FrameworkId;          // only for application services
  description?: string;

  // Image / build
  image?: string;                   // override registry default
  tag?: string;
  tagSelection?: VersionSelection;
  build?: BuildConfig;              // when set, no image: emitted

  // Networking
  ports?: PortMapping[];
  expose?: number[];                // internal-only ports
  networks?: NetworkAttachment[];

  // Env
  envVars?: EnvVar[];
  envFile?: string[];

  // Healthcheck
  healthCheck?: HealthcheckOverride;

  // Resources & security
  resources?: ResourceLimit;
  security?: SecurityConfig;

  // Lifecycle
  restart?: "no" | "always" | "on-failure" | "unless-stopped";
  init?: boolean;                   // default true for application
  stopGracePeriod?: string;

  // Storage
  volumes?: { host: string; container: string; readOnly?: boolean }[];

  // Profiles & secrets
  profiles?: string[];              // default [] = always-on
  secrets?: SecretMount[];

  // Observability
  labels?: LabelDef[];
  logging?: LoggingConfig;

  // Compose-level
  containerName?: string;
  command?: string[];
  workingDir?: string;
  platform?: "linux/amd64" | "linux/arm64";

  // Free-form depends_on (string ids of other services). The generator
  // resolves these into the long-form `condition: service_healthy`.
  dependsOn?: string[];
}

// ── Project-level config ─────────────────────────────────
export interface MicroserviceConfig {
  projectName: string;              // also `name:` at top
  description?: string;
  useEnvFile: boolean;              // emit ${KEY} vs inline
  composeFileName?: "compose.yaml" | "docker-compose.yml";
  services: Record<string, ServiceOverride>;
  networks: NetworkDef[];
  volumes:  VolumeDef[];
  secrets:  SecretDef[];
  /** When true (default), the generator refuses to emit a `:latest`
   * tag. User can opt out for dev environments. */
  pinAllTags?: boolean;
}

// ── Validation surface ────────────────────────────────────
export type ValidationLevel = "error" | "warning" | "info";

export interface ValidationIssue {
  level: ValidationLevel;
  service?: string;
  title: string;
  message: string;
}
