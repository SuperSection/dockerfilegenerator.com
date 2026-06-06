/**
 * Docker Compose — service catalog.
 * Each service has a default config + UI fields for customization.
 */

export type ServiceCategory =
  | "application"
  | "database"
  | "cache"
  | "search"
  | "queue"
  | "proxy"
  | "storage"
  | "monitoring";

export interface PortMapping {
  container: number;
  host: number;
  protocol?: "tcp" | "udp";
}

export interface VolumeMount {
  host: string;
  container: string;
  readOnly?: boolean;
}

export interface EnvVar {
  key: string;
  value: string;
}

export interface ResourceLimit {
  cpus?: string;
  memory?: string;
}

export interface ServiceConfig {
  /** Stable identifier used in docker-compose.yml */
  name: string;
  /** Display label */
  label: string;
  category: ServiceCategory;
  description: string;
  emoji: string;
  /** Image (without tag) */
  image: string;
  /** Default tag */
  defaultTag: string;
  /** Default port mappings (host:container) */
  defaultPorts: PortMapping[];
  /** Default volumes */
  defaultVolumes: VolumeMount[];
  /** Default environment variables */
  defaultEnv: EnvVar[];
  /** Has built-in healthcheck */
  hasHealthcheck: boolean;
  /** Default healthcheck path/cmd */
  healthcheckCmd?: string[];
  healthcheckPath?: string;
  healthcheckPort?: number;
  /** Default restart policy */
  defaultRestart: "no" | "always" | "on-failure" | "unless-stopped";
  /** Default command override */
  defaultCommand?: string[];
  /** Service depends on these (by name) */
  dependsOn?: string[];
  /** Volumes created by this service (named) */
  createsVolumes?: string[];
  /** Whether this service typically runs an app (vs infra) */
  isApp?: boolean;
  /** UI-only category for grouping */
  tags?: string[];
}

