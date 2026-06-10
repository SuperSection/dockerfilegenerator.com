/**
 * Kong Gateway — plugin-driven API gateway.
 */
import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "kong",
  label: "Kong Gateway",
  description: "Plugin-driven API gateway. Requires a Postgres database.",
  emoji: "🦍",
  category: "proxy",
  tags: ["proxy", "api-gateway", "plugins"],
  image: "kong",
  official: true,
  recommended: "3.8-alpine",
  latest: "3.8",
  versionSource: "sync",
  compose: {
    ports: [{ host: 8000, container: 8000 }, { host: 8443, container: 8443 }, { host: 8001, container: 8001 }],
    volumes: [],
    env: [
      { key: "KONG_DATABASE", value: "off" },
      { key: "KONG_DECLARATIVE_CONFIG", value: "/etc/kong/kong.yml" },
      { key: "KONG_ADMIN_LISTEN", value: "0.0.0.0:8001" },
    ],
    hasHealthcheck: true,
    healthcheckCmd: ["CMD-SHELL", "kong health || exit 1"],
    defaultRestart: "unless-stopped",
  },
};
