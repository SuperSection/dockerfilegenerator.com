/**
 * Apache Kafka — the upstream Apache image replaced the deprecated
 * bitnami/kafka image. KAFKA_* env convention (underscores become
 * dots in the property). 3.9.2 is the latest 3.9.x patch; we hand-pin
 * until apache/kafka tags are stable on Docker Hub.
 */
import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "kafka",
  label: "Kafka",
  description: "Distributed event streaming platform.",
  emoji: "🟧",
  category: "queue",
  tags: ["queue", "streaming", "event"],
  image: "apache/kafka",
  official: true,
  recommended: "3.9.2",
  latest: "3.9.2",
  versionSource: "manual",
  compose: {
    ports: [{ host: 9092, container: 9092 }],
    volumes: [{ host: "kafka_data", container: "/var/lib/kafka/data" }],
    env: [
      { key: "KAFKA_NODE_ID", value: "1" },
      { key: "KAFKA_PROCESS_ROLES", value: "broker,controller" },
      { key: "KAFKA_LISTENERS", value: "PLAINTEXT://:9092,CONTROLLER://:9093" },
      { key: "KAFKA_ADVERTISED_LISTENERS", value: "PLAINTEXT://kafka:9092" },
      { key: "KAFKA_CONTROLLER_LISTENER_NAMES", value: "CONTROLLER" },
      { key: "KAFKA_LISTENER_SECURITY_PROTOCOL_MAP", value: "CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT" },
      { key: "KAFKA_INTER_BROKER_LISTENER_NAME", value: "PLAINTEXT" },
      { key: "KAFKA_CONTROLLER_QUORUM_VOTERS", value: "1@kafka:9093" },
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
};