export const SERVICES: Record<string, ServiceConfig> = {
  app: {
    name: "app",
    label: "Application",
    category: "application",
    description: "Your application service — points to a Dockerfile build.",
    emoji: "🚀",
    image: "./Dockerfile",
    defaultTag: "latest",
    defaultPorts: [{ host: 3000, container: 3000 }],
    defaultVolumes: [{ host: "./app", container: "/app" }],
    defaultEnv: [{ key: "NODE_ENV", value: "production" }],
    hasHealthcheck: false,
    defaultRestart: "unless-stopped",
    isApp: true,
  },
  postgres: {
    name: "postgres",
    label: "PostgreSQL",
    category: "database",
    description: "The world's most advanced open source relational database.",
    emoji: "🐘",
    image: "postgres",
    defaultTag: "16-alpine",
    defaultPorts: [{ host: 5432, container: 5432 }],
    defaultVolumes: [{ host: "postgres_data", container: "/var/lib/postgresql/data" }],
    defaultEnv: [
      { key: "POSTGRES_USER", value: "postgres" },
      { key: "POSTGRES_PASSWORD", value: "changeme" },
      { key: "POSTGRES_DB", value: "app" },
    ],
    hasHealthcheck: true,
    healthcheckCmd: ["pg_isready", "-U", "postgres"],
    defaultRestart: "unless-stopped",
    createsVolumes: ["postgres_data"],
  },
  mysql: {
    name: "mysql",
    label: "MySQL",
    category: "database",
    description: "Popular open source relational database.",
    emoji: "🐬",
    image: "mysql",
    defaultTag: "8.0",
    defaultPorts: [{ host: 3306, container: 3306 }],
    defaultVolumes: [{ host: "mysql_data", container: "/var/lib/mysql" }],
    defaultEnv: [
      { key: "MYSQL_ROOT_PASSWORD", value: "changeme" },
      { key: "MYSQL_DATABASE", value: "app" },
    ],
    hasHealthcheck: true,
    healthcheckCmd: ["mysqladmin", "ping", "-h", "localhost"],
    defaultRestart: "unless-stopped",
    createsVolumes: ["mysql_data"],
  },
  mariadb: {
    name: "mariadb",
    label: "MariaDB",
    category: "database",
    description: "Drop-in MySQL replacement with improved performance.",
    emoji: "🦭",
    image: "mariadb",
    defaultTag: "11",
    defaultPorts: [{ host: 3306, container: 3306 }],
    defaultVolumes: [{ host: "mariadb_data", container: "/var/lib/mysql" }],
    defaultEnv: [
      { key: "MARIADB_ROOT_PASSWORD", value: "changeme" },
      { key: "MARIADB_DATABASE", value: "app" },
    ],
    hasHealthcheck: true,
    healthcheckCmd: ["healthcheck.sh", "--connect", "--innodb_initialized"],
    defaultRestart: "unless-stopped",
    createsVolumes: ["mariadb_data"],
  },
  mongodb: {
    name: "mongodb",
    label: "MongoDB",
    category: "database",
    description: "Document-oriented NoSQL database.",
    emoji: "🍃",
    image: "mongo",
    defaultTag: "7",
    defaultPorts: [{ host: 27017, container: 27017 }],
    defaultVolumes: [{ host: "mongo_data", container: "/data/db" }],
    defaultEnv: [
      { key: "MONGO_INITDB_ROOT_USERNAME", value: "root" },
      { key: "MONGO_INITDB_ROOT_PASSWORD", value: "changeme" },
    ],
    hasHealthcheck: true,
    healthcheckCmd: ["mongosh", "--eval", "db.adminCommand('ping')"],
    defaultRestart: "unless-stopped",
    createsVolumes: ["mongo_data"],
  },
  redis: {
    name: "redis",
    label: "Redis",
    category: "cache",
    description: "In-memory cache, message broker, and key-value store.",
    emoji: "🔴",
    image: "redis",
    defaultTag: "7-alpine",
    defaultPorts: [{ host: 6379, container: 6379 }],
    defaultVolumes: [{ host: "redis_data", container: "/data" }],
    defaultEnv: [],
    hasHealthcheck: true,
    healthcheckCmd: ["redis-cli", "ping"],
    defaultRestart: "unless-stopped",
    createsVolumes: ["redis_data"],
  },
  elasticsearch: {
    name: "elasticsearch",
    label: "Elasticsearch",
    category: "search",
    description: "Distributed search and analytics engine.",
    emoji: "🔍",
    image: "docker.elastic.co/elasticsearch/elasticsearch",
    defaultTag: "8.13.0",
    defaultPorts: [{ host: 9200, container: 9200 }],
    defaultVolumes: [{ host: "es_data", container: "/usr/share/elasticsearch/data" }],
    defaultEnv: [
      { key: "discovery.type", value: "single-node" },
      { key: "xpack.security.enabled", value: "false" },
      { key: "ES_JAVA_OPTS", value: "-Xms512m -Xmx512m" },
    ],
    hasHealthcheck: true,
    healthcheckCmd: ["curl", "-fsS", "http://localhost:9200/_cluster/health"],
    defaultRestart: "unless-stopped",
    createsVolumes: ["es_data"],
  },
  rabbitmq: {
    name: "rabbitmq",
    label: "RabbitMQ",
    category: "queue",
    description: "Reliable message broker with AMQP and STOMP.",
    emoji: "🐰",
    image: "rabbitmq",
    defaultTag: "3.13-management-alpine",
    defaultPorts: [
      { host: 5672, container: 5672 },
      { host: 15672, container: 15672 },
    ],
    defaultVolumes: [{ host: "rabbitmq_data", container: "/var/lib/rabbitmq" }],
    defaultEnv: [
      { key: "RABBITMQ_DEFAULT_USER", value: "guest" },
      { key: "RABBITMQ_DEFAULT_PASS", value: "guest" },
    ],
    hasHealthcheck: true,
    healthcheckCmd: ["rabbitmq-diagnostics", "ping"],
    defaultRestart: "unless-stopped",
    createsVolumes: ["rabbitmq_data"],
  },
  kafka: {
    name: "kafka",
    label: "Kafka",
    category: "queue",
    description: "Distributed event streaming platform.",
    emoji: "🟧",
    // The official Apache image (apache/kafka) replaced the deprecated
    // bitnami/kafka image (no longer free on Docker Hub). The official image
    // uses the KAFKA_* env convention (underscores in env names become dots
    // in the property — e.g. KAFKA_NODE_ID → node.id) and ships with KRaft
    // as the default mode. Bitnami's KAFKA_CFG_* prefix is gone.
    // 3.9.2 is the latest 3.9.x patch (Feb 2026); 3.9.0 is also valid.
    image: "apache/kafka",
    defaultTag: "3.9.2",
    defaultPorts: [{ host: 9092, container: 9092 }],
    defaultVolumes: [{ host: "kafka_data", container: "/var/lib/kafka/data" }],
    defaultEnv: [
      // Single-node KRaft (combined broker+controller) configuration.
      // IMPORTANT: The official image's wrapper script throws on startup
      // if CLUSTER_ID is not set — it does NOT auto-generate one. We pin a
      // stable 22-char base64 id so the broker rejoins the same cluster on
      // restart (the formatted metadata is persisted in /var/lib/kafka/data).
      // Note: KAFKA_KRAFT_CLUSTER_ID is NOT a thing in this image — only
      // the bare CLUSTER_ID env var is read.
      { key: "KAFKA_NODE_ID", value: "1" },
      { key: "KAFKA_PROCESS_ROLES", value: "broker,controller" },
      { key: "KAFKA_LISTENERS", value: "PLAINTEXT://:9092,CONTROLLER://:9093" },
      { key: "KAFKA_ADVERTISED_LISTENERS", value: "PLAINTEXT://kafka:9092" },
      { key: "KAFKA_CONTROLLER_LISTENER_NAMES", value: "CONTROLLER" },
      { key: "KAFKA_LISTENER_SECURITY_PROTOCOL_MAP", value: "CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT" },
      { key: "KAFKA_INTER_BROKER_LISTENER_NAME", value: "PLAINTEXT" },
      { key: "KAFKA_CONTROLLER_QUORUM_VOTERS", value: "1@kafka:9093" },
      // Single-node cluster — internal topics must have replication factor 1,
      // otherwise the broker hangs waiting for a second replica forever.
      { key: "KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR", value: "1" },
      { key: "KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR", value: "1" },
      { key: "KAFKA_TRANSACTION_STATE_LOG_MIN_ISR", value: "1" },
      { key: "KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS", value: "0" },
      { key: "CLUSTER_ID", value: "MkU3OEVBNTcwNTJENDM2Qk" },
    ],
    hasHealthcheck: true,
    healthcheckCmd: ["CMD-SHELL", "kafka-broker-api-versions.sh --bootstrap-server localhost:9092 >/dev/null 2>&1"],
    defaultRestart: "unless-stopped",
    createsVolumes: ["kafka_data"],
  },
  nginx: {
    name: "nginx",
    label: "Nginx",
    category: "proxy",
    description: "High-performance HTTP server and reverse proxy.",
    emoji: "🌐",
    image: "nginx",
    defaultTag: "1.27-alpine",
    defaultPorts: [
      { host: 80, container: 80 },
      { host: 443, container: 443 },
    ],
    defaultVolumes: [
      { host: "./nginx.conf", container: "/etc/nginx/nginx.conf", readOnly: true },
      { host: "./html", container: "/usr/share/nginx/html", readOnly: true },
    ],
    defaultEnv: [],
    hasHealthcheck: true,
    healthcheckCmd: ["wget", "--spider", "-q", "http://localhost/"],
    defaultRestart: "unless-stopped",
  },
  traefik: {
    name: "traefik",
    label: "Traefik",
    category: "proxy",
    description: "Modern reverse proxy with automatic service discovery.",
    emoji: "🦌",
    image: "traefik",
    defaultTag: "v3.1",
    defaultPorts: [
      { host: 80, container: 80 },
      { host: 443, container: 443 },
      { host: 8080, container: 8080 },
    ],
    defaultVolumes: [
      { host: "/var/run/docker.sock", container: "/var/run/docker.sock", readOnly: true },
      { host: "./traefik", container: "/etc/traefik" },
    ],
    defaultEnv: [],
    hasHealthcheck: false,
    defaultRestart: "unless-stopped",
  },
  minio: {
    name: "minio",
    label: "MinIO",
    category: "storage",
    description: "S3-compatible object storage.",
    emoji: "🪣",
    image: "minio/minio",
    defaultTag: "latest",
    defaultPorts: [
      { host: 9000, container: 9000 },
      { host: 9001, container: 9001 },
    ],
    defaultVolumes: [{ host: "minio_data", container: "/data" }],
    defaultEnv: [
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

export const SERVICE_LIST = Object.values(SERVICES);
export const SERVICE_IDS = Object.keys(SERVICES);

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  application: "Application",
  database: "Databases",
  cache: "Cache",
  search: "Search",
  queue: "Message Queue",
  proxy: "Reverse Proxy",
  storage: "Storage",
  monitoring: "Monitoring",
};

export const CATEGORY_ORDER: ServiceCategory[] = [
  "application",
  "database",
  "cache",
  "search",
  "queue",
  "proxy",
  "storage",
  "monitoring",
];
