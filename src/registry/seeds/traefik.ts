import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "traefik",
  label: "Traefik",
  description: "Modern reverse proxy with automatic service discovery.",
  emoji: "🦌",
  category: "proxy",
  tags: ["proxy", "service-discovery", "letsencrypt"],
  image: "traefik",
  official: true,
  recommended: "v3.1",
  latest: "v3.2",
  versionSource: "sync",
  compose: {
    ports: [
      { host: 80, container: 80 },
      { host: 443, container: 443 },
      { host: 8080, container: 8080 },
    ],
    volumes: [
      { host: "/var/run/docker.sock", container: "/var/run/docker.sock", readOnly: true },
      { host: "./traefik", container: "/etc/traefik" },
    ],
    env: [],
    hasHealthcheck: false,
    defaultRestart: "unless-stopped",
  },
};
