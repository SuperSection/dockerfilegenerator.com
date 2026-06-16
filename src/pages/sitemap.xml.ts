import type { APIRoute } from "astro";

interface PageEntry {
  path: string;
  priority: string;
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
}

const pages: PageEntry[] = [
  { path: "",               priority: "1.0", changefreq: "weekly"   },
  { path: "compose",        priority: "0.9", changefreq: "weekly"   },
  { path: "stack-builder",  priority: "0.9", changefreq: "weekly"   },
  { path: "about",          priority: "0.5", changefreq: "monthly"  },
  { path: "contact",        priority: "0.5", changefreq: "monthly"  },
  { path: "privacy-policy", priority: "0.3", changefreq: "yearly"   },
  { path: "terms",          priority: "0.3", changefreq: "yearly"   },
];

export const GET: APIRoute = ({ site }) => {
  const base = (site?.toString() ?? "https://dockerfilegenerator.com").replace(/\/$/, "");
  const lastmod = new Date().toISOString().split("T")[0];

  const urls = pages
    .map(
      (p) =>
        `  <url>\n` +
        `    <loc>${base}/${p.path}</loc>\n` +
        `    <lastmod>${lastmod}</lastmod>\n` +
        `    <changefreq>${p.changefreq}</changefreq>\n` +
        `    <priority>${p.priority}</priority>\n` +
        `  </url>`
    )
    .join("\n");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls}\n` +
    `</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
