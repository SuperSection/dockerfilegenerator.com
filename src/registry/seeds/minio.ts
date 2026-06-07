import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "minio",
  label: "MinIO",
  description: "S3-compatible object storage.",
  emoji: "🪣",
  category: "storage",
  tags: ["s3", "object-storage"],
  image: "minio/minio",
  official: true,
  recommended: "RELEASE.2024-10-13T13-34-11Z",
  latest: "RELEASE.2024-10-13T13-34-11Z",
  versionSource: "sync",
  compose: {
    ports: [
      { host: 9000, container: 9000 },
      { host: 9001, container: 9001 },
    ],
    volumes: [{ host: "minio_data", container: "/data" }],
    env: [
      { key: "MINIO_ROOT_USER", value: "minioadmin" },
      { key: "MINIO_ROOT_PASSWORD", value: "changeme" },
    ],
    hasHealthcheck: true,
    healthcheckCmd: ["curl", "-f", "http://localhost:9000/minio/health/live"],
    defaultRestart: "unless-stopped",
    defaultCommand: ["server", "/data", "--console-address", ":9001"],
    createsVolumes: ["minio_data"],
  },
};
