// Hook público para sincronizar la reputación de Google de todas las sedes.
//
// Programable vía pg_cron (header `apikey` = SUPABASE_PUBLISHABLE_KEY). Sin llave = 401.
// Route path: /api/public/hooks/sync-google-ratings (bypassa auth por prefijo).

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/sync-google-ratings")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        const apikey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          null;
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const startedAt = Date.now();
        try {
          const { syncGoogleRatingsCore } = await import("@/lib/google-places.server");
          const summary = await syncGoogleRatingsCore(null);
          return Response.json({ ...summary, elapsed_ms: Date.now() - startedAt });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
      GET: async () =>
        Response.json({
          ok: true,
          service: "sync-google-ratings",
          method: "POST",
          note: "POST con header apikey=<SUPABASE_PUBLISHABLE_KEY> sincroniza el rating de Google de todas las sedes con google_place_id.",
        }),
    },
  },
});
