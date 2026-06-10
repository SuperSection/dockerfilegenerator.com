/**
 * Prometheus — metrics collection and alerting.
 */
import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "prometheus",
  label: "Prometheus",
  description: "Metrics-based monitoring and alerting server.",
  emoji: "🔥",
  category: "monitoring",
  tags: ["monitoring", "metrics", "alerting", "promql"],
  image: "prom/prometheus",
  official: true,
  recommended: "v2.54.1",
  latest: "v2.55.0",
  versionSource: "sync",
  compose: {
    ports: [{ host: 9090, container: 9090 }],
    volumes: [
      { host: "prometheus_data", container: "/prometheus" },
      { host: "./prometheus.yml", container: "/etc/prometheus/prometheus.yml", readOnly: true },
    ],
    env: [],
    hasHealthcheck: true,
    healthcheckCmd: ["CMD-SHELL", "wget --spider -q http://localhost:9090/-/ready || exit 1"],
    defaultRestart: "unless-stopped",
    createsVolumes: ["prometheus_data"],
  },
};
