/**
 * Caddy — automatic-HTTPS reverse proxy.
 */
import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "caddy",
  label: "Caddy",
  description: "Reverse proxy with automatic HTTPS via Let's Encrypt.",
  emoji: "🟢",
  category: "proxy",
  tags: ["proxy", "reverse-proxy", "https", "lets-encrypt"],
  image: "caddy",
  official: true,
  recommended: "2-alpine",
  latest: "2",
  versionSource: "sync",
  compose: {
    ports: [{ host: 80, container: 80 }, { host: 443, container: 443 }, { host: 2019, container: 2019 }],
    volumes: [
      { host: "caddy_data", container: "/data" },
      { host: "caddy_config", container: "/config" },
      { host: "./Caddyfile", container: "/etc/caddy/Caddyfile", readOnly: true },
    ],
    env: [],
    hasHealthcheck: true,
    healthcheckCmd: ["CMD-SHELL", "wget --spider -q http://localhost:2019/config/ || exit 1"],
    defaultRestart: "unless-stopped",
    createsVolumes: ["caddy_data", "caddy_config"],
  },
};
