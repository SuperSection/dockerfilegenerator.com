/**
 * Grafana — dashboards, visualization, and alerting UI.
 */
import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "grafana",
  label: "Grafana",
  description: "Metrics dashboards and visualization platform.",
  emoji: "📊",
  category: "monitoring",
  tags: ["monitoring", "dashboard", "metrics", "viz"],
  image: "grafana/grafana",
  official: true,
  recommended: "11.2.0",
  latest: "11.3.0",
  versionSource: "sync",
  compose: {
    ports: [{ host: 3000, container: 3000 }],
    volumes: [
      { host: "grafana_data", container: "/var/lib/grafana" },
      { host: "./grafana/provisioning", container: "/etc/grafana/provisioning", readOnly: true },
    ],
    env: [
      { key: "GF_SECURITY_ADMIN_USER", value: "admin" },
      { key: "GF_SECURITY_ADMIN_PASSWORD", value: "changeme" },
    ],
    hasHealthcheck: true,
    healthcheckCmd: ["CMD-SHELL", "wget --spider -q http://localhost:3000/api/health || exit 1"],
    defaultRestart: "unless-stopped",
    createsVolumes: ["grafana_data"],
  },
};
