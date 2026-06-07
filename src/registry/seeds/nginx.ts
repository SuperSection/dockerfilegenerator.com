import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "nginx",
  label: "Nginx",
  description: "High-performance HTTP server and reverse proxy.",
  emoji: "🌐",
  category: "proxy",
  tags: ["proxy", "http", "tls"],
  image: "nginx",
  official: true,
  recommended: "1.27-alpine",
  latest: "1.27-alpine",
  versionSource: "sync",
  compose: {
    ports: [
      { host: 80, container: 80 },
      { host: 443, container: 443 },
    ],
    volumes: [
      { host: "./nginx.conf", container: "/etc/nginx/nginx.conf", readOnly: true },
      { host: "./html", container: "/usr/share/nginx/html", readOnly: true },
    ],
    env: [],
    hasHealthcheck: true,
    healthcheckCmd: ["wget", "--spider", "-q", "http://localhost/"],
    defaultRestart: "unless-stopped",
  },
};
