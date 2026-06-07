import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "mysql",
  label: "MySQL",
  description: "Popular open source relational database.",
  emoji: "🐬",
  category: "database",
  tags: ["sql", "relational"],
  image: "mysql",
  official: true,
  recommended: "8.4",
  latest: "8.4",
  versionSource: "sync",
  compose: {
    ports: [{ host: 3306, container: 3306 }],
    volumes: [{ host: "mysql_data", container: "/var/lib/mysql" }],
    env: [
      { key: "MYSQL_ROOT_PASSWORD", value: "changeme" },
      { key: "MYSQL_DATABASE", value: "app" },
    ],
    hasHealthcheck: true,
    healthcheckCmd: ["mysqladmin", "ping", "-h", "localhost"],
    defaultRestart: "unless-stopped",
    createsVolumes: ["mysql_data"],
  },
};
