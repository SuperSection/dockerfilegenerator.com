/**
 * Smart Dockerfile generator.
 * Produces production-ready Dockerfiles tailored to each framework.
 */

import type { FrameworkId, PackageManager } from "./frameworks";
import { getFramework } from "./frameworks";

export interface DockerfileConfig {
  framework: FrameworkId;
  baseImage: string;
  port: number;
  workdir: string;
  packageManager: PackageManager;
  multiStage: boolean;
  production: boolean;
  nonRootUser: boolean;
  healthCheck: boolean;
  envVars: { key: string; value: string }[];
  buildOptimizations: string[];
  customStartCommand?: string;
  nodeVersion?: string;
  pythonVersion?: string;
  javaVersion?: string;
  goVersion?: string;
}

const installNodeDeps = (pm: PackageManager) => {
  switch (pm) {
    case "yarn":
      return `COPY package.json yarn.lock ./\nRUN yarn install --frozen-lockfile`;
    case "pnpm":
      return `COPY package.json pnpm-lock.yaml ./\nRUN corepack enable && corepack prepare pnpm@latest --activate && pnpm install --frozen-lockfile`;
    case "bun":
      return `COPY package.json bun.lockb ./\nRUN bun install --frozen-lockfile`;
    case "npm":
    default:
      return `COPY package.json package-lock.json* ./\nRUN npm ci`;
  }
};

const installPythonDeps = (pm: PackageManager) => {
  switch (pm) {
    case "poetry":
      return `COPY pyproject.toml poetry.lock ./\nRUN pip install --no-cache-dir poetry && poetry config virtualenvs.create false && poetry install --no-root --only main`;
    case "uv":
      return `COPY pyproject.toml uv.lock ./\nRUN pip install uv && uv sync --frozen --no-dev`;
    case "pipenv":
      return `COPY Pipfile Pipfile.lock ./\nRUN pip install --no-cache-dir pipenv && pipenv install --system --deploy`;
    case "pip":
    default:
      return `COPY requirements.txt ./\nRUN pip install --no-cache-dir -r requirements.txt`;
  }
};

const envBlock = (vars: { key: string; value: string }[]) => {
  if (!vars.length) return "";
  return "ENV " + vars.map((v) => `${v.key}=${v.value}`).join(" \\\n    ");
};

const healthCheckCmd = (port: number, framework: FrameworkId, workdir = "/app") => {
  // Go and Rust typically use distroless images without wget/curl.
  // Use a simple /dev/tcp check or skip health check for distroless.
  if (framework === "go" || framework === "rust") {
    return `HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\\n  CMD ["${workdir}/server", "--help"] > /dev/null 2>&1 || exit 1`;
  }
  return `HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\\n  CMD wget --no-verbose --tries=1 --spider http://localhost:${port}/ || exit 1`;
};

const userBlock = `RUN addgroup --system --gid 1001 nodejs && \\\n    adduser --system --uid 1001 appuser\nUSER appuser`;

const alpineUserBlock = `RUN addgroup -g 1001 -S appuser && \\\n    adduser -u 1001 -S appuser -G appuser\nUSER appuser`;

/* ─────────────────────────────────────────────────────────
 * Node-based templates
 * ─────────────────────────────────────────────────────── */
