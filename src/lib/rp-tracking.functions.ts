// Server function pública para el tracker del cliente (/gracias).
// Devuelve estado + datos del motorizado si el poll ya los capturó.
// Sin secretos: sólo se comparten campos seguros para el cliente que ya
// posee el UUID del pedido (el UUID es no-adivinable, mismo criterio que /gracias).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { MotorizadoInfo } from "@/lib/restaurantpe-normalize";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OrderTrackingSnapshot = {
  orderId: string;
  status: string;
  rp_pedido_id: string | null;
  rp_numero_comanda: string | null;
  created_at: string;
  updated_at: string;
  cancel_reason: string | null;
  motorizado: MotorizadoInfo | null;
  poll_snapshot_at: string | null;
};

export const getOrderTracking = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ orderId: z.string().regex(UUID_RE) }).parse(input))
  .handler(async ({ data }): Promise<OrderTrackingSnapshot | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("orders")
      .select(
        "id, status, rp_pedido_id, rp_numero_comanda, created_at, updated_at, cancel_reason, rp_response",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (!row) return null;

    let motorizado: MotorizadoInfo | null = null;
    let poll_snapshot_at: string | null = null;
    const resp = row.rp_response;
    if (resp && typeof resp === "object" && !Array.isArray(resp)) {
      const r = resp as Record<string, unknown>;
      const m = r.live_motorizado;
      if (m && typeof m === "object" && !Array.isArray(m)) {
        motorizado = m as MotorizadoInfo;
      }
      if (typeof r.poll_snapshot_at === "string") {
        poll_snapshot_at = r.poll_snapshot_at;
      }
    }

    return {
      orderId: row.id,
      status: row.status,
      rp_pedido_id: row.rp_pedido_id,
      rp_numero_comanda: row.rp_numero_comanda,
      created_at: row.created_at,
      updated_at: row.updated_at,
      cancel_reason: row.cancel_reason,
      motorizado,
      poll_snapshot_at,
    };
  });
