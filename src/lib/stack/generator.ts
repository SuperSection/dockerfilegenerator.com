/**
 * Stack Builder — full-stack generation.
 * Composes a Dockerfile + docker-compose.yml + .env.example + .dockerignore
 * from Frontend × Backend × Database × Optional services.
 *
 * Image versions are routed through the central registry
 * (`~/registry`). Adding a new optional service = drop a seed.
 */

import {
  FRONTENDS,
  BACKENDS,
  DATABASES,
  buildConnectionString,
  type Frontend,
  type Backend,
  type Database,
  type Optional,
} from "./presets";
import { getService } from "~/registry";

export interface StackConfig {
  frontend?: Frontend;
  backend?: Backend;
  database?: Database;
  optional: Optional[];
  projectName: string;
  /**
   * If true, env values in the generated compose are emitted as
   * `${KEY}` references — Compose auto-resolves them from the
   * project-level `.env` file at startup. If false, values are
   * inlined directly. Mirrors `ComposeConfig.useEnvFile` so the two
   * generators stay consistent.
   */
  useEnvFile?: boolean;
  /**
   * Per-service image+tag overrides keyed by service id. The Stack
   * Builder UI populates this from its per-card configure modal;
   * the generator resolves the final image:tag for each service by
   * checking this map first, then the registry.
   */
  serviceOverrides?: Record<string, { image?: string; tag?: string }>;
}

const dockerfileForNode = (cfg: StackConfig, which: "frontend" | "backend"): string => {
  const meta = which === "frontend" ? FRONTENDS[cfg.frontend!] : BACKENDS[cfg.backend!];
  const isFrontend = which === "frontend";
  const startCmd = isFrontend ? meta.startCmd : BACKENDS[cfg.backend!].startCmd;
  const port = meta.port;
  // buildCmd only exists on FrontendMeta (backends have a runtime startCmd
  // and no separate build step in this generator). We use a typed cast
  // here so the SPA path can still read it without TS complaining about
  // the union.
  const buildCmd = isFrontend ? (meta as typeof FRONTENDS[keyof typeof FRONTENDS]).buildCmd : "";

  // Static SPA frontend (react/vue) — build to nginx
  if (isFrontend && (cfg.frontend === "react" || cfg.frontend === "vue")) {
    return `# syntax=docker/dockerfile:1.7

# ---- Build stage ----
FROM ${meta.baseImage} AS builder
WORKDIR ${meta.workdir}
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN ${isFrontend ? buildCmd : meta.startCmd}

# ---- Runtime: nginx ----
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget --spider -q http://localhost/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
`;
  }

  // Next.js with standalone
  if (isFrontend && cfg.frontend === "nextjs") {
    return `# syntax=docker/dockerfile:1.7

# ---- Dependencies ----
FROM ${meta.baseImage} AS deps
WORKDIR ${meta.workdir}
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Builder ----
FROM ${meta.baseImage} AS builder
WORKDIR ${meta.workdir}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- Runner ----
FROM ${meta.baseImage} AS runner
WORKDIR ${meta.workdir}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs \\
 && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE ${port}
ENV PORT=${port} HOSTNAME=0.0.0.0
HEALTHCHECK --interval=30s --timeout=3s CMD wget --spider -q http://localhost:${port}/ || exit 1
CMD ["node", "server.js"]
`;
  }

  // Nuxt
  if (isFrontend && cfg.frontend === "nuxt") {
    return `# syntax=docker/dockerfile:1.7

# ---- Build ----
FROM ${meta.baseImage} AS builder
WORKDIR ${meta.workdir}
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime ----
FROM ${meta.baseImage}
WORKDIR ${meta.workdir}
ENV NODE_ENV=production
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=${port}
COPY --from=builder --chown=node:node /app/.output ./.output
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./
EXPOSE ${port}
HEALTHCHECK --interval=30s --timeout=3s CMD wget --spider -q http://localhost:${port}/ || exit 1
CMD ["node", ".output/server/index.mjs"]
`;
  }

  // Backend — Node (Express/NestJS) — multi-stage
  if (!isFrontend && (cfg.backend === "express" || cfg.backend === "nestjs")) {
    return `# syntax=docker/dockerfile:1.7

# ---- Build ----
FROM ${meta.baseImage} AS builder
WORKDIR ${meta.workdir}
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime ----
FROM ${meta.baseImage} AS runner
WORKDIR ${meta.workdir}
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \\
 && adduser --system --uid 1001 appuser
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/package.json ./
USER appuser
EXPOSE ${port}
HEALTHCHECK --interval=30s --timeout=3s CMD wget --spider -q http://localhost:${port}/ || exit 1
CMD ${JSON.stringify(startCmd.split(/\s+/))}
`;
  }

  // Fallback generic
  return `# syntax=docker/dockerfile:1.7
FROM ${meta.baseImage}
WORKDIR ${meta.workdir}
COPY . .
EXPOSE ${port}
CMD ${JSON.stringify(startCmd.split(/\s+/))}
`;
};

