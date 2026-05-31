// Server fn pública: el cliente en /gracias puede no estar logueado.
// Acepta UUID de orders.id o el rp_pedido_id numérico (delivery_id del POS).
// Consulta el endpoint público V2 de Restaurant.pe; si responde, actualiza la
// fila y Realtime propaga el UPDATE al TrackerOperativo del cliente.
// Si el endpoint falla, devuelve silencioso para que el siguiente tick reintente.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { rpObtenerDelivery } from "@/lib/restaurantpe.server";
import {
  extractComandaNumber,
  extractMotorizado,
  extractDeliveryEstado,
  mapDeliveryEstado,
  extractEstadoTexto,
  mapRpEstadoToStatus,
  type RpOrderStatus,
} from "@/lib/restaurantpe-normalize";

const TERMINAL: RpOrderStatus[] = ["entregado", "cancelado", "error"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const Input = z.object({
  orderId: z
    .string()
    .min(1)
    .max(64)
    .transform((s) => s.replace(/^"+|"+$/g, "").trim()),
});

async function findOrderRow(orderId: string) {
  const isUuid = UUID_RE.test(orderId);
  if (isUuid) {
    return supabaseAdmin
      .from("orders")
      .select("id, status, rp_pedido_id, rp_numero_comanda, cancel_reason")
      .eq("id", orderId)
      .maybeSingle();
  }
  // Tratamos como rp_pedido_id (delivery_id numérico del POS).
  return supabaseAdmin
    .from("orders")
    .select("id, status, rp_pedido_id, rp_numero_comanda, cancel_reason")
    .eq("rp_pedido_id", String(orderId))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export const pollOrderFromRp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const { data: row, error } = await findOrderRow(data.orderId);

    if (error) return { ok: false as const, reason: "db_error", message: error.message };
    if (!row) return { ok: false as const, reason: "not_found" };

    const currentStatus = row.status as RpOrderStatus;
    if (TERMINAL.includes(currentStatus)) {
      return { ok: true as const, terminal: true, status: currentStatus, id: row.id };
    }
    if (!row.rp_pedido_id) {
      return { ok: true as const, skipped: "no_rp_id", status: currentStatus, id: row.id };
    }

    const r = await rpObtenerDelivery(row.rp_pedido_id);
    if (!r || !r.delivery) {
      return { ok: true as const, skipped: "rp_unreachable", status: currentStatus, id: row.id };
    }

    const comanda = extractComandaNumber(r.delivery);
    const estadoNum = extractDeliveryEstado(r.delivery);
    let mapped = mapDeliveryEstado(estadoNum);
    // Fallback texto por si algún endpoint legacy responde con string.
    if (!mapped) mapped = mapRpEstadoToStatus(extractEstadoTexto(r.delivery));
    const motorizado = extractMotorizado(r.delivery);

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
        motorizado,
        id: row.id,
      };
    }

    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update(updates as never)
      .eq("id", row.id);

    if (updErr) {
      return { ok: false as const, reason: "update_failed", message: updErr.message };
    }

    return {
      ok: true as const,
      changed: true,
      status: (updates.status as RpOrderStatus) ?? currentStatus,
      rp_numero_comanda: (updates.rp_numero_comanda as string) ?? row.rp_numero_comanda,
      motorizado,
      id: row.id,
    };
  });

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
