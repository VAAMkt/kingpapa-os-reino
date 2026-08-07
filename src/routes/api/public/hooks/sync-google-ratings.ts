// Hook público para sincronizar la reputación de Google de todas las sedes.
//
// Programable vía pg_cron con `INTERNAL_CRON_SECRET` en Authorization.
// Route path: /api/public/hooks/sync-google-ratings (bypassa auth por prefijo).

import { createFileRoute } from "@tanstack/react-router";
import { authorizeCronRequest } from "@/lib/cron-auth.server";

export const Route = createFileRoute("/api/public/hooks/sync-google-ratings")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = authorizeCronRequest(request);
        if (unauthorized) return unauthorized;

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
          note: "POST autenticado sincroniza el rating de Google.",
        }),
    },
  },
});
