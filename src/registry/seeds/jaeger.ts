/**
 * Jaeger — distributed tracing platform.
 */
import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "jaeger",
  label: "Jaeger",
  description: "End-to-end distributed tracing for microservices.",
  emoji: "🕵️",
  category: "observability",
  tags: ["tracing", "observability", "opentelemetry"],
  image: "jaegertracing/all-in-one",
  official: true,
  recommended: "1.62",
  latest: "1.63",
  versionSource: "sync",
  compose: {
    ports: [
      { host: 16686, container: 16686 },
      { host: 14250, container: 14250 },
      { host: 14268, container: 14268 },
      { host: 4317, container: 4317 },
      { host: 4318, container: 4318 },
    ],
    volumes: [],
    env: [
      { key: "COLLECTOR_OTLP_ENABLED", value: "true" },
    ],
    hasHealthcheck: true,
    healthcheckCmd: ["CMD-SHELL", "wget --spider -q http://localhost:14269/ || exit 1"],
    defaultRestart: "unless-stopped",
  },
};
