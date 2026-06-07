/**
 * Elasticsearch — image lives on docker.elastic.co, not Docker Hub.
 * Marked manual so the sync script's static overrides handle the tag.
 */
import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "elasticsearch",
  label: "Elasticsearch",
  description: "Distributed search and analytics engine.",
  emoji: "🔍",
  category: "search",
  tags: ["search", "analytics", "olap"],
  image: "docker.elastic.co/elasticsearch/elasticsearch",
  official: true,
  externalRegistry: "elastic",
  recommended: "8.13.0",
  latest: "8.15.0",
  versionSource: "manual",
  compose: {
    ports: [{ host: 9200, container: 9200 }],
    volumes: [{ host: "es_data", container: "/usr/share/elasticsearch/data" }],
    env: [
      { key: "discovery.type", value: "single-node" },
      { key: "xpack.security.enabled", value: "false" },
      { key: "ES_JAVA_OPTS", value: "-Xms512m -Xmx512m" },
    ],
    hasHealthcheck: true,
    healthcheckCmd: ["curl", "-fsS", "http://localhost:9200/_cluster/health"],
    defaultRestart: "unless-stopped",
    createsVolumes: ["es_data"],
  },
};
