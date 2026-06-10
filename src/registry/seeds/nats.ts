/**
 * NATS — lightweight, high-performance messaging system.
 */
import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "nats",
  label: "NATS",
  description: "Lightweight, high-performance pub/sub and request/reply.",
  emoji: "✈️",
  category: "queue",
  tags: ["queue", "pubsub", "messaging"],
  image: "nats",
  official: true,
  recommended: "2.10-alpine",
  latest: "2.10-alpine",
  versionSource: "sync",
  compose: {
    ports: [
      { host: 4222, container: 4222 },
      { host: 8222, container: 8222 },
      { host: 6222, container: 6222 },
    ],
    volumes: [{ host: "nats_data", container: "/data" }],
    env: [],
    hasHealthcheck: true,
    healthcheckCmd: ["CMD-SHELL", "wget --spider -q http://localhost:8222/ || exit 1"],
    defaultRestart: "unless-stopped",
    createsVolumes: ["nats_data"],
  },
};
