import type { MicroserviceConfig, ServiceOverride } from "./schema";
import { generateMicroserviceCompose } from "./generator";
import { generateMicroserviceDockerfile, applicationServiceIds } from "./dockerfile";
import { generateMicroserviceEnv } from "./env";
import { generateMicroserviceReadme } from "./readme";
import { zipBundleAsBlob } from "../zip/bundle";
import { generateDockerignore } from "../dockerfile/generator";

export type MicroserviceExportFiles = Record<string, string>;

export interface MicroserviceExportOptions {
    composeFileName?: string;
    dockerfileBasePath?: string;
    rootDir?: string;
    includeDockerignore?: boolean;
    includeRootDockerignore?: boolean;
}

const ensureComposeFileName = (cfg: MicroserviceConfig, opt?: MicroserviceExportOptions) =>
    opt?.composeFileName ?? cfg.composeFileName ?? "compose.yaml";

export const generateMicroserviceExportFiles = (
    cfg: MicroserviceConfig,
    options: MicroserviceExportOptions = {},
): MicroserviceExportFiles => {
    const rootDir = options.rootDir ?? cfg.projectName;
    const composeFileName = ensureComposeFileName(cfg, options);
    const includeDockerignore = options.includeDockerignore ?? true;
    const includeRootDockerignore = options.includeRootDockerignore ?? true;

    const files: MicroserviceExportFiles = {};

    // Core root files
    files[`${rootDir}/${composeFileName}`] = generateMicroserviceCompose(cfg);
    files[`${rootDir}/README.md`] = generateMicroserviceReadme(cfg);
    files[`${rootDir}/.env.example`] = generateMicroserviceEnv(cfg);

    // Root dockerignore
    if (includeRootDockerignore) {
        files[`${rootDir}/.dockerignore`] = [
            "# Generic dockerignore for project export.",
            "# Recommended: keep generated artifacts out of the build context.",
            "",
            "node_modules",
            "dist",
            "build",
            ".env",
            ".env.*",
            "secrets/",
            "*.log",
            "",
        ].join("\n");
    }

    // Per-service Dockerfiles for application services
    const appIds = applicationServiceIds(cfg);
    for (const id of appIds) {
        const dockerfile = generateMicroserviceDockerfile(id, cfg);
        if (!dockerfile) continue;
        files[`${rootDir}/${id}/Dockerfile`] = dockerfile;

        if (includeDockerignore) {
            const fw = (cfg.services[id].framework ?? "node") as any;
            files[`${rootDir}/${id}/.dockerignore`] = generateDockerignore(fw);
        }
    }

    return files;
};

export const zipMicroserviceExport = async (
    cfg: MicroserviceConfig,
    options: MicroserviceExportOptions = {},
): Promise<Uint8Array> => {
    const files = generateMicroserviceExportFiles(cfg, options);
    // Use relative paths inside the zip. zipBundleAsBlob expects Blob; we want bytes for flexibility.
    // Reuse existing zipBundleAsBlob consumer elsewhere; this returns bytes.
    // Importing zipBundleAsBlob here would force Blob; instead we inline mapping by calling generator directly
    // is not possible without zipBundle. For now, use zipBundleAsBlob and return bytes as Uint8Array via arrayBuffer.
    const blob = await zipBundleAsBlob(files);
    const u8 = new Uint8Array(await blob.arrayBuffer());
    return u8;
};
