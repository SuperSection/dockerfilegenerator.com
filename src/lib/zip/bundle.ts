import JSZip from "jszip";

export type BundleFiles = Record<string, string>;

/**
 * Create a ZIP file (browser-friendly) from an in-memory map.
 * Keys are file paths inside the ZIP (e.g. "services/api/Dockerfile").
 */
export async function zipBundle(files: BundleFiles): Promise<Uint8Array> {
    const zip = new JSZip();

    for (const [path, content] of Object.entries(files)) {
        // JSZip supports nested paths directly.
        zip.file(path, content);
    }

    return zip.generateAsync({ type: "uint8array" });
}

/**
 * Convenience: produce a downloadable Blob for client-side download.
 */
export async function zipBundleAsBlob(files: BundleFiles): Promise<Blob> {
    const u8 = await zipBundle(files);
    // Work around TS BlobPart incompatibilities across DOM libs.
    return new Blob([u8 as unknown as BlobPart], { type: "application/zip" });
}
