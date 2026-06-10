/**
 * Dockerfile Generator — Framework & language registry.
 * Each entry has a smart template generator + metadata.
 */

export type FrameworkId =
  | "node"
  | "express"
  | "nestjs"
  | "nextjs"
  | "react"
  | "vue"
  | "fastify"
  | "python"
  | "django"
  | "fastapi"
  | "flask"
  | "java"
  | "springboot"
  | "quarkus"
  | "go"
  | "gin"
  | "rust"
  | "actix"
  | "php"
  | "laravel"
  | "rails"
  | "dotnet"
  | "phoenix";

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun" | "pip" | "poetry" | "uv" | "pipenv" | "maven" | "gradle" | "go" | "cargo" | "composer";

export interface FrameworkMeta {
  id: FrameworkId;
  name: string;
  language: string;
  emoji: string;
  description: string;
  defaultPort: number;
  defaultWorkdir: string;
  defaultPackageManager: PackageManager;
  supportsMultiStage: boolean;
  supportsStandalone: boolean;
  defaultBaseImage: string;
  recommendedBaseImage: string;
  startCommand?: string;
  baseImageAlternatives?: string[];
  buildOptimizations?: string[];
}

export const FRAMEWORKS: Record<FrameworkId, FrameworkMeta> = {
  node: {
    id: "node",
    name: "Node.js",
    language: "JavaScript",
    emoji: "🟩",
    description: "Generic Node.js application with multi-stage build.",
    defaultPort: 3000,
    defaultWorkdir: "/app",
    defaultPackageManager: "npm",
    supportsMultiStage: true,
    supportsStandalone: false,
    defaultBaseImage: "node:20-alpine",
    recommendedBaseImage: "node:20-alpine",
    startCommand: "node server.js",
    baseImageAlternatives: ["node:20-slim", "node:22-alpine", "node:18-alpine"],
  },
  express: {
    id: "express",
    name: "Express",
    language: "JavaScript",
    emoji: "🚂",
    description: "Express.js server with production-ready multi-stage build.",
    defaultPort: 3000,
    defaultWorkdir: "/app",
    defaultPackageManager: "npm",
    supportsMultiStage: true,
    supportsStandalone: false,
    defaultBaseImage: "node:20-alpine",
    recommendedBaseImage: "node:20-alpine",
    startCommand: "node server.js",
  },
  nestjs: {
    id: "nestjs",
    name: "NestJS",
    language: "TypeScript",
    emoji: "🐈",
    description: "NestJS with build step, dist output.",
    defaultPort: 3000,
    defaultWorkdir: "/app",
    defaultPackageManager: "npm",
    supportsMultiStage: true,
    supportsStandalone: false,
    defaultBaseImage: "node:20-alpine",
    recommendedBaseImage: "node:20-alpine",
    startCommand: "node dist/main",
  },
  nextjs: {
    id: "nextjs",
    name: "Next.js",
    language: "TypeScript",
    emoji: "▲",
    description: "Next.js with standalone output for minimal image size.",
    defaultPort: 3000,
    defaultWorkdir: "/app",
    defaultPackageManager: "npm",
    supportsMultiStage: true,
    supportsStandalone: true,
    defaultBaseImage: "node:20-alpine",
    recommendedBaseImage: "node:20-alpine",
    startCommand: "node server.js",
    buildOptimizations: ["standalone", "output-file-tracing"],
  },
  react: {
    id: "react",
    name: "React (Vite)",
    language: "TypeScript",
    emoji: "⚛️",
    description: "Static React app served by nginx.",
    defaultPort: 80,
    defaultWorkdir: "/app",
    defaultPackageManager: "npm",
    supportsMultiStage: true,
    supportsStandalone: false,
    defaultBaseImage: "node:20-alpine",
    recommendedBaseImage: "node:20-alpine",
  },
  vue: {
    id: "vue",
    name: "Vue (Vite)",
    language: "TypeScript",
    emoji: "🟢",
    description: "Static Vue.js app served by nginx.",
    defaultPort: 80,
    defaultWorkdir: "/app",
    defaultPackageManager: "npm",
    supportsMultiStage: true,
    supportsStandalone: false,
    defaultBaseImage: "node:20-alpine",
    recommendedBaseImage: "node:20-alpine",
  },
  fastify: {
    id: "fastify",
    name: "Fastify",
    language: "JavaScript",
    emoji: "⚡",
    description: "Fastify Node.js server with multi-stage build.",
    defaultPort: 3000,
    defaultWorkdir: "/app",
    defaultPackageManager: "npm",
    supportsMultiStage: true,
    supportsStandalone: false,
    defaultBaseImage: "node:20-alpine",
    recommendedBaseImage: "node:20-alpine",
    startCommand: "node server.js",
  },
  gin: {
    id: "gin",
    name: "Gin (Go)",
    language: "Go",
    emoji: "🍸",
    description: "Go web framework with static binary in distroless.",
    defaultPort: 8080,
    defaultWorkdir: "/app",
    defaultPackageManager: "go",
    supportsMultiStage: true,
    supportsStandalone: true,
    defaultBaseImage: "golang:1.22-alpine",
    recommendedBaseImage: "gcr.io/distroless/static-debian12",
    startCommand: "./server",
  },
  quarkus: {
    id: "quarkus",
    name: "Quarkus",
    language: "Java",
    emoji: "☕",
    description: "Quarkus with fast-jar packaging for minimal image size.",
    defaultPort: 8080,
    defaultWorkdir: "/app",
    defaultPackageManager: "maven",
    supportsMultiStage: true,
    supportsStandalone: false,
    defaultBaseImage: "eclipse-temurin:21-jre",
    recommendedBaseImage: "eclipse-temurin:21-jre",
    startCommand: "java -jar quarkus-run.jar",
  },
  actix: {
    id: "actix",
    name: "Actix (Rust)",
    language: "Rust",
    emoji: "🦀",
    description: "Actix-web with cargo-chef and distroless runtime.",
    defaultPort: 8080,
    defaultWorkdir: "/app",
    defaultPackageManager: "cargo",
    supportsMultiStage: true,
    supportsStandalone: true,
    defaultBaseImage: "rust:1.78-alpine",
    recommendedBaseImage: "gcr.io/distroless/cc-debian12",
    startCommand: "./server",
  },
  rails: {
    id: "rails",
    name: "Ruby on Rails",
    language: "Ruby",
    emoji: "🛤️",
    description: "Rails with puma and bundle install.",
    defaultPort: 3000,
    defaultWorkdir: "/app",
    defaultPackageManager: "composer",
    supportsMultiStage: true,
    supportsStandalone: false,
    defaultBaseImage: "ruby:3.3-slim",
    recommendedBaseImage: "ruby:3.3-slim",
    startCommand: "bundle exec puma -C config/puma.rb",
  },
  dotnet: {
    id: "dotnet",
    name: ".NET",
    language: "C#",
    emoji: "🟣",
    description: "ASP.NET / Minimal API with multi-stage build.",
    defaultPort: 8080,
    defaultWorkdir: "/app",
    defaultPackageManager: "npm",
    supportsMultiStage: true,
    supportsStandalone: false,
    defaultBaseImage: "mcr.microsoft.com/dotnet/aspnet:9.0",
    recommendedBaseImage: "mcr.microsoft.com/dotnet/aspnet:9.0",
    startCommand: "dotnet MyApp.dll",
  },
  phoenix: {
    id: "phoenix",
    name: "Phoenix",
    language: "Elixir",
    emoji: "🐦",
    description: "Phoenix with mix release.",
    defaultPort: 4000,
    defaultWorkdir: "/app",
    defaultPackageManager: "npm",
    supportsMultiStage: true,
    supportsStandalone: false,
    defaultBaseImage: "alpine:3.20",
    recommendedBaseImage: "alpine:3.20",
    startCommand: "bin/app start",
  },
  python: {
    id: "python",
    name: "Python",
    language: "Python",
    emoji: "🐍",
    description: "Generic Python app.",
    defaultPort: 8000,
    defaultWorkdir: "/app",
    defaultPackageManager: "pip",
    supportsMultiStage: true,
    supportsStandalone: false,
    defaultBaseImage: "python:3.12-slim",
    recommendedBaseImage: "python:3.12-slim",
  },
  django: {
    id: "django",
    name: "Django",
    language: "Python",
    emoji: "🎸",
    description: "Django with gunicorn and collectstatic.",
    defaultPort: 8000,
    defaultWorkdir: "/app",
    defaultPackageManager: "pip",
    supportsMultiStage: true,
    supportsStandalone: false,
    defaultBaseImage: "python:3.12-slim",
    recommendedBaseImage: "python:3.12-slim",
    startCommand: "gunicorn project.wsgi:application --bind 0.0.0.0:8000",
  },
  fastapi: {
    id: "fastapi",
    name: "FastAPI",
    language: "Python",
    emoji: "⚡",
    description: "FastAPI with uvicorn production setup.",
    defaultPort: 8000,
    defaultWorkdir: "/app",
    defaultPackageManager: "pip",
    supportsMultiStage: true,
    supportsStandalone: false,
    defaultBaseImage: "python:3.12-slim",
    recommendedBaseImage: "python:3.12-slim",
    startCommand: "uvicorn main:app --host 0.0.0.0 --port 8000",
  },
  flask: {
    id: "flask",
    name: "Flask",
    language: "Python",
    emoji: "🧪",
    description: "Flask with gunicorn.",
    defaultPort: 5000,
    defaultWorkdir: "/app",
    defaultPackageManager: "pip",
    supportsMultiStage: true,
    supportsStandalone: false,
    defaultBaseImage: "python:3.12-slim",
    recommendedBaseImage: "python:3.12-slim",
    startCommand: "gunicorn app:app --bind 0.0.0.0:5000",
  },
  java: {
    id: "java",
    name: "Java",
    language: "Java",
    emoji: "☕",
    description: "Generic Java app with JRE.",
    defaultPort: 8080,
    defaultWorkdir: "/app",
    defaultPackageManager: "maven",
    supportsMultiStage: true,
    supportsStandalone: false,
    defaultBaseImage: "eclipse-temurin:21-jre",
    recommendedBaseImage: "eclipse-temurin:21-jre",
  },
  springboot: {
    id: "springboot",
    name: "Spring Boot",
    language: "Java",
    emoji: "🍃",
    description: "Spring Boot with layered JAR extraction for caching.",
    defaultPort: 8080,
    defaultWorkdir: "/app",
    defaultPackageManager: "maven",
    supportsMultiStage: true,
    supportsStandalone: false,
    defaultBaseImage: "eclipse-temurin:21-jre",
    recommendedBaseImage: "eclipse-temurin:21-jre",
    startCommand: "java -jar app.jar",
    buildOptimizations: ["layered-jar", "aot"],
  },
  go: {
    id: "go",
    name: "Go",
    language: "Go",
    emoji: "🐹",
    description: "Go with static binary in distroless or scratch.",
    defaultPort: 8080,
    defaultWorkdir: "/app",
    defaultPackageManager: "go",
    supportsMultiStage: true,
    supportsStandalone: true,
    defaultBaseImage: "golang:1.22-alpine",
    recommendedBaseImage: "gcr.io/distroless/static-debian12",
    startCommand: "./server",
  },
  rust: {
    id: "rust",
    name: "Rust",
    language: "Rust",
    emoji: "🦀",
    description: "Rust with musl static binary in distroless.",
    defaultPort: 8080,
    defaultWorkdir: "/app",
    defaultPackageManager: "cargo",
    supportsMultiStage: true,
    supportsStandalone: true,
    defaultBaseImage: "rust:1.78-alpine",
    recommendedBaseImage: "gcr.io/distroless/cc-debian12",
    startCommand: "./server",
  },
  php: {
    id: "php",
    name: "PHP",
    language: "PHP",
    emoji: "🐘",
    description: "PHP-FPM with nginx.",
    defaultPort: 80,
    defaultWorkdir: "/var/www/html",
    defaultPackageManager: "composer",
    supportsMultiStage: true,
    supportsStandalone: false,
    defaultBaseImage: "php:8.3-fpm-alpine",
    recommendedBaseImage: "php:8.3-fpm-alpine",
  },
  laravel: {
    id: "laravel",
    name: "Laravel",
    language: "PHP",
    emoji: "🔶",
    description: "Laravel with PHP-FPM, nginx, and artisan optimize.",
    defaultPort: 80,
    defaultWorkdir: "/var/www/html",
    defaultPackageManager: "composer",
    supportsMultiStage: true,
    supportsStandalone: false,
    defaultBaseImage: "php:8.3-fpm-alpine",
    recommendedBaseImage: "php:8.3-fpm-alpine",
  },
};

export const FRAMEWORK_LIST = Object.values(FRAMEWORKS);

export const getFramework = (id: string): FrameworkMeta => {
  return FRAMEWORKS[id as FrameworkId] ?? FRAMEWORKS.node;
};
