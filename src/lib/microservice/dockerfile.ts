/**
 * Microservice Builder — per-service Dockerfile generator.
 *
 * Wraps the existing `generateDockerfile` from src/lib/dockerfile/generator.ts
 * so the microservice builder emits one Dockerfile per application
 * service. Non-application services don't get a Dockerfile — they
 * reference upstream images.
 */

import type { ServiceOverride, MicroserviceConfig } from "./schema";
import type { FrameworkId, PackageManager } from "../dockerfile/frameworks";
import { generateDockerfile, generateDockerignore } from "../dockerfile/generator";

/**
 * Build a Dockerfile for one service. Returns null if the service
 * is not an application service (use a published image instead).
 */
export const generateMicroserviceDockerfile = (
  serviceId: string,
  cfg: MicroserviceConfig,
): string | null => {
  const svc = cfg.services[serviceId];
  if (!svc) return null;

  // Non-app services use a published image; no Dockerfile emitted.
  if (svc.build === undefined && svc.category && svc.category !== "application") {
    return null;
  }

  const fw: FrameworkId = svc.framework ?? "node";
  const port =
    svc.ports?.[0]?.container ??
    (svc.healthCheck?.test?.[0]?.includes("localhost:") ? extractPort(svc.healthCheck.test[0]) : 3000);
  const envVars = (svc.envVars ?? [])
    .filter((e) => (e.kind ?? "literal") !== "secret-ref")
    .map((e) => ({ key: e.key, value: e.value ?? "" }));

  const dockerfileCfg = {
    framework: fw,
    baseImage: pickBaseImage(fw, svc),
    port,
    workdir: svc.workingDir ?? "/app",
    packageManager: pickPackageManager(fw),
    multiStage: true,
    production: true,
    nonRootUser: (svc.security?.preset ?? "relaxed") !== "relaxed",
    healthCheck: svc.healthCheck?.disable !== true,
    envVars,
    buildOptimizations: pickOptimizations(fw),
    customStartCommand: svc.command?.join(" "),
    nodeVersion: "20",
    pythonVersion: "3.12",
    javaVersion: "21",
    goVersion: "1.22",
  };

  return generateDockerfile(dockerfileCfg);
};

const pickBaseImage = (fw: FrameworkId, _svc: ServiceOverride): string => {
  switch (fw) {
    case "node":
    case "express":
    case "nestjs":
    case "nextjs":
    case "react":
    case "vue":
    case "fastify":
    case "gin":
      return "node:20-alpine";
    case "python":
    case "django":
    case "fastapi":
    case "flask":
      return "python:3.12-slim";
    case "java":
    case "springboot":
    case "quarkus":
      return "eclipse-temurin:21-jre";
    case "go":
      return "gcr.io/distroless/static-debian12";
    case "rust":
    case "actix":
      return "gcr.io/distroless/cc-debian12";
    case "php":
    case "laravel":
      return "php:8.3-fpm-alpine";
    case "rails":
      return "ruby:3.3-slim";
    case "dotnet":
      return "mcr.microsoft.com/dotnet/aspnet:9.0";
    case "phoenix":
      return "alpine:3.20";
    default:
      return "node:20-alpine";
  }
};

const pickPackageManager = (fw: FrameworkId): PackageManager => {
  switch (fw) {
    case "node":
    case "express":
    case "nestjs":
    case "nextjs":
    case "react":
    case "vue":
    case "fastify":
    case "gin":
      return "npm";
    case "python":
    case "django":
    case "fastapi":
    case "flask":
      return "pip";
    case "java":
    case "springboot":
    case "quarkus":
      return "maven";
    case "go":
      return "go";
    case "rust":
    case "actix":
      return "cargo";
    case "php":
    case "laravel":
      return "composer";
    default:
      return "npm";
  }
};

const pickOptimizations = (fw: FrameworkId): string[] => {
  if (fw === "nextjs") return ["standalone"];
  if (fw === "springboot") return ["layered-jar"];
  return [];
};

const extractPort = (s: string): number => {
  const m = s.match(/localhost:(\d+)/);
  return m ? parseInt(m[1], 10) : 3000;
};

/** Re-export so consumers can grab the per-framework .dockerignore. */
export { generateDockerignore };

/** List all application service ids in a config (those that get a Dockerfile). */
export const applicationServiceIds = (cfg: MicroserviceConfig): string[] => {
  return Object.values(cfg.services)
    .filter((s) => s.build !== undefined || s.category === "application" || !s.category)
    .map((s) => s.id);
};
