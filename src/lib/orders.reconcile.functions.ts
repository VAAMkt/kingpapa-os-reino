// Reconciliación: MODO PASIVO (post-Fase A discovery, jun-2026).
//
// Restaurant.pe no expone ningún GET de lectura por delivery/pedido que
// acepte `RESTAURANT_PE_TOKEN`:
//   - Host por tenant (`https://{sub}.{host}/restaurant/api/rest`): 401
//     "Token inválido" (requiere token de sesión tenant distinto).
//   - Host público (`api.restaurant.pe/{readonly|public/v2}/rest`): 404 en
//     todas las variantes (get / obtenerSyncFull / obtenerDelivery /
//     obtenerPedido / obtenerEstadoDelivery, con o sin dominio_id).
//
// Dependemos 100% del webhook entrante (`/api/public/rp-webhook`) +
// Auto-Kill TTL 45 min. `reconcileOne` ya no llama a RP: sólo cierra la
// orden si pasaron los 45 min sin estado terminal. Cualquier otra
// invocación responde `noop / reconcile_unavailable` (barato, sin red).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

const TERMINAL = new Set(["entregado", "cancelado", "error"]);
const ABANDON_AFTER_MS = 45 * 60_000;

type ReconcileSource = "webhook" | "reconcile" | "noop" | "error" | "no_pedido_id";

export type ReconcileResult = {
  changed: boolean;
  status: string | null;
  source: ReconcileSource;
  message?: string;
};

async function reconcileOne(orderId: string): Promise<ReconcileResult> {
  const { data: row, error: selErr } = await supabaseAdmin
    .from("orders")
    .select("id, status, rp_pedido_id, cancel_reason, created_at")
    .eq("id", orderId)
    .maybeSingle();

  if (selErr || !row) {
    return {
      changed: false,
      status: null,
      source: "error",
      message: selErr?.message ?? "not_found",
    };
  }
  if (TERMINAL.has(row.status)) {
    return { changed: false, status: row.status, source: "noop", message: "terminal" };
  }

  // Única regla activa — Auto-Kill (TTL 45 min). Sin llamadas a RP.
  const ageMs = Date.now() - new Date(row.created_at).getTime();
  if (ageMs > ABANDON_AFTER_MS && (row.status === "enviado" || row.status === "recibido")) {
    const nowIso = new Date().toISOString();
    const reason = "timeout_sistema: Abandonado por falta de respuesta en POS tras 45 min";
    await supabaseAdmin
      .from("orders")
      .update({
        status: "cancelado",
        cancel_reason: reason,
        cancelled_at: nowIso,
      } as never)
      .eq("id", row.id);
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "reconcile",
      ok: true,
      mensaje: `auto-abandon: ${row.status} → cancelado (>${Math.floor(ABANDON_AFTER_MS / 60_000)} min)`,
      payload: {
        order_id: row.id,
        rp_pedido_id: row.rp_pedido_id,
        age_min: Math.floor(ageMs / 60_000),
        reason,
      } as unknown as Json,
    });
    return { changed: true, status: "cancelado", source: "reconcile", message: "auto_abandon" };
  }

  // No hay endpoint público de lectura disponible: esperamos al webhook.
  return { changed: false, status: row.status, source: "noop", message: "reconcile_unavailable" };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const reconcileOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ orderId: z.string().regex(UUID_RE) }).parse(input))
  .handler(async ({ data }) => reconcileOne(data.orderId));

// -----------------------------------------------------------------------------
// Pedidos huérfanos: observabilidad pura. Status no terminal, >15 min sin webhook.
// -----------------------------------------------------------------------------

export type OrphanRow = {
  id: string;
  rp_pedido_id: string | null;
  status: string;
  created_at: string;
  ageMinutes: number;
};

export const listOrphanOrders = createServerFn({ method: "GET" }).handler(async () => {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select("id, rp_pedido_id, status, created_at")
    .in("status", ["enviado", "recibido"])
    .lt("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !orders) return { orphans: [] as OrphanRow[] };

  const ids = orders.map((o) => o.id);
  if (ids.length === 0) return { orphans: [] as OrphanRow[] };

  const { data: logs } = await supabaseAdmin
    .from("rp_sync_log")
    .select("payload")
    .eq("tipo", "webhook")
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(2000);

  const seen = new Set<string>();
  for (const l of logs ?? []) {
    const p = l.payload;
    if (p && typeof p === "object" && !Array.isArray(p)) {
      const oid = (p as Record<string, unknown>).order_id;
      if (typeof oid === "string") seen.add(oid);
    }
  }

  const now = Date.now();
  const orphans: OrphanRow[] = orders
    .filter((o) => !seen.has(o.id))
    .map((o) => ({
      id: o.id,
      rp_pedido_id: o.rp_pedido_id,
      status: o.status,
      created_at: o.created_at,
      ageMinutes: Math.floor((now - new Date(o.created_at).getTime()) / 60_000),
    }));

  return { orphans };
});
