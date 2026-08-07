// Hook público para reconciliación (Fase 1+2).
//
// Ejecuta:
//   - checkQuipuBacklog: alerta pedidos KingPapa atascados antes de Quipu.
//   - pollActiveOrders: pull determinista de estado desde el tenant.
//
// Puede programarse vía pg_cron con `INTERNAL_CRON_SECRET` en Authorization.
//
// Route path: /api/public/hooks/rp-reconcile  (bypassa auth por prefijo).

import { createFileRoute } from "@tanstack/react-router";
import { authorizeCronRequest } from "@/lib/cron-auth.server";
import { syncRestaurantPeLoyaltyHistoryCore } from "@/lib/loyalty-history.server";
import { checkQuipuBacklogCore, pollActiveOrdersCore } from "@/lib/rp-reconcile.functions";

export const Route = createFileRoute("/api/public/hooks/rp-reconcile")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = authorizeCronRequest(request);
        if (unauthorized) return unauthorized;

        const startedAt = Date.now();
        const [pollRes, backlogRes, loyaltyHistoryRes] = await Promise.allSettled([
          pollActiveOrdersCore(),
          checkQuipuBacklogCore(),
          syncRestaurantPeLoyaltyHistoryCore(),
        ]);
        return Response.json({
          ok: true,
          elapsed_ms: Date.now() - startedAt,
          poll: pollRes.status === "fulfilled" ? pollRes.value : { error: String(pollRes.reason) },
          backlog:
            backlogRes.status === "fulfilled"
              ? backlogRes.value
              : { error: String(backlogRes.reason) },
          loyalty_history:
            loyaltyHistoryRes.status === "fulfilled"
              ? loyaltyHistoryRes.value
              : { error: String(loyaltyHistoryRes.reason) },
        });
      },
      GET: async () =>
        Response.json({
          ok: true,
          service: "rp-reconcile",
          method: "POST",
          note: "POST autenticado ejecuta la reconciliación.",
        }),
    },
  },
});
