/**
 * Envoy Proxy — service-mesh data plane and edge proxy.
 */
import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "envoy",
  label: "Envoy",
  description: "Cloud-native L7 proxy and service-mesh data plane.",
  emoji: "🛰️",
  category: "proxy",
  tags: ["proxy", "service-mesh", "l7", "xds"],
  image: "envoyproxy/envoy",
  official: true,
  recommended: "v1.31-alpine",
  latest: "v1.31",
  versionSource: "sync",
  compose: {
    ports: [{ host: 10000, container: 10000 }, { host: 9901, container: 9901 }],
    volumes: [{ host: "./envoy.yaml", container: "/etc/envoy/envoy.yaml", readOnly: true }],
    env: [],
    hasHealthcheck: true,
    healthcheckCmd: ["CMD-SHELL", "wget --spider -q http://localhost:9901/ready || exit 1"],
    defaultRestart: "unless-stopped",
  },
};
