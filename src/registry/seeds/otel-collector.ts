/**
 * OpenTelemetry Collector — vendor-agnostic telemetry pipeline.
 */
import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "otel-collector",
  label: "OpenTelemetry Collector",
  description: "Vendor-agnostic pipeline for traces, metrics, and logs.",
  emoji: "🧭",
  category: "observability",
  tags: ["otel", "tracing", "metrics", "logs"],
  image: "otel/opentelemetry-collector-contrib",
  official: true,
  recommended: "0.110.0",
  latest: "0.111.0",
  versionSource: "sync",
  compose: {
    ports: [
      { host: 4317, container: 4317 },
      { host: 4318, container: 4318 },
    ],
    volumes: [
      { host: "./otel-collector-config.yaml", container: "/etc/otelcol-contrib/config.yaml", readOnly: true },
    ],
    env: [],
    hasHealthcheck: true,
    healthcheckCmd: ["CMD-SHELL", "wget --spider -q http://localhost:13133/ || exit 1"],
    defaultRestart: "unless-stopped",
  },
};
