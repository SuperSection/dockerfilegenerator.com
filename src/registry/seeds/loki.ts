/**
 * Loki — log aggregation system, designed to pair with Grafana.
 */
import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "loki",
  label: "Loki",
  description: "Log aggregation system that pairs with Grafana.",
  emoji: "🪵",
  category: "observability",
  tags: ["logs", "aggregation", "grafana"],
  image: "grafana/loki",
  official: true,
  recommended: "3.3.0",
  latest: "3.4.0",
  versionSource: "sync",
  compose: {
    ports: [{ host: 3100, container: 3100 }],
    volumes: [
      { host: "loki_data", container: "/loki" },
      { host: "./loki-config.yaml", container: "/etc/loki/local-config.yaml", readOnly: true },
    ],
    env: [],
    hasHealthcheck: true,
    healthcheckCmd: ["CMD-SHELL", "wget --spider -q http://localhost:3100/ready || exit 1"],
    defaultRestart: "unless-stopped",
    createsVolumes: ["loki_data"],
  },
};
