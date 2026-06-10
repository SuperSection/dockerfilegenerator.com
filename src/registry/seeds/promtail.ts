/**
 * Promtail — log shipper that ships logs to Loki.
 */
import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "promtail",
  label: "Promtail",
  description: "Log shipping agent that tails container logs to Loki.",
  emoji: "🪓",
  category: "observability",
  tags: ["logs", "shipper", "loki"],
  image: "grafana/promtail",
  official: true,
  recommended: "3.3.0",
  latest: "3.4.0",
  versionSource: "sync",
  compose: {
    ports: [],
    volumes: [
      { host: "/var/lib/docker/containers", container: "/var/lib/docker/containers", readOnly: true },
      { host: "/var/run/docker.sock", container: "/var/run/docker.sock", readOnly: true },
      { host: "./promtail-config.yaml", container: "/etc/promtail/config.yml", readOnly: true },
    ],
    env: [],
    hasHealthcheck: false,
    defaultRestart: "unless-stopped",
  },
};
