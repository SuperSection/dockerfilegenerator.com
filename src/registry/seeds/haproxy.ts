/**
 * HAProxy — L4/L7 load balancer.
 */
import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "haproxy",
  label: "HAProxy",
  description: "L4/L7 load balancer, classic TCP-mode reverse proxy.",
  emoji: "🔀",
  category: "proxy",
  tags: ["proxy", "load-balancer", "l4", "l7"],
  image: "haproxy",
  official: true,
  recommended: "3.0-alpine",
  latest: "3.0",
  versionSource: "sync",
  compose: {
    ports: [{ host: 80, container: 80 }, { host: 8404, container: 8404 }],
    volumes: [{ host: "./haproxy.cfg", container: "/usr/local/etc/haproxy/haproxy.cfg", readOnly: true }],
    env: [],
    hasHealthcheck: true,
    healthcheckCmd: ["stat", "-c", "%{http_code}", "http://localhost:8404/"],
    defaultRestart: "unless-stopped",
  },
};
