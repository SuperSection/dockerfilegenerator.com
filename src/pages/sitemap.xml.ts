import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) => {
  const pages = ["", "compose", "stack-builder"];
  const base = (site?.toString() ?? "https://dockerfilegenerator.com").replace(/\/$/, "");
  const urls = pages
    .map(
      (p) =>
        `<url><loc>${base}/${p}</loc><changefreq>weekly</changefreq><priority>${p === "" ? "1.0" : "0.8"}</priority></url>`
    )
    .join("");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    { headers: { "Content-Type": "application/xml" } }
  );
};
