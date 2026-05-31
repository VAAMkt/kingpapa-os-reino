// Server function pública (sin auth): el cliente que está en /gracias puede
// no estar logueado. Solo acepta el orderId, consulta el POS de Restaurant.pe
// y actualiza la fila de orders cuando hay cambios reales (status / comanda).
// Realtime propaga el UPDATE al TrackerOperativo del cliente.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { rpGetPedidoListByDelivery } from "@/lib/restaurantpe.server";
import {
  extractComandaNumber,
  extractEstadoTexto,
  mapRpEstadoToStatus,
  type RpOrderStatus,
} from "@/lib/restaurantpe-normalize";

const TERMINAL: RpOrderStatus[] = ["entregado", "cancelado", "error"];

const Input = z.object({
  orderId: z.string().uuid(),
});

export const pollOrderFromRp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("orders")
      .select("id, status, rp_pedido_id, rp_numero_comanda, cancel_reason")
      .eq("id", data.orderId)
      .maybeSingle();

    if (error) return { ok: false as const, reason: "db_error", message: error.message };
    if (!row) return { ok: false as const, reason: "not_found" };

    const currentStatus = row.status as RpOrderStatus;
    if (TERMINAL.includes(currentStatus)) {
      return { ok: true as const, terminal: true, status: currentStatus };
    }
    if (!row.rp_pedido_id) {
      return { ok: true as const, skipped: "no_rp_id", status: currentStatus };
    }

    const r = await rpGetPedidoListByDelivery(row.rp_pedido_id);
    if (!r) {
      return { ok: true as const, skipped: "rp_unreachable", status: currentStatus };
    }

    const comanda = extractComandaNumber(r.firstItem);
    const estadoTxt = extractEstadoTexto(r.firstItem);
    const mapped = mapRpEstadoToStatus(estadoTxt);

    const updates: Record<string, unknown> = {};
    if (comanda && comanda !== row.rp_numero_comanda) {
      updates.rp_numero_comanda = comanda;
    }
    if (mapped && mapped !== currentStatus) {
      updates.status = mapped;
      if (mapped === "cancelado" && !row.cancel_reason) {
        updates.cancel_reason = "Cancelado desde el POS";
        updates.cancelled_at = new Date().toISOString();
      }
    }

    if (Object.keys(updates).length === 0) {
      return {
        ok: true as const,
        changed: false,
        status: currentStatus,
        rp_numero_comanda: row.rp_numero_comanda,
      };
    }

    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update(updates)
      .eq("id", row.id);

    if (updErr) {
      return { ok: false as const, reason: "update_failed", message: updErr.message };
    }

    return {
      ok: true as const,
      changed: true,
      status: (updates.status as RpOrderStatus) ?? currentStatus,
      rp_numero_comanda: (updates.rp_numero_comanda as string) ?? row.rp_numero_comanda,
    };
  });
