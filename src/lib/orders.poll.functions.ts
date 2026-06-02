// Resolver de ID de pedido. Acepta UUID de `orders.id` o `rp_pedido_id`
// numérico (delivery_id del POS) y devuelve el UUID real (necesario para
// Realtime).
//
// El polling activo contra Restaurant.pe (pollOrderFromRp) fue eliminado:
// ahora dependemos 100% del webhook + Supabase Realtime. Para cancelaciones
// que RP no notifica (ver rp-soporte-webhook-cancelacion.md), el operador
// marca el pedido manualmente desde /admin/pedidos.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resuelve el id de pedido aceptando UUID o `rp_pedido_id` numérico.
 * Devuelve el UUID real de `orders.id` (necesario para Realtime).
 */
export const resolveOrderId = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ ref: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data }) => {
    const ref = data.ref.trim();
    if (UUID_RE.test(ref)) {
      const { data: row } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("id", ref)
        .maybeSingle();
      return row ? { id: row.id } : { notFound: true as const };
    }
    const { data: rows } = await supabaseAdmin
      .from("orders")
      .select("id, created_at")
      .eq("rp_pedido_id", ref)
      .order("created_at", { ascending: false })
      .limit(1);
    if (rows && rows.length > 0) return { id: rows[0].id };
    return { notFound: true as const };
  });