const generateNode = (config: DockerfileConfig): string => {
  const fw = getFramework(config.framework);
  const port = config.port;

  // Next.js with standalone output
  if (fw.id === "nextjs" && config.buildOptimizations.includes("standalone") && config.multiStage) {
    const lines: string[] = [];
    lines.push("# syntax=docker/dockerfile:1.7");
    lines.push("");
    lines.push("# ---- Dependencies ----");
    lines.push(`FROM ${config.baseImage} AS deps`);
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push(installNodeDeps(config.packageManager));
    lines.push("");
    lines.push("# ---- Builder ----");
    lines.push(`FROM ${config.baseImage} AS builder`);
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("ENV NEXT_TELEMETRY_DISABLED=1");
    lines.push("ENV NODE_ENV=production");
    lines.push("COPY --from=deps /app/node_modules ./node_modules");
    lines.push("COPY . .");
    lines.push("RUN " + (config.packageManager === "npm" ? "npm run build" : config.packageManager === "pnpm" ? "pnpm build" : config.packageManager === "yarn" ? "yarn build" : "bun run build"));
    lines.push("");
    lines.push("# ---- Runner ----");
    const runnerImage = config.baseImage.includes("alpine") ? config.baseImage.replace(/node:\d+/, "node:20") : config.baseImage;
    lines.push(`FROM ${runnerImage} AS runner`);
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("ENV NODE_ENV=production");
    lines.push("ENV NEXT_TELEMETRY_DISABLED=1");
    lines.push("RUN addgroup --system --gid 1001 nodejs \\");
    lines.push(" && adduser --system --uid 1001 nextjs");
    lines.push("COPY --from=builder /app/public ./public");
    lines.push("COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./");
    lines.push("COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static");
    lines.push("USER nextjs");
    lines.push("EXPOSE " + port);
    lines.push(`ENV PORT=${port} HOSTNAME=0.0.0.0`);
    if (config.envVars.length) {
      lines.push(envBlock(config.envVars));
    }
    if (config.healthCheck) {
      lines.push(healthCheckCmd(port, fw.id, config.workdir));
    }
    const startCmd = config.customStartCommand || fw.startCommand || "node server.js";
    lines.push(`CMD ${JSON.stringify(startCmd.split(/\s+/))}`.replace(/\\\\\"/g, '"'));
    return lines.join("\n");
  }

  // React / Vue (static)
  if ((fw.id === "react" || fw.id === "vue") && config.multiStage) {
    const lines: string[] = [];
    lines.push("# syntax=docker/dockerfile:1.7");
    lines.push("");
    lines.push("# ---- Build stage ----");
    lines.push(`FROM ${config.baseImage} AS builder`);
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("COPY package.json package-lock.json* ./");
    lines.push("RUN " + (config.packageManager === "npm" ? "npm ci" : config.packageManager === "pnpm" ? "pnpm install --frozen-lockfile" : config.packageManager === "yarn" ? "yarn install --frozen-lockfile" : "bun install --frozen-lockfile"));
    lines.push("COPY . .");
    lines.push("RUN " + (config.packageManager === "npm" ? "npm run build" : config.packageManager === "pnpm" ? "pnpm build" : config.packageManager === "yarn" ? "yarn build" : "bun run build"));
    lines.push("");
    lines.push("# ---- Runtime: nginx ----");
    lines.push("FROM nginx:1.27-alpine");
    lines.push("COPY --from=builder /app/dist /usr/share/nginx/html");
    lines.push("EXPOSE 80");
    if (config.healthCheck) {
      lines.push(healthCheckCmd(80, fw.id));
    }
    lines.push('CMD ["nginx", "-g", "daemon off;"]');
    return lines.join("\n");
  }

  // React / Vue (static) — single-stage: build and serve with Node
  if (fw.id === "react" || fw.id === "vue") {
    const lines: string[] = [];
    lines.push("# syntax=docker/dockerfile:1.7");
    lines.push(`FROM ${config.baseImage}`);
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("COPY package.json package-lock.json* ./");
    lines.push("RUN " + (config.packageManager === "npm" ? "npm ci" : config.packageManager === "pnpm" ? "pnpm install --frozen-lockfile" : config.packageManager === "yarn" ? "yarn install --frozen-lockfile" : "bun install --frozen-lockfile"));
    lines.push("COPY . .");
    lines.push("RUN " + (config.packageManager === "npm" ? "npm run build" : config.packageManager === "pnpm" ? "pnpm build" : config.packageManager === "yarn" ? "yarn build" : "bun run build"));
    lines.push("RUN npm install -g serve");
    lines.push("EXPOSE 3000");
    if (config.healthCheck) {
      lines.push(healthCheckCmd(3000, fw.id));
    }
    const startCmd = config.customStartCommand || fw.startCommand || "serve -s dist -l 3000";
    lines.push(`CMD ${JSON.stringify(startCmd.split(/\s+/))}`.replace(/\\\\\"/g, '"'));
    return lines.join("\n");
  }

  // Generic Node / Express / NestJS — multi-stage
  if (config.multiStage) {
    const lines: string[] = [];
    lines.push("# syntax=docker/dockerfile:1.7");
    lines.push("");
    lines.push("# ---- Dependencies ----");
    lines.push(`FROM ${config.baseImage} AS deps`);
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push(installNodeDeps(config.packageManager));
    lines.push("");
    lines.push("# ---- Build ----");
    lines.push(`FROM ${config.baseImage} AS builder`);
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("COPY --from=deps /app/node_modules ./node_modules");
    lines.push("COPY . .");
    if (fw.id === "nestjs" || fw.id === "nextjs") {
      lines.push("RUN " + (config.packageManager === "npm" ? "npm run build" : config.packageManager === "pnpm" ? "pnpm build" : config.packageManager === "yarn" ? "yarn build" : "bun run build"));
    } else {
      lines.push("RUN " + (config.packageManager === "npm" ? "npm run build" : config.packageManager === "pnpm" ? "pnpm build" : config.packageManager === "yarn" ? "yarn build" : "bun run build") + " || true");
    }
    lines.push("");
    lines.push("# ---- Runtime ----");
    lines.push(`FROM ${config.baseImage} AS runner`);
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("ENV NODE_ENV=" + (config.production ? "production" : "development"));
    if (config.envVars.length) {
      lines.push(envBlock(config.envVars));
    }
    if (config.nonRootUser) {
      lines.push(config.baseImage.includes("alpine") ? alpineUserBlock : userBlock);
    }
    lines.push("COPY --from=builder --chown=" + (config.nonRootUser ? "appuser:" + (config.baseImage.includes("alpine") ? "appuser" : "nodejs") : "node:node") + " /app/node_modules ./node_modules");
    if (fw.id === "nestjs") {
      lines.push("COPY --from=builder --chown=" + (config.nonRootUser ? "appuser:" + (config.baseImage.includes("alpine") ? "appuser" : "nodejs") : "node:node") + " /app/dist ./dist");
    } else {
      lines.push("COPY --from=builder --chown=" + (config.nonRootUser ? "appuser:" + (config.baseImage.includes("alpine") ? "appuser" : "nodejs") : "node:node") + " /app/package.json .");
      lines.push("COPY --from=builder --chown=" + (config.nonRootUser ? "appuser:" + (config.baseImage.includes("alpine") ? "appuser" : "nodejs") : "node:node") + " /app/src ./src");
    }
    lines.push("EXPOSE " + port);
    if (config.healthCheck) {
      lines.push(healthCheckCmd(port, fw.id, config.workdir));
    }
    const startCmd = config.customStartCommand || fw.startCommand || "node server.js";
    lines.push(`CMD ${JSON.stringify(startCmd.split(/\s+/))}`.replace(/\\\\\"/g, '"'));
    return lines.join("\n");
  }

  // Single-stage fallback
  const lines: string[] = [];
  lines.push("# syntax=docker/dockerfile:1.7");
  lines.push(`FROM ${config.baseImage}`);
  lines.push(`WORKDIR ${config.workdir}`);
  lines.push("ENV NODE_ENV=" + (config.production ? "production" : "development"));
  if (config.envVars.length) {
    lines.push(envBlock(config.envVars));
  }
  if (config.nonRootUser) {
    lines.push(config.baseImage.includes("alpine") ? alpineUserBlock : userBlock);
  }
  lines.push(installNodeDeps(config.packageManager));
  lines.push("COPY . .");
  lines.push("EXPOSE " + port);
  if (config.healthCheck) {
    lines.push(healthCheckCmd(port, fw.id, config.workdir));
  }
  const startCmd = config.customStartCommand || fw.startCommand || "node server.js";
  lines.push(`CMD ${JSON.stringify(startCmd.split(/\s+/))}`.replace(/\\\\\"/g, '"'));
  return lines.join("\n");
};

/* ─────────────────────────────────────────────────────────
 * Python-based templates
 * ─────────────────────────────────────────────────────── */
const generatePython = (config: DockerfileConfig): string => {
  const fw = getFramework(config.framework);
  const port = config.port;
  const lines: string[] = [];
  lines.push("# syntax=docker/dockerfile:1.7");

  if (config.multiStage) {
    lines.push("# ---- Builder ----");
    lines.push(`FROM ${config.baseImage} AS builder`);
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1");
    lines.push(installPythonDeps(config.packageManager));
    lines.push("COPY . .");
    if (fw.id === "django") {
      lines.push("RUN python manage.py collectstatic --noinput || true");
    }
    lines.push("");
    lines.push("# ---- Runtime ----");
    lines.push(`FROM ${config.baseImage}`);
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1");
    if (config.envVars.length) {
      lines.push(envBlock(config.envVars));
    }
    if (config.nonRootUser) {
      lines.push("RUN useradd --create-home --shell /bin/bash --uid 1001 appuser");
      lines.push("USER appuser");
    }
    lines.push("COPY --from=builder /app /app");
    // Dynamically determine Python version from base image
    const pyVersionMatch = config.baseImage.match(/python(\d+\.\d+)/);
    const pyVersion = pyVersionMatch ? pyVersionMatch[1] : "3.12";
    lines.push("COPY --from=builder /usr/local/lib/python" + pyVersion + "/site-packages /usr/local/lib/python" + pyVersion + "/site-packages");
    lines.push("EXPOSE " + port);
    if (config.healthCheck) {
      lines.push(healthCheckCmd(port, fw.id, config.workdir));
    }
    const startCmd = config.customStartCommand || (fw.startCommand ? fw.startCommand.replace(/:\d+\b/, `:${port}`).replace(/--port \d+/, `--port ${port}`) : "python main.py");
    lines.push(`CMD ${JSON.stringify(startCmd.split(/\s+/))}`.replace(/\\\\\"/g, '"'));
  } else {
    lines.push(`FROM ${config.baseImage}`);
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1");
    if (config.envVars.length) {
      lines.push(envBlock(config.envVars));
    }
    if (config.nonRootUser) {
      lines.push("RUN useradd --create-home --shell /bin/bash --uid 1001 appuser");
      lines.push("USER appuser");
    }
    lines.push(installPythonDeps(config.packageManager));
    lines.push("COPY . .");
    lines.push("EXPOSE " + port);
    if (config.healthCheck) {
      lines.push(healthCheckCmd(port, fw.id, config.workdir));
    }
    const startCmd = config.customStartCommand || (fw.startCommand ? fw.startCommand.replace(/:\d+\b/, `:${port}`).replace(/--port \d+/, `--port ${port}`) : "python main.py");
    lines.push(`CMD ${JSON.stringify(startCmd.split(/\s+/))}`.replace(/\\\\\"/g, '"'));
  }
  return lines.join("\n");
};

/* ─────────────────────────────────────────────────────────
 * Java / Spring Boot (layered)
 * ─────────────────────────────────────────────────────── */
const generateJava = (config: DockerfileConfig): string => {
  const fw = getFramework(config.framework);
  const port = config.port;
  const lines: string[] = [];
  lines.push("# syntax=docker/dockerfile:1.7");

  if (fw.id === "springboot" && config.buildOptimizations.includes("layered-jar") && config.multiStage) {
    lines.push("# ---- Build ----");
    lines.push(`FROM eclipse-temurin:${config.javaVersion ?? "21"}-jdk AS builder`);
    lines.push(`WORKDIR ${config.workdir}`);
    if (config.packageManager === "gradle") {
      lines.push("COPY gradlew settings.gradle* build.gradle* gradle/ ./");
      lines.push("RUN chmod +x gradlew && ./gradlew dependencies --no-daemon > /dev/null 2>&1 || true");
      lines.push("COPY src ./src");
      lines.push("RUN ./gradlew bootJar --no-daemon");
    } else {
      lines.push("COPY mvnw pom.xml* .mvn/ ./");
      lines.push("RUN chmod +x mvnw && ./mvnw dependency:go-offline -B > /dev/null 2>&1 || true");
      lines.push("COPY src ./src");
      lines.push("RUN ./mvnw package -DskipTests");
    }
    lines.push("RUN cp target/*.jar app.jar && java -Djarmode=layertools -jar app.jar extract");
    lines.push("");
    lines.push("# ---- Runtime ----");
    lines.push(`FROM ${config.baseImage}`);
    lines.push(`WORKDIR ${config.workdir}`);
    if (config.envVars.length) {
      lines.push(envBlock(config.envVars));
    }
    if (config.nonRootUser) {
      lines.push("RUN groupadd --system --gid 1001 appuser && useradd --system --uid 1001 --gid appuser appuser");
      lines.push("USER appuser");
    }
    lines.push("COPY --from=builder app/dependencies/ ./");
    lines.push("COPY --from=builder app/spring-boot-loader/ ./");
    lines.push("COPY --from=builder app/snapshot-dependencies/ ./");
    lines.push("COPY --from=builder app/application/ ./");
    lines.push("EXPOSE " + port);
    if (config.healthCheck) {
      lines.push(healthCheckCmd(port, fw.id, config.workdir));
    }
    const startCmd = config.customStartCommand || fw.startCommand || "java -jar app.jar";
    lines.push(`ENTRYPOINT ${JSON.stringify(startCmd.split(/\s+/))}`.replace(/\\\\\"/g, '"'));
  } else {
    lines.push(`FROM ${config.baseImage}`);
    lines.push(`WORKDIR ${config.workdir}`);
    if (config.envVars.length) {
      lines.push(envBlock(config.envVars));
    }
    if (config.nonRootUser) {
      lines.push("RUN groupadd --system --gid 1001 appuser && useradd --system --uid 1001 --gid appuser appuser");
      lines.push("USER appuser");
    }
    lines.push("COPY --chown=" + (config.nonRootUser ? "appuser:appuser" : "root:root") + " target/*.jar app.jar");
    lines.push("EXPOSE " + port);
    if (config.healthCheck) {
      lines.push(healthCheckCmd(port, fw.id, config.workdir));
    }
    const startCmd = config.customStartCommand || fw.startCommand || "java -jar app.jar";
    lines.push(`CMD ${JSON.stringify(startCmd.split(/\s+/))}`.replace(/\\\\\"/g, '"'));
  }
  return lines.join("\n");
};

/* ─────────────────────────────────────────────────────────
 * Go — distroless, static binary
 * ─────────────────────────────────────────────────────── */
const generateGo = (config: DockerfileConfig): string => {
  const fw = getFramework(config.framework);
  const port = config.port;
  const lines: string[] = [];
  lines.push("# syntax=docker/dockerfile:1.7");

  if (config.multiStage) {
    lines.push("# ---- Build ----");
    lines.push(`FROM golang:${config.goVersion ?? "1.22"}-alpine AS builder`);
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("COPY go.mod go.sum* ./");
    lines.push("RUN go mod download");
    lines.push("COPY . .");
    lines.push(`RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /out/server .`);
    lines.push("");
    lines.push("# ---- Runtime (distroless) ----");
    lines.push("FROM gcr.io/distroless/static-debian12:nonroot");
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push(`COPY --from=builder /out/server ${config.workdir}/server`);
    if (config.nonRootUser) {
      lines.push("USER nonroot:nonroot");
    }
    lines.push("EXPOSE " + port);
    if (config.envVars.length) {
      lines.push(envBlock(config.envVars));
    }
    if (config.healthCheck) {
      lines.push(healthCheckCmd(port, "go", config.workdir));
    }
    const startCmd = config.customStartCommand || fw.startCommand || `${config.workdir}/server`;
    lines.push(`CMD ${JSON.stringify(startCmd.split(/\s+/))}`.replace(/\\\\\"/g, '"'));
  } else {
    lines.push(`FROM golang:${config.goVersion ?? "1.22"}-alpine`);
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("COPY go.mod go.sum* ./");
    lines.push("RUN go mod download");
    lines.push("COPY . .");
    lines.push(`RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o ${config.workdir}/server .`);
    if (config.nonRootUser) {
      lines.push("RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup");
      lines.push("USER appuser");
    }
    lines.push("EXPOSE " + port);
    if (config.envVars.length) {
      lines.push(envBlock(config.envVars));
    }
    if (config.healthCheck) {
      lines.push(healthCheckCmd(port, "go", config.workdir));
    }
    const startCmd = config.customStartCommand || fw.startCommand || "./server";
    lines.push(`CMD ${JSON.stringify(startCmd.split(/\s+/))}`.replace(/\\\\\"/g, '"'));
  }
  return lines.join("\n");
};

/* ─────────────────────────────────────────────────────────
 * Rust — static musl binary
 * ─────────────────────────────────────────────────────── */
const generateRust = (config: DockerfileConfig): string => {
  const fw = getFramework(config.framework);
  const port = config.port;
  const lines: string[] = [];
  lines.push("# syntax=docker/dockerfile:1.7");

  if (config.multiStage) {
    lines.push("# ---- Build deps ----");
    lines.push("FROM rust:1.78-alpine AS chef");
    lines.push("RUN apk add --no-cache musl-dev && cargo install cargo-chef");
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("");
    lines.push("FROM chef AS planner");
    lines.push("COPY . .");
    lines.push("RUN cargo chef prepare --recipe-path recipe.json");
    lines.push("");
    lines.push("FROM chef AS builder");
    lines.push("COPY --from=planner /app/recipe.json recipe.json");
    lines.push("RUN cargo chef cook --release --recipe-path recipe.json");
    lines.push("COPY . .");
    lines.push("RUN cargo build --release --bin server");
    lines.push("");
    lines.push("# ---- Runtime ----");
    lines.push("FROM gcr.io/distroless/cc-debian12:nonroot");
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push(`COPY --from=builder /app/target/release/server ${config.workdir}/server`);
    if (config.nonRootUser) {
      lines.push("USER nonroot:nonroot");
    }
    lines.push("EXPOSE " + port);
    if (config.envVars.length) {
      lines.push(envBlock(config.envVars));
    }
    if (config.healthCheck) {
      lines.push(healthCheckCmd(port, "rust", config.workdir));
    }
    const startCmd = config.customStartCommand || fw.startCommand || `${config.workdir}/server`;
    lines.push(`CMD ${JSON.stringify(startCmd.split(/\s+/))}`.replace(/\\\\\"/g, '"'));
  } else {
    lines.push(`FROM rust:1.78-alpine`);
    lines.push("RUN apk add --no-cache musl-dev");
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("COPY . .");
    lines.push("RUN cargo build --release --bin server");
    if (config.nonRootUser) {
      lines.push("RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup");
      lines.push("USER appuser");
    }
    lines.push("EXPOSE " + port);
    if (config.envVars.length) {
      lines.push(envBlock(config.envVars));
    }
    if (config.healthCheck) {
      lines.push(healthCheckCmd(port, "rust", config.workdir));
    }
    const startCmd = config.customStartCommand || fw.startCommand || "./target/release/server";
    lines.push(`CMD ${JSON.stringify(startCmd.split(/\s+/))}`.replace(/\\\\\"/g, '"'));
  }
  return lines.join("\n");
};

/* ─────────────────────────────────────────────────────────
 * PHP / Laravel — PHP-FPM
 * ─────────────────────────────────────────────────────── */
const generatePhp = (config: DockerfileConfig): string => {
  const fw = getFramework(config.framework);
  const lines: string[] = [];
  lines.push("# syntax=docker/dockerfile:1.7");

  if (config.multiStage) {
    lines.push("# ---- Composer deps ----");
    lines.push(`FROM ${config.baseImage} AS vendor`);
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("COPY composer.json composer.lock* ./");
    lines.push("RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist");
    lines.push("");
    lines.push("# ---- Build ----");
    lines.push(`FROM ${config.baseImage} AS builder`);
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("COPY --from=vendor /app/vendor ./vendor");
    lines.push("COPY . .");
    lines.push("RUN composer dump-autoload --optimize --no-dev");
    if (config.framework === "laravel") {
      lines.push("RUN php artisan config:cache && php artisan route:cache || true");
    }
    lines.push("");
    lines.push("# ---- Runtime ----");
    lines.push(`FROM ${config.baseImage}`);
    lines.push(`WORKDIR ${config.workdir}`);
    if (config.envVars.length) {
      lines.push(envBlock(config.envVars));
    }
    if (config.nonRootUser) {
      lines.push(`RUN addgroup -g 1001 -S appuser && adduser -u 1001 -S appuser -G appuser && chown -R appuser:appuser ${config.workdir}`);
      lines.push("USER appuser");
    }
    lines.push("COPY --from=builder --chown=" + (config.nonRootUser ? "appuser:appuser" : "www-data:www-data") + ` /app ${config.workdir}`);
    lines.push("EXPOSE " + config.port);
    if (config.healthCheck) {
      lines.push('HEALTHCHECK --interval=30s --timeout=3s CMD php-fpm-healthcheck || exit 1');
    }
    const startCmd = config.customStartCommand || fw.startCommand || "php-fpm";
    lines.push(`CMD ${JSON.stringify(startCmd.split(/\s+/))}`.replace(/\\\\\"/g, '"'));
  } else {
    lines.push(`FROM ${config.baseImage}`);
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("COPY composer.json composer.lock* ./");
    lines.push("RUN composer install --no-dev --prefer-dist");
    if (config.framework === "laravel") {
      lines.push("RUN php artisan config:cache && php artisan route:cache || true");
    }
    lines.push("COPY . .");
    if (config.nonRootUser) {
      lines.push(`RUN addgroup -g 1001 -S appuser && adduser -u 1001 -S appuser -G appuser && chown -R appuser:appuser ${config.workdir}`);
      lines.push("USER appuser");
    }
    if (config.envVars.length) {
      lines.push(envBlock(config.envVars));
    }
    lines.push("EXPOSE " + config.port);
    if (config.healthCheck) {
      lines.push('HEALTHCHECK --interval=30s --timeout=3s CMD php-fpm-healthcheck || exit 1');
    }
    const startCmd = config.customStartCommand || fw.startCommand || "php-fpm";
    lines.push(`CMD ${JSON.stringify(startCmd.split(/\s+/))}`.replace(/\\\\\"/g, '"'));
  }
  return lines.join("\n");
};

/* ─────────────────────────────────────────────────────────
 * Ruby / Rails — Bundler
 * ─────────────────────────────────────────────────────── */
const generateRuby = (config: DockerfileConfig): string => {
  const fw = getFramework(config.framework);
  const port = config.port;
  const lines: string[] = [];
  lines.push("# syntax=docker/dockerfile:1.7");

  if (config.multiStage) {
    lines.push("# ---- Dependencies ----");
    lines.push(`FROM ${config.baseImage} AS deps`);
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("COPY Gemfile Gemfile.lock* ./");
    lines.push("RUN bundle install --jobs 4 --retry 3");
    lines.push("");
    lines.push("# ---- Build ----");
    lines.push(`FROM ${config.baseImage} AS builder`);
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("COPY --from=deps /usr/local/bundle /usr/local/bundle");
    lines.push("COPY . .");
    if (fw.id === "rails") {
      lines.push("RUN bundle exec rake assets:precompile || true");
    }
    lines.push("");
    lines.push("# ---- Runtime ----");
    lines.push(`FROM ${config.baseImage}`);
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("ENV RAILS_ENV=production RACK_ENV=production");
    if (config.envVars.length) {
      lines.push(envBlock(config.envVars));
    }
    if (config.nonRootUser) {
      lines.push("RUN groupadd --system --gid 1001 appuser && useradd --system --uid 1001 --gid appuser appuser");
      lines.push("USER appuser");
    }
    lines.push("COPY --from=builder --chown=" + (config.nonRootUser ? "appuser:appuser" : "root:root") + " /app /app");
    lines.push("COPY --from=builder --chown=" + (config.nonRootUser ? "appuser:appuser" : "root:root") + " /usr/local/bundle /usr/local/bundle");
    lines.push("EXPOSE " + port);
    if (config.healthCheck) {
      lines.push(healthCheckCmd(port, fw.id, config.workdir));
    }
    const startCmd = config.customStartCommand || fw.startCommand || "bundle exec puma -C config/puma.rb";
    lines.push(`CMD ${JSON.stringify(startCmd.split(/\s+/))}`.replace(/\\\\\"/g, '"'));
  } else {
    lines.push(`FROM ${config.baseImage}`);
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("ENV RAILS_ENV=production RACK_ENV=production");
    if (config.envVars.length) {
      lines.push(envBlock(config.envVars));
    }
    if (config.nonRootUser) {
      lines.push("RUN groupadd --system --gid 1001 appuser && useradd --system --uid 1001 --gid appuser appuser");
      lines.push("USER appuser");
    }
    lines.push("COPY Gemfile Gemfile.lock* ./");
    lines.push("RUN bundle install --jobs 4 --retry 3");
    lines.push("COPY . .");
    lines.push("EXPOSE " + port);
    if (config.healthCheck) {
      lines.push(healthCheckCmd(port, fw.id, config.workdir));
    }
    const startCmd = config.customStartCommand || fw.startCommand || "bundle exec puma -C config/puma.rb";
    lines.push(`CMD ${JSON.stringify(startCmd.split(/\s+/))}`.replace(/\\\\\"/g, '"'));
  }
  return lines.join("\n");
};

/* ─────────────────────────────────────────────────────────
 * .NET — dotnet CLI
 * ─────────────────────────────────────────────────────── */
const generateDotnet = (config: DockerfileConfig): string => {
  const fw = getFramework(config.framework);
  const port = config.port;
  const lines: string[] = [];
  lines.push("# syntax=docker/dockerfile:1.7");

  if (config.multiStage) {
    lines.push("# ---- Build ----");
    lines.push("FROM mcr.microsoft.com/dotnet/sdk:9.0 AS builder");
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("COPY *.csproj *.sln* ./");
    lines.push("RUN dotnet restore");
    lines.push("COPY . .");
    lines.push("RUN dotnet publish -c Release -o /out");
    lines.push("");
    lines.push("# ---- Runtime ----");
    lines.push(`FROM ${config.baseImage}`);
    lines.push(`WORKDIR ${config.workdir}`);
    if (config.envVars.length) {
      lines.push(envBlock(config.envVars));
    }
    if (config.nonRootUser) {
      lines.push("RUN addgroup --system --gid 1001 appuser && adduser --system --uid 1001 --gid appuser appuser");
      lines.push("USER appuser");
    }
    lines.push("COPY --from=builder --chown=" + (config.nonRootUser ? "appuser:appuser" : "root:root") + " /out .");
    lines.push("EXPOSE " + port);
    if (config.healthCheck) {
      lines.push(healthCheckCmd(port, "dotnet", config.workdir));
    }
    const startCmd = config.customStartCommand || fw.startCommand || "dotnet MyApp.dll";
    lines.push(`ENTRYPOINT ${JSON.stringify(startCmd.split(/\s+/))}`.replace(/\\\\\"/g, '"'));
  } else {
    lines.push(`FROM ${config.baseImage}`);
    lines.push(`WORKDIR ${config.workdir}`);
    if (config.envVars.length) {
      lines.push(envBlock(config.envVars));
    }
    if (config.nonRootUser) {
      lines.push("RUN addgroup --system --gid 1001 appuser && adduser --system --uid 1001 --gid appuser appuser");
      lines.push("USER appuser");
    }
    lines.push("COPY . .");
    lines.push("RUN dotnet publish -c Release -o /app");
    lines.push("EXPOSE " + port);
    if (config.healthCheck) {
      lines.push(healthCheckCmd(port, "dotnet", config.workdir));
    }
    const startCmd = config.customStartCommand || fw.startCommand || "dotnet MyApp.dll";
    lines.push(`ENTRYPOINT ${JSON.stringify(startCmd.split(/\s+/))}`.replace(/\\\\\"/g, '"'));
  }
  return lines.join("\n");
};

/* ─────────────────────────────────────────────────────────
 * Elixir / Phoenix — mix release
 * ─────────────────────────────────────────────────────── */
const generateElixir = (config: DockerfileConfig): string => {
  const fw = getFramework(config.framework);
  const port = config.port;
  const lines: string[] = [];
  lines.push("# syntax=docker/dockerfile:1.7");

  if (config.multiStage) {
    lines.push("# ---- Build ----");
    lines.push(`FROM ${config.baseImage} AS builder`);
    lines.push("RUN apk add --no-cache build-base npm git");
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("COPY mix.exs mix.lock* ./");
    lines.push("RUN mix deps.get --only prod");
    lines.push("COPY . .");
    lines.push("ENV MIX_ENV=prod");
    lines.push("RUN mix deps.compile");
    lines.push("RUN mix release");
    lines.push("");
    lines.push("# ---- Runtime ----");
    lines.push("FROM alpine:3.20 AS runner");
    lines.push("RUN apk add --no-cache libstdc++ openssl libncurses");
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("ENV MIX_ENV=prod");
    if (config.envVars.length) {
      lines.push(envBlock(config.envVars));
    }
    if (config.nonRootUser) {
      lines.push("RUN addgroup -g 1001 -S appuser && adduser -u 1001 -S appuser -G appuser");
      lines.push("USER appuser");
    }
    lines.push("COPY --from=builder --chown=" + (config.nonRootUser ? "appuser:appuser" : "root:root") + " /app/_build/prod/rel/. .");
    lines.push("EXPOSE " + port);
    if (config.healthCheck) {
      lines.push(healthCheckCmd(port, fw.id, config.workdir));
    }
    const startCmd = config.customStartCommand || fw.startCommand || "bin/app start";
    lines.push(`CMD ${JSON.stringify(startCmd.split(/\s+/))}`.replace(/\\\\\"/g, '"'));
  } else {
    lines.push(`FROM ${config.baseImage}`);
    lines.push("RUN apk add --no-cache build-base npm git");
    lines.push(`WORKDIR ${config.workdir}`);
    lines.push("ENV MIX_ENV=prod");
    if (config.envVars.length) {
      lines.push(envBlock(config.envVars));
    }
    if (config.nonRootUser) {
      lines.push("RUN addgroup -g 1001 -S appuser && adduser -u 1001 -S appuser -G appuser");
      lines.push("USER appuser");
    }
    lines.push("COPY mix.exs mix.lock* ./");
    lines.push("RUN mix deps.get --only prod && mix deps.compile");
    lines.push("COPY . .");
    lines.push("RUN mix release");
    lines.push("EXPOSE " + port);
    if (config.healthCheck) {
      lines.push(healthCheckCmd(port, fw.id, config.workdir));
    }
    const startCmd = config.customStartCommand || fw.startCommand || "bin/app start";
    lines.push(`CMD ${JSON.stringify(startCmd.split(/\s+/))}`.replace(/\\\\\"/g, '"'));
  }
  return lines.join("\n");
};

/* ─────────────────────────────────────────────────────────
 * Entry point
 * ─────────────────────────────────────────────────────── */
export const generateDockerfile = (config: DockerfileConfig): string => {
  const langGroup = ["node", "express", "nestjs", "nextjs", "react", "vue", "fastify"];
  const pythonGroup = ["python", "django", "fastapi", "flask"];
  const javaGroup = ["java", "springboot", "quarkus"];
  const goGroup = ["go", "gin"];
  const rustGroup = ["rust", "actix"];
  const phpGroup = ["php", "laravel"];
  const rubyGroup = ["rails"];
  const dotnetGroup = ["dotnet"];
  const elixirGroup = ["phoenix"];

  if (langGroup.includes(config.framework)) return generateNode(config);
  if (pythonGroup.includes(config.framework)) return generatePython(config);
  if (javaGroup.includes(config.framework)) return generateJava(config);
  if (goGroup.includes(config.framework)) return generateGo(config);
  if (rustGroup.includes(config.framework)) return generateRust(config);
  if (phpGroup.includes(config.framework)) return generatePhp(config);
  // Rails, .NET, and Phoenix get language-appropriate templates
  if (rubyGroup.includes(config.framework)) return generateRuby(config);
  if (dotnetGroup.includes(config.framework)) return generateDotnet(config);
  if (elixirGroup.includes(config.framework)) return generateElixir(config);

  return generateNode(config);
};

/* ─────────────────────────────────────────────────────────
 * .dockerignore generator
 * ─────────────────────────────────────────────────────── */
export const generateDockerignore = (framework: FrameworkId): string => {
  const base = [
    "node_modules",
    "npm-debug.log",
    "yarn-debug.log",
    "yarn-error.log",
    ".pnpm-debug.log",
    ".git",
    ".gitignore",
    ".env",
    ".env.*",
    "!.env.example",
    ".vscode",
    ".idea",
    "*.log",
    "coverage",
    ".nyc_output",
    ".next",
    "dist",
    ".DS_Store",
    "Dockerfile",
    "docker-compose*.yml",
    ".dockerignore",
    "README.md",
    "LICENSE",
    ".editorconfig",
    ".prettierrc*",
    ".eslintrc*",
  ];

  if (["python", "django", "fastapi", "flask"].includes(framework)) {
    base.push("__pycache__", "*.pyc", "*.pyo", ".pytest_cache", ".venv", "venv", "env", "*.egg-info", ".mypy_cache", ".ruff_cache", ".tox");
  }
  if (framework === "go") {
    base.push("vendor", "*.test", "*.out");
  }
  if (framework === "rust") {
    base.push("target", "Cargo.lock");
  }
  if (["php", "laravel"].includes(framework)) {
    base.push("vendor", "storage/logs/*", "storage/framework/cache/data/*");
  }
  if (["java", "springboot", "quarkus"].includes(framework)) {
    base.push("target", ".gradle", "build", "*.class", ".mvn/repository");
  }
  if (framework === "dotnet") {
    base.push("bin", "obj", "*.user", "*.suo");
  }
  if (framework === "rails") {
    base.push("vendor/bundle", "tmp", "log");
  }
  if (framework === "phoenix") {
    base.push("_build", "deps", "*.ez", "node_modules");
  }

  return base.join("\n") + "\n";
};

/* ─────────────────────────────────────────────────────────
 * Dockerfile explanation — instruction-by-instruction
 * ─────────────────────────────────────────────────────── */
export interface InstructionExplanation {
  instruction: string;
  description: string;
}

export const explainDockerfile = (dockerfile: string): InstructionExplanation[] => {
  const explanations: InstructionExplanation[] = [];
  const lines = dockerfile.split("\n");
  let currentInstruction = "";
  let currentDescription = "";

  const push = () => {
    if (currentInstruction) {
      explanations.push({
        instruction: currentInstruction,
        description: currentDescription,
      });
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Z]+)(?:\s+(.*))?/);
    if (!match) continue;

    const [, instruction, args] = match;
    push();
    currentInstruction = `${instruction}${args ? " " + args.split(" ")[0] : ""}`;

    switch (instruction) {
      case "FROM":
        currentDescription = "Defines the base image. Each FROM begins a new build stage.";
        break;
      case "WORKDIR":
        currentDescription = "Sets the working directory for subsequent instructions.";
        break;
      case "COPY":
        currentDescription = "Copies files from host into the image filesystem.";
        break;
      case "RUN":
        currentDescription = "Executes a command during build, creating a new layer.";
        break;
      case "ENV":
        currentDescription = "Sets a persistent environment variable.";
        break;
      case "EXPOSE":
        currentDescription = "Documents the port the container listens on at runtime.";
        break;
      case "USER":
        currentDescription = "Switches to a non-root user for better security.";
        break;
      case "HEALTHCHECK":
        currentDescription = "Tells Docker how to test if the container is healthy.";
        break;
      case "CMD":
        currentDescription = "Default command to run when the container starts.";
        break;
      case "ENTRYPOINT":
        currentDescription = "Main executable — CMD args are appended to it.";
        break;
      case "ARG":
        currentDescription = "Build-time variable that can be set with --build-arg.";
        break;
      case "LABEL":
        currentDescription = "Adds metadata to the image.";
        break;
      default:
        currentDescription = `${instruction} instruction.`;
    }
  }
  push();

  return explanations;
};

/* ─────────────────────────────────────────────────────────
 * Best-practice scanner
 * ─────────────────────────────────────────────────────── */
export interface Finding {
  level: "info" | "warning" | "error";
  title: string;
  message: string;
}

export const scanBestPractices = (config: DockerfileConfig, dockerfile: string): Finding[] => {
  const findings: Finding[] = [];

  if (!config.nonRootUser) {
    findings.push({
      level: "warning",
      title: "Running as root",
      message: "Container runs as root by default. Add a non-root user with USER instruction.",
    });
  }

  if (!config.healthCheck) {
    findings.push({
      level: "warning",
      title: "Missing health check",
      message: "Add HEALTHCHECK so Docker can detect unhealthy containers.",
    });
  }

  if (config.framework === "go" || config.framework === "rust") {
    if (!dockerfile.includes("distroless")) {
      findings.push({
        level: "info",
        title: "Consider distroless",
        message: "Use gcr.io/distroless/static for minimal attack surface (~2MB).",
      });
    }
  }

  if (["node", "express", "nestjs", "nextjs", "react", "vue"].includes(config.framework)) {
    if (!config.baseImage.includes("alpine") && !config.baseImage.includes("slim") && !config.baseImage.includes("distroless")) {
      findings.push({
        level: "warning",
        title: "Large base image",
        message: "Use alpine or distroless variants to dramatically reduce image size.",
      });
    }
  }

  if (!dockerfile.includes(".dockerignore") && !config.multiStage) {
    findings.push({
      level: "info",
      title: "Generate a .dockerignore",
      message: "A .dockerignore prevents secrets and node_modules from leaking into the image.",
    });
  }

  if (config.framework === "springboot" && !config.buildOptimizations.includes("layered-jar")) {
    findings.push({
      level: "info",
      title: "Enable layered JARs",
      message: "Spring Boot 2.4+ supports layertools extraction for much better Docker layer caching.",
    });
  }

  if (!config.production) {
    findings.push({
      level: "warning",
      title: "Not in production mode",
      message: "NODE_ENV=production enables optimizations and disables dev-only features.",
    });
  }

  return findings;
};

/* ─────────────────────────────────────────────────────────
 * Estimated image size — heuristic
 * ─────────────────────────────────────────────────────── */
export const estimateImageSize = (config: DockerfileConfig): { min: number; max: number; score: number } => {
  const baseMap: Record<string, number> = {
    alpine: 5,
    slim: 80,
    distroless: 2,
    node: 350,
    "node-alpine": 50,
    "node-slim": 180,
    python: 350,
    "python-alpine": 50,
    "python-slim": 120,
    java: 200,
    "eclipse-temurin": 230,
    golang: 350,
    rust: 350,
  };

  let base = 200;
  for (const [key, size] of Object.entries(baseMap)) {
    if (config.baseImage.includes(key)) {
      base = size;
      break;
    }
  }

  // App code
  let codeSize = 5;
  if (config.framework === "springboot") codeSize = 50;
  if (config.framework === "go" || config.framework === "rust") codeSize = 15;
  if (config.framework === "nextjs") codeSize = 30;

  const total = base + codeSize;

  // Production readiness score
  let score = 60;
  if (config.nonRootUser) score += 10;
  if (config.healthCheck) score += 10;
  if (config.multiStage) score += 10;
  if (config.production) score += 5;
  if (config.baseImage.includes("alpine") || config.baseImage.includes("distroless") || config.baseImage.includes("slim")) score += 5;

  return {
    min: Math.round(total * 0.7),
    max: Math.round(total * 1.3),
    score: Math.min(100, score),
  };
};
