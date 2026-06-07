import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "rabbitmq",
  label: "RabbitMQ",
  description: "Reliable message broker with AMQP and STOMP.",
  emoji: "🐰",
  category: "queue",
  tags: ["queue", "amqp", "broker"],
  image: "rabbitmq",
  official: true,
  recommended: "4.0-management-alpine",
  latest: "4.0-management-alpine",
  versionSource: "sync",
  compose: {
    ports: [
      { host: 5672, container: 5672 },
      { host: 15672, container: 15672 },
    ],
    volumes: [{ host: "rabbitmq_data", container: "/var/lib/rabbitmq" }],
    env: [
      { key: "RABBITMQ_DEFAULT_USER", value: "guest" },
      { key: "RABBITMQ_DEFAULT_PASS", value: "guest" },
    ],
    hasHealthcheck: true,
    healthcheckCmd: ["rabbitmq-diagnostics", "ping"],
    defaultRestart: "unless-stopped",
    createsVolumes: ["rabbitmq_data"],
  },
};
