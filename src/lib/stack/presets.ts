/**
 * Stack Builder — preset definitions for Frontend × Backend × Database.
 * Each combination is a known, well-trodden pairing.
 */

export type Frontend = "react" | "nextjs" | "vue" | "nuxt";
export type Backend = "express" | "nestjs" | "fastapi" | "springboot";
export type Database = "postgres" | "mysql" | "mongodb";
export type Optional = "redis" | "rabbitmq" | "kafka" | "nginx";

export interface FrontendMeta {
  id: Frontend;
  name: string;
  emoji: string;
  framework: string;
  port: number;
  baseImage: string;
  workdir: string;
  buildCmd: string;
  startCmd: string;
}

export interface BackendMeta {
  id: Backend;
  name: string;
  emoji: string;
  language: string;
  port: number;
  baseImage: string;
  workdir: string;
  startCmd: string;
  env: { key: string; value: string }[];
  needsBuild: boolean;
  packageManager: string;
}

export interface DatabaseMeta {
  id: Database;
  name: string;
  emoji: string;
  port: number;
  image: string;
  tag: string;
  env: { key: string; value: string }[];
  volume: string;
  dependsOnEnvVar: string;
}

export interface OptionalMeta {
  id: Optional;
  name: string;
  emoji: string;
}

export const FRONTENDS: Record<Frontend, FrontendMeta> = {
  react: {
    id: "react",
    name: "React (Vite)",
    emoji: "⚛️",
    framework: "react",
    port: 5173,
    baseImage: "node:20-alpine",
    workdir: "/app",
    buildCmd: "npm run build",
    startCmd: "nginx -g 'daemon off;'",
  },
  nextjs: {
    id: "nextjs",
    name: "Next.js",
    emoji: "▲",
    framework: "nextjs",
    port: 3000,
    baseImage: "node:20-alpine",
    workdir: "/app",
    buildCmd: "npm run build",
    startCmd: "node server.js",
  },
  vue: {
    id: "vue",
    name: "Vue (Vite)",
    emoji: "🟢",
    framework: "vue",
    port: 5173,
    baseImage: "node:20-alpine",
    workdir: "/app",
    buildCmd: "npm run build",
    startCmd: "nginx -g 'daemon off;'",
  },
  nuxt: {
    id: "nuxt",
    name: "Nuxt",
    emoji: "💚",
    framework: "nuxt",
    port: 3000,
    baseImage: "node:20-alpine",
    workdir: "/app",
    buildCmd: "npm run build",
    startCmd: "node .output/server/index.mjs",
  },
};

export const BACKENDS: Record<Backend, BackendMeta> = {
  express: {
    id: "express",
    name: "Express",
    emoji: "🚂",
    language: "node",
    port: 3000,
    baseImage: "node:20-alpine",
    workdir: "/app",
    startCmd: "node dist/server.js",
    env: [{ key: "NODE_ENV", value: "production" }],
    needsBuild: true,
    packageManager: "npm",
  },
  nestjs: {
    id: "nestjs",
    name: "NestJS",
    emoji: "🐈",
    language: "node",
    port: 3000,
    baseImage: "node:20-alpine",
    workdir: "/app",
    startCmd: "node dist/main.js",
    env: [{ key: "NODE_ENV", value: "production" }],
    needsBuild: true,
    packageManager: "npm",
  },
  fastapi: {
    id: "fastapi",
    name: "FastAPI",
    emoji: "⚡",
    language: "python",
    port: 8000,
    baseImage: "python:3.12-slim",
    workdir: "/app",
    startCmd: "uvicorn main:app --host 0.0.0.0 --port 8000",
    env: [
      { key: "PYTHONUNBUFFERED", value: "1" },
      { key: "PYTHONDONTWRITEBYTECODE", value: "1" },
    ],
    needsBuild: false,
    packageManager: "pip",
  },
  springboot: {
    id: "springboot",
    name: "Spring Boot",
    emoji: "🍃",
    language: "java",
    port: 8080,
    baseImage: "eclipse-temurin:21-jre",
    workdir: "/app",
    startCmd: "java -jar app.jar",
    env: [],
    needsBuild: true,
    packageManager: "maven",
  },
};

export const DATABASES: Record<Database, DatabaseMeta> = {
  postgres: {
    id: "postgres",
    name: "PostgreSQL",
    emoji: "🐘",
    port: 5432,
    image: "postgres",
    tag: "16-alpine",
    env: [
      { key: "POSTGRES_USER", value: "app" },
      { key: "POSTGRES_PASSWORD", value: "changeme" },
      { key: "POSTGRES_DB", value: "app" },
    ],
    volume: "postgres_data:/var/lib/postgresql/data",
    dependsOnEnvVar: "DATABASE_URL",
  },
  mysql: {
    id: "mysql",
    name: "MySQL",
    emoji: "🐬",
    port: 3306,
    image: "mysql",
    tag: "8.0",
    env: [
      { key: "MYSQL_ROOT_PASSWORD", value: "changeme" },
      { key: "MYSQL_DATABASE", value: "app" },
    ],
    volume: "mysql_data:/var/lib/mysql",
    dependsOnEnvVar: "DATABASE_URL",
  },
  mongodb: {
    id: "mongodb",
    name: "MongoDB",
    emoji: "🍃",
    port: 27017,
    image: "mongo",
    tag: "7",
    env: [],
    volume: "mongo_data:/data/db",
    dependsOnEnvVar: "MONGO_URL",
  },
};

export const OPTIONALS: Record<Optional, OptionalMeta> = {
  redis: { id: "redis", name: "Redis", emoji: "🔴" },
  rabbitmq: { id: "rabbitmq", name: "RabbitMQ", emoji: "🐰" },
  kafka: { id: "kafka", name: "Kafka", emoji: "🟧" },
  nginx: { id: "nginx", name: "Nginx", emoji: "🌐" },
};

/** Env-var presets when combining selections. */
export const buildConnectionString = (db: Database): string => {
  switch (db) {
    case "postgres":
      return "postgresql://app:changeme@postgres:5432/app";
    case "mysql":
      return "mysql://root:changeme@mysql:3306/app";
    case "mongodb":
      return "mongodb://mongo:27017/app";
  }
};
