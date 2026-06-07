import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "mariadb",
  label: "MariaDB",
  description: "Drop-in MySQL replacement with improved performance.",
  emoji: "🦭",
  category: "database",
  tags: ["sql", "relational", "mysql-compatible"],
  image: "mariadb",
  official: true,
  recommended: "11.4",
  latest: "11.4",
  versionSource: "sync",
  compose: {
    ports: [{ host: 3306, container: 3306 }],
    volumes: [{ host: "mariadb_data", container: "/var/lib/mysql" }],
    env: [
      { key: "MARIADB_ROOT_PASSWORD", value: "changeme" },
      { key: "MARIADB_DATABASE", value: "app" },
    ],
    hasHealthcheck: true,
    healthcheckCmd: ["healthcheck.sh", "--connect", "--innodb_initialized"],
    defaultRestart: "unless-stopped",
    createsVolumes: ["mariadb_data"],
  },
};