const dockerfileForFastapi = (_cfg: StackConfig): string => {
  return `# syntax=docker/dockerfile:1.7

# ---- Builder ----
FROM python:3.12-slim AS builder
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
COPY requirements.txt ./
RUN pip install --user --no-cache-dir -r requirements.txt

# ---- Runtime ----
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
ENV PATH=/home/appuser/.local/bin:$PATH
RUN useradd --create-home --shell /bin/bash --uid 1001 appuser
COPY --from=builder /home/appuser/.local /home/appuser/.local
COPY --chown=appuser:appuser . .
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
`;
};

const dockerfileForSpringBoot = (_cfg: StackConfig): string => {
  return `# syntax=docker/dockerfile:1.7

# ---- Build ----
FROM eclipse-temurin:21-jdk AS builder
WORKDIR /app
COPY mvnw pom.xml* .mvn/ ./
RUN chmod +x mvnw && ./mvnw dependency:go-offline -B > /dev/null 2>&1 || true
COPY src ./src
RUN ./mvnw package -DskipTests
RUN cp target/*.jar app.jar && java -Djarmode=layertools -jar app.jar extract

# ---- Runtime ----
FROM eclipse-temurin:21-jre
WORKDIR /app
RUN groupadd --system --gid 1001 appuser && useradd --system --uid 1001 --gid appuser appuser
COPY --from=builder app/dependencies/ ./
COPY --from=builder app/spring-boot-loader/ ./
COPY --from=builder app/snapshot-dependencies/ ./
COPY --from=builder app/application/ ./
USER appuser
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget --spider -q http://localhost:8080/actuator/health || exit 1
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
`;
};

export const generateStackDockerfile = (cfg: StackConfig, target: "frontend" | "backend"): string => {
  if (target === "backend" && cfg.backend === "fastapi") return dockerfileForFastapi(cfg);
  if (target === "backend" && cfg.backend === "springboot") return dockerfileForSpringBoot(cfg);
  return dockerfileForNode(cfg, target);
};

const renderService = (name: string, lines: string[]) => {
  return `${name}:\n${lines.join("\n")}`;
};

