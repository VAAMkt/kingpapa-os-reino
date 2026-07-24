// Hook público para reconciliación (Fase 1+2).
//
// Ejecuta:
//   - checkQuipuBacklog: alerta pedidos KingPapa atascados antes de Quipu.
//   - pollActiveOrders: pull determinista de estado desde el tenant.
//
// Puede llamarse manualmente desde /admin/integraciones o programarse vía
// pg_cron (SUPABASE_ANON_KEY en header `apikey`). Sin llave = 401.
//
// Route path: /api/public/hooks/rp-reconcile  (bypassa auth por prefijo).

import { createFileRoute } from "@tanstack/react-router";
import {
  checkQuipuBacklog,
  pollActiveOrders,
} from "@/lib/rp-reconcile.functions";

export const Route = createFileRoute("/api/public/hooks/rp-reconcile")({
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
        const [pollRes, backlogRes] = await Promise.allSettled([
          pollActiveOrders({} as never),
          checkQuipuBacklog({} as never),
        ]);
        return Response.json({
          ok: true,
          elapsed_ms: Date.now() - startedAt,
          poll:
            pollRes.status === "fulfilled"
              ? pollRes.value
              : { error: String(pollRes.reason) },
          backlog:
            backlogRes.status === "fulfilled"
              ? backlogRes.value
              : { error: String(backlogRes.reason) },
        });
      },
      GET: async () =>
        Response.json({
          ok: true,
          service: "rp-reconcile",
          method: "POST",
          note: "POST con header apikey=<SUPABASE_PUBLISHABLE_KEY> ejecuta la reconciliación.",
        }),
    },
  },
});
