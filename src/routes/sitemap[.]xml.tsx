import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { listAllPosts } from "@/lib/posts";

const SITE_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SITE_URL) ||
  "https://kingpapacali.com";

const STATIC_PATHS: { path: string; changefreq: string; priority: string }[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/menu", changefreq: "weekly", priority: "0.9" },
  { path: "/sedes", changefreq: "monthly", priority: "0.8" },
  { path: "/historias", changefreq: "daily", priority: "0.9" },
  { path: "/franquicias", changefreq: "monthly", priority: "0.7" },
  { path: "/login", changefreq: "yearly", priority: "0.2" },
  { path: "/registro", changefreq: "yearly", priority: "0.2" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        let posts: { slug: string; fecha: string; publicado: boolean; updated_at: string }[] = [];
        try {
          const all = await listAllPosts();
          posts = all
            .filter((p) => p.publicado)
            .map((p) => ({
              slug: p.slug,
              fecha: p.fecha,
              publicado: p.publicado,
              updated_at: p.updated_at,
            }));
        } catch {
          posts = [];
        }

        const urls = [
          ...STATIC_PATHS.map(
            (e) =>
              `  <url><loc>${SITE_URL}${e.path}</loc><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`,
          ),
          ...posts.map(
            (p) =>
              `  <url><loc>${SITE_URL}/historias/${p.slug}</loc><lastmod>${(p.updated_at ?? p.fecha).slice(0, 10)}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`,
          ),
        ];

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