export const generateStackCompose = (cfg: StackConfig): string => {
  const lines: string[] = [];
  lines.push("# Generated by dockerfilegenerator.com");
  lines.push("# Full-stack docker-compose.yml");
  lines.push(`name: ${cfg.projectName}`);
  lines.push("");
  lines.push("services:");

  // Database
  if (cfg.database) {
    const db = DATABASES[cfg.database];
    const serviceName = cfg.database === "mongodb" ? "mongo" : cfg.database;
    const healthCmd = cfg.database === "postgres"
      ? `["pg_isready", "-U", "app"]`
      : cfg.database === "mysql"
      ? `["mysqladmin", "ping", "-h", "localhost"]`
      : `["mongosh", "--eval", "db.adminCommand('ping')"]`;
    const dbEnvLines = db.env.map(e => {
      if (cfg.useEnvFile) return `    ${e.key}: "\${${e.key}}"`;
      return `    ${e.key}: ${JSON.stringify(e.value)}`;
    });
    // Pull image+tag from registry first, then serviceOverrides, then
    // the legacy `db.tag` for back-compat until a sync has run.
    const reg = getService(cfg.database);
    const ovr = cfg.serviceOverrides?.[cfg.database];
    const dbImage = ovr?.image ?? reg?.image ?? db.image;
    const dbTag = ovr?.tag ?? reg?.recommended ?? db.tag;
    lines.push("");
    lines.push(renderService(serviceName, [
      `  image: ${dbImage}:${dbTag}`,
      `  container_name: ${serviceName}`,
      `  restart: unless-stopped`,
      `  environment:`,
      ...dbEnvLines,
      `  volumes:`,
      `    - ${db.volume}`,
      `  ports:`,
      `    - "${db.port}:${db.port}"`,
      `  healthcheck:`,
      `    test: ${healthCmd}`,
      `    interval: 10s`,
      `    timeout: 5s`,
      `    retries: 5`,
      `    start_period: 30s`,
      `  networks:`,
      `    - appnet`,
    ]));
  }

  // Backend
  if (cfg.backend) {
    const be = BACKENDS[cfg.backend];
    const envLines: string[] = be.env.map(e => {
      if (cfg.useEnvFile) {
        // Reference the .env variable so secrets stay out of compose.
        return `      ${e.key}: "\${${e.key}}"`;
      }
      return `      ${e.key}: ${JSON.stringify(e.value)}`;
    });
    if (cfg.database) {
      const db = DATABASES[cfg.database];
      const urlKey = db.dependsOnEnvVar;
      if (cfg.useEnvFile) {
        envLines.push(`      ${urlKey}: "\${${urlKey}}"`);
      } else {
        const url = buildConnectionString(db.id);
        envLines.push(`      ${urlKey}: ${JSON.stringify(url)}`);
      }
    }
    cfg.optional.forEach((o) => {
      if (o === "redis") {
        if (cfg.useEnvFile) {
          envLines.push(`      REDIS_URL: "\${REDIS_URL}"`);
        } else {
          envLines.push(`      REDIS_URL: ${JSON.stringify("redis://redis:6379")}`);
        }
      }
      if (o === "rabbitmq") {
        if (cfg.useEnvFile) {
          envLines.push(`      RABBITMQ_URL: "\${RABBITMQ_URL}"`);
        } else {
          envLines.push(`      RABBITMQ_URL: ${JSON.stringify("amqp://guest:guest@rabbitmq:5672")}`);
        }
      }
      if (o === "kafka") {
        if (cfg.useEnvFile) {
          envLines.push(`      KAFKA_BROKERS: "\${KAFKA_BROKERS}"`);
        } else {
          envLines.push(`      KAFKA_BROKERS: ${JSON.stringify("kafka:9092")}`);
        }
      }
    });

    const deps: string[] = [];
    if (cfg.database) deps.push(cfg.database === "mongodb" ? "mongo" : cfg.database);
    if (cfg.optional.includes("redis")) deps.push("redis");
    if (cfg.optional.includes("rabbitmq")) deps.push("rabbitmq");
    if (cfg.optional.includes("kafka")) deps.push("kafka");

    lines.push("");
    lines.push(renderService("backend", [
      `  build:`,
      `    context: ./backend`,
      `    dockerfile: Dockerfile`,
      `  container_name: backend`,
      `  restart: unless-stopped`,
      `  ports:`,
      `    - "${be.port}:${be.port}"`,
      `  environment:`,
      ...envLines,
      ...(deps.length ? [
        `  depends_on:`,
        ...deps.map(d => `    ${d}:\n      condition: service_healthy`),
      ] : []),
      `  healthcheck:`,
      `    test: ["CMD", "wget", "--spider", "-q", "http://localhost:${be.port}/"]`,
      `    interval: 30s`,
      `    timeout: 3s`,
      `    retries: 3`,
      `  networks:`,
      `    - appnet`,
    ]));
  }

  // Frontend
  if (cfg.frontend) {
    const fe = FRONTENDS[cfg.frontend];
    const isSPA = fe.id === "react" || fe.id === "vue";
    const deps: string[] = [];
    if (cfg.backend && !isSPA) deps.push("backend");
    if (cfg.optional.includes("nginx") && isSPA) deps.push("nginx");

    lines.push("");
    lines.push(renderService("frontend", [
      `  build:`,
      `    context: ./frontend`,
      `    dockerfile: Dockerfile`,
      `  container_name: frontend`,
      `  restart: unless-stopped`,
      `  ports:`,
      `    - "${fe.port}:${fe.port}"`,
      ...(cfg.backend ? [
        `  environment:`,
        cfg.useEnvFile
          ? `    API_URL: "\${API_URL}"`
          : `    API_URL: ${JSON.stringify(`http://backend:${BACKENDS[cfg.backend].port}`)}`,
      ] : []),
      ...(deps.length ? [
        `  depends_on:`,
        ...deps.map(d => `    ${d}:\n      condition: service_started`),
      ] : []),
      `  networks:`,
      `    - appnet`,
    ]));
  }

  // Optional services
  cfg.optional.forEach((o) => {
    if (o === "redis") {
      // Pull image+tag from overrides → registry → fallback. Never
      // hardcode in this file.
      const r = getService("redis");
      const ovr = cfg.serviceOverrides?.["redis"];
      const image = ovr?.image ?? r?.image ?? "redis";
      const tag = ovr?.tag ?? r?.recommended ?? "7-alpine";
      lines.push("");
      lines.push(renderService("redis", [
        `  image: ${image}:${tag}`,
        `  container_name: redis`,
        `  restart: unless-stopped`,
        `  ports:`,
        `    - "6379:6379"`,
        `  volumes:`,
        `    - redis_data:/data`,
        `  healthcheck:`,
        `    test: ["CMD", "redis-cli", "ping"]`,
        `    interval: 10s`,
        `    timeout: 3s`,
        `    retries: 3`,
        `  networks:`,
        `    - appnet`,
      ]));
    } else if (o === "rabbitmq") {
      const env = cfg.useEnvFile
        ? `    RABBITMQ_DEFAULT_USER: "\${RABBITMQ_USER}"\n    RABBITMQ_DEFAULT_PASS: "\${RABBITMQ_PASSWORD}"`
        : `    RABBITMQ_DEFAULT_USER: guest\n    RABBITMQ_DEFAULT_PASS: guest`;
      const r = getService("rabbitmq");
      const ovr = cfg.serviceOverrides?.["rabbitmq"];
      const image = ovr?.image ?? r?.image ?? "rabbitmq";
      const tag = ovr?.tag ?? r?.recommended ?? "3.13-management-alpine";
      lines.push("");
      lines.push(renderService("rabbitmq", [
        `  image: ${image}:${tag}`,
        `  container_name: rabbitmq`,
        `  restart: unless-stopped`,
        `  ports:`,
        `    - "5672:5672"`,
        `    - "15672:15672"`,
        `  environment:`,
        env,
        `  volumes:`,
        `    - rabbitmq_data:/var/lib/rabbitmq`,
        `  healthcheck:`,
        `    test: ["CMD", "rabbitmq-diagnostics", "ping"]`,
        `    interval: 10s`,
        `    timeout: 5s`,
        `    retries: 5`,
        `  networks:`,
        `    - appnet`,
      ]));
    } else if (o === "kafka") {
      // Bitnami's bitnami/kafka is the well-trodden path. The registry's
      // "kafka" entry currently maps to apache/kafka (the upstream Apache
      // image), which has different env var conventions. Resolve via
      // the registry when possible; otherwise fall back to bitnami for
      // back-compat with the existing env block below.
      const r = getService("kafka");
      const ovr = cfg.serviceOverrides?.["kafka"];
      const image = ovr?.image ?? r?.image ?? "bitnami/kafka";
      const tag = ovr?.tag ?? r?.recommended ?? "3.7";
      lines.push("");
      lines.push(renderService("kafka", [
        `  image: ${image}:${tag}`,
        `  container_name: kafka`,
        `  restart: unless-stopped`,
        `  ports:`,
        `    - "9092:9092"`,
        `  environment:`,
        `    KAFKA_CFG_NODE_ID: "0"`,
        `    KAFKA_CFG_PROCESS_ROLES: "controller,broker"`,
        `    KAFKA_CFG_LISTENERS: "PLAINTEXT://:9092,CONTROLLER://:9093"`,
        `    KAFKA_CFG_ADVERTISED_LISTENERS: "PLAINTEXT://kafka:9092"`,
        `    KAFKA_CFG_CONTROLLER_LISTENER_NAMES: "CONTROLLER"`,
        `    KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP: "CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT"`,
        `    KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: "0@kafka:9093"`,
        `    ALLOW_PLAINTEXT_LISTENER: "yes"`,
        `  volumes:`,
        `    - kafka_data:/bitnami/kafka`,
        `  networks:`,
        `    - appnet`,
      ]));
    } else if (o === "nginx") {
      const r = getService("nginx");
      const ovr = cfg.serviceOverrides?.["nginx"];
      const image = ovr?.image ?? r?.image ?? "nginx";
      const tag = ovr?.tag ?? r?.recommended ?? "1.27-alpine";
      lines.push("");
      lines.push(renderService("nginx", [
        `  image: ${image}:${tag}`,
        `  container_name: nginx`,
        `  restart: unless-stopped`,
        `  ports:`,
        `    - "80:80"`,
        `    - "443:443"`,
        `  volumes:`,
        `    - ./nginx.conf:/etc/nginx/nginx.conf:ro`,
        `  depends_on:`,
        `    - frontend`,
        `  networks:`,
        `    - appnet`,
      ]));
    }
  });

  // Networks
  lines.push("");
  lines.push("networks:");
  lines.push("  appnet:");
  lines.push("    driver: bridge");

  // Volumes
  const vols: string[] = [];
  if (cfg.database) vols.push(`${cfg.database}_data`);
  if (cfg.optional.includes("redis")) vols.push("redis_data");
  if (cfg.optional.includes("rabbitmq")) vols.push("rabbitmq_data");
  if (cfg.optional.includes("kafka")) vols.push("kafka_data");
  if (vols.length) {
    lines.push("");
    lines.push("volumes:");
    vols.forEach((v) => {
      lines.push(`  ${v}:`);
      lines.push(`    driver: local`);
    });
  }
  lines.push("");

  return lines.join("\n");
};

