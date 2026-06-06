/**
 * Stack Builder — full-stack generation.
 * Composes a Dockerfile + docker-compose.yml + .env.example + .dockerignore
 * from Frontend × Backend × Database × Optional services.
 */

import {
  FRONTENDS,
  BACKENDS,
  DATABASES,
  OPTIONALS,
  buildConnectionString,
  type Frontend,
  type Backend,
  type Database,
  type Optional,
} from "./presets";

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
}

const dockerfileForNode = (cfg: StackConfig, which: "frontend" | "backend"): string => {
  const meta = which === "frontend" ? FRONTENDS[cfg.frontend!] : BACKENDS[cfg.backend!];
  const isFrontend = which === "frontend";
  const startCmd = isFrontend ? meta.startCmd : BACKENDS[cfg.backend!].startCmd;
  const port = meta.port;

  // Static SPA frontend (react/vue) — build to nginx
  if (isFrontend && (cfg.frontend === "react" || cfg.frontend === "vue")) {
    return `# syntax=docker/dockerfile:1.7

# ---- Build stage ----
FROM ${meta.baseImage} AS builder
WORKDIR ${meta.workdir}
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN ${meta.buildCmd}

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

const dockerfileForFastapi = (cfg: StackConfig): string => {
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

const dockerfileForSpringBoot = (cfg: StackConfig): string => {
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
    lines.push("");
    lines.push(renderService(serviceName, [
      `  image: ${db.image}:${db.tag}`,
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
      const url = buildConnectionString(db.id);
      envLines.push(`      ${urlKey}: ${JSON.stringify(url)}`);
    }
    cfg.optional.forEach((o) => {
      if (o === "redis") envLines.push(`      REDIS_URL: ${JSON.stringify("redis://redis:6379")}`);
      if (o === "rabbitmq") envLines.push(`      RABBITMQ_URL: ${JSON.stringify("amqp://guest:guest@rabbitmq:5672")}`);
      if (o === "kafka") envLines.push(`      KAFKA_BROKERS: ${JSON.stringify("kafka:9092")}`);
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
        `    API_URL: ${JSON.stringify(`http://backend:${BACKENDS[cfg.backend].port}`)}`,
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
      lines.push("");
      lines.push(renderService("redis", [
        `  image: redis:7-alpine`,
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
      lines.push("");
      lines.push(renderService("rabbitmq", [
        `  image: rabbitmq:3.13-management-alpine`,
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
      lines.push("");
      lines.push(renderService("kafka", [
        `  image: bitnami/kafka:3.7`,
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
      lines.push("");
      lines.push(renderService("nginx", [
        `  image: nginx:1.27-alpine`,
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
  cfg.optional.forEach((o) => {
    if (o === "redis") lines.push(`REDIS_URL=redis://redis:6379`);
    if (o === "rabbitmq") {
      lines.push(`RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672`);
      lines.push(`RABBITMQ_USER=guest`);
      lines.push(`RABBITMQ_PASSWORD=guest`);
    }
    if (o === "kafka") lines.push(`KAFKA_BROKERS=kafka:9092`);
  });
  return lines.join("\n");
};

export const generateStackDockerignore = (target: "frontend" | "backend"): string => {
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
