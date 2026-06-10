/**
 * Microservice Builder — architecture presets.
 *
 * One-click templates that pre-fill the service list with a sensible
 * arrangement. Each preset returns a list of `ServiceOverride` shapes
 * keyed by id, ready to be assigned to `cfg.services`.
 */

import type { ServiceOverride } from "./schema";
import { getService } from "../../registry";

export interface ArchitecturePreset {
  id: string;
  label: string;
  emoji: string;
  description: string;
  /** Returns the services to install. Caller is responsible for
   *  confirming before clobbering an existing list. */
  services: () => Record<string, ServiceOverride>;
}

const baseApp = (id: string, framework: string, port: number): ServiceOverride => ({
  id,
  framework: framework as ServiceOverride["framework"],
  category: "application",
  ports: [{ host: port, container: port }],
  healthCheck: {
    test: ["CMD", "wget", "--spider", "-q", `http://localhost:${port}/health`],
    interval: "30s",
    timeout: "3s",
    retries: 3,
    startPeriod: "40s",
  },
  restart: "unless-stopped",
  init: true,
  build: { context: `./${id}` },
});

const baseInfra = (id: string, category: ServiceOverride["category"]): ServiceOverride => {
  const reg = getService(id);
  return {
    id,
    category,
    image: reg?.image,
    tag: reg?.recommended,
    ports: (reg?.compose.ports as any[]) ?? [],
    volumes: (reg?.compose.volumes as any[]) ?? [],
    envVars: (reg?.compose.env as any[]) ?? [],
    healthCheck: reg?.compose.hasHealthcheck
      ? { test: ["CMD", ...(reg.compose.healthcheckCmd ?? [])], interval: "30s", timeout: "10s", retries: 3 }
      : undefined,
    restart: (reg?.compose.defaultRestart as any) ?? "unless-stopped",
  };
};

export const ARCHITECTURE_PRESETS: Record<string, ArchitecturePreset> = {
  monolith: {
    id: "monolith",
    label: "Monolith",
    emoji: "🧱",
    description: "Single application service + database + cache.",
    services: () => ({
      app: baseApp("app", "node", 3000),
      postgres: baseInfra("postgres", "database"),
      redis: baseInfra("redis", "cache"),
    }),
  },

  frontendApi: {
    id: "frontendApi",
    label: "Frontend + API",
    emoji: "🧩",
    description: "Two-tier: a frontend service and a backend API sharing a database.",
    services: () => ({
      frontend: baseApp("frontend", "nextjs", 3000),
      backend: baseApp("backend", "express", 4000),
      postgres: baseInfra("postgres", "database"),
      redis: baseInfra("redis", "cache"),
    }),
  },

  threeTier: {
    id: "threeTier",
    label: "Three-tier",
    emoji: "🏗️",
    description: "Frontend + API + business logic service + database.",
    services: () => ({
      frontend: baseApp("frontend", "react", 3000),
      api: baseApp("api", "express", 4000),
      core: baseApp("core", "fastapi", 8000),
      postgres: baseInfra("postgres", "database"),
      redis: baseInfra("redis", "cache"),
    }),
  },

  microservices: {
    id: "microservices",
    label: "Microservices",
    emoji: "🕸️",
    description: "Gateway + auth + core service, backed by Postgres and Redis.",
    services: () => ({
      gateway: baseApp("gateway", "node", 8080),
      auth: baseApp("auth", "node", 7000),
      core: baseApp("core", "fastapi", 8000),
      postgres: baseInfra("postgres", "database"),
      redis: baseInfra("redis", "cache"),
    }),
  },

  eventDriven: {
    id: "eventDriven",
    label: "Event-driven",
    emoji: "📨",
    description: "API + multiple workers consuming from a Kafka topic.",
    services: () => {
      const worker = (id: string, port: number | null): ServiceOverride => ({
        id,
        framework: "python",
        category: "application",
        ports: port ? [{ host: port, container: port }] : [],
        healthCheck: port
          ? {
              test: ["CMD", "wget", "--spider", "-q", `http://localhost:${port}/health`],
              interval: "30s",
              timeout: "3s",
              retries: 3,
            }
          : { test: ["CMD", "true"], interval: "30s", timeout: "3s", retries: 3 },
        restart: "unless-stopped",
        init: true,
        build: { context: `./${id}` },
        dependsOn: ["kafka"],
      });
      return {
        api: baseApp("api", "node", 3000),
        worker1: worker("worker1", null),
        worker2: worker("worker2", null),
        kafka: baseInfra("kafka", "queue"),
        postgres: baseInfra("postgres", "database"),
      };
    },
  },
};

export const PRESET_LIST: ReadonlyArray<ArchitecturePreset> = Object.values(ARCHITECTURE_PRESETS);