export const generateStackEnv = (cfg: StackConfig): string => {
  const lines: string[] = ["# Generated by dockerfilegenerator.com", "# Copy to .env and fill in real values.", ""];
  if (cfg.database) {
    const db = DATABASES[cfg.database];
    lines.push(`# ${db.name}`);
    db.env.forEach((e) => lines.push(`${e.key}=${e.value}`));
    lines.push("");
    const urlKey = db.dependsOnEnvVar;
    lines.push(`${urlKey}=${buildConnectionString(db.id)}`);
    lines.push("");
  }
  if (cfg.backend) {
    const be = BACKENDS[cfg.backend];
    lines.push(`# Backend`);
    lines.push(`API_URL=http://backend:${be.port}`);
    lines.push("");
  }
  cfg.optional.forEach((o) => {
    if (o === "redis") {
      lines.push(`# Redis`);
      lines.push(`REDIS_URL=redis://redis:6379`);
      lines.push("");
    }
    if (o === "rabbitmq") {
      lines.push(`# RabbitMQ`);
      lines.push(`RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672`);
      lines.push(`RABBITMQ_USER=guest`);
      lines.push(`RABBITMQ_PASSWORD=guest`);
      lines.push("");
    }
    if (o === "kafka") {
      lines.push(`# Kafka`);
      lines.push(`KAFKA_BROKERS=kafka:9092`);
      lines.push("");
    }
  });
  return lines.join("\n");
};

export const generateStackDockerignore = (_target: "frontend" | "backend"): string => {
  return `node_modules
.next
dist
build
.nuxt
.output
__pycache__
*.pyc
target
.gradle
.idea
.vscode
.git
.env
*.log
coverage
.DS_Store
Dockerfile
docker-compose*.yml
.dockerignore
`;
};
