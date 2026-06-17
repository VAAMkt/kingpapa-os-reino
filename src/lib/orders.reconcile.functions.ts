// Reconciliación pull contra la API por tenant de Restaurant.pe.
// Red de seguridad cuando el webhook público no dispara (pedidos huérfanos).
//
// Diseño defensivo:
//  - Nunca lanza: cualquier error de RP se loguea en rp_sync_log y se devuelve
//    un resultado tipado para que el cliente decida.
//  - Rate-limit por orden: 20s. Evita golpear RP en tabs duplicadas.
//  - El UPDATE en `orders` dispara Realtime → el cliente refresca solo.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  rpGetDeliveryById,
  rpObtenerSyncFull,
  extractEstado,
} from "@/lib/restaurantpe.server";
import { mapRpEstadoToLocal } from "@/lib/restaurantpe-normalize";
import type { Json } from "@/integrations/supabase/types";

const RATE_LIMIT_SEC = 20;
const TERMINAL = new Set(["entregado", "cancelado", "error"]);

type ReconcileSource = "webhook" | "reconcile" | "noop" | "error" | "rate_limited" | "no_pedido_id";

export type ReconcileResult = {
  changed: boolean;
  status: string | null;
  source: ReconcileSource;
  message?: string;
};

async function reconcileOne(orderId: string): Promise<ReconcileResult> {
  const { data: row, error: selErr } = await supabaseAdmin
    .from("orders")
    .select("id, status, rp_pedido_id, rp_response, cancel_reason, updated_at")
    .eq("id", orderId)
    .maybeSingle();

  if (selErr || !row) {
    return { changed: false, status: null, source: "error", message: selErr?.message ?? "not_found" };
  }
  if (TERMINAL.has(row.status)) {
    return { changed: false, status: row.status, source: "noop", message: "terminal" };
  }
  if (!row.rp_pedido_id) {
    return { changed: false, status: row.status, source: "no_pedido_id" };
  }

  // Rate-limit por orden vía rp_response.last_reconcile_at.
  const prevRp =
    row.rp_response && typeof row.rp_response === "object" && !Array.isArray(row.rp_response)
      ? (row.rp_response as Record<string, unknown>)
      : {};
  const lastIso = typeof prevRp.last_reconcile_at === "string" ? prevRp.last_reconcile_at : null;
  if (lastIso) {
    const ageSec = (Date.now() - new Date(lastIso).getTime()) / 1000;
    if (ageSec < RATE_LIMIT_SEC) {
      return { changed: false, status: row.status, source: "rate_limited" };
    }
  }

  // 1) /delivery/get/{id}. Fallback: obtenerSyncFull.
  let resp = await rpGetDeliveryById(row.rp_pedido_id);
  let extracted = extractEstado(resp.raw);
  if (!resp.ok || !extracted.estado) {
    const fb = await rpObtenerSyncFull(row.rp_pedido_id);
    if (fb.ok) {
      const fbEx = extractEstado(fb.raw);
      if (fbEx.estado) {
        resp = fb;
        extracted = fbEx;
      }
    }
  }

  if (!resp.ok || !extracted.estado) {
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "reconcile",
      ok: false,
      mensaje: `RP no devolvió estado (status=${resp.status}, err=${resp.error ?? "—"})`,
      payload: {
        order_id: row.id,
        rp_pedido_id: row.rp_pedido_id,
        raw: resp.raw,
      } as unknown as Json,
    });
    return { changed: false, status: row.status, source: "error", message: resp.error ?? "no_estado" };
  }

  const mapped = mapRpEstadoToLocal(extracted.estado);
  const nowIso = new Date().toISOString();

  const newRp: Record<string, unknown> = {
    ...prevRp,
    last_reconcile_at: nowIso,
    reconciled_status: extracted.estado,
  };
  if (extracted.eta_min != null) {
    newRp.eta_min = extracted.eta_min;
    newRp.eta_set_at = nowIso;
  }

  // Sin cambio de estado real: sólo actualizamos rp_response (cooldown).
  if (!mapped || mapped === row.status) {
    await supabaseAdmin
      .from("orders")
      .update({ rp_response: newRp as unknown as Json } as never)
      .eq("id", row.id);
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "reconcile",
      ok: true,
      mensaje: mapped
        ? `no-op (status=${row.status}, rp=${extracted.estado})`
        : `estado RP desconocido: ${extracted.estado}`,
      payload: {
        order_id: row.id,
        rp_pedido_id: row.rp_pedido_id,
        rp_estado: extracted.estado,
        mapped,
      } as unknown as Json,
    });
    return { changed: false, status: row.status, source: "reconcile" };
  }

  const updates: Record<string, unknown> = { status: mapped, rp_response: newRp as unknown as Json };
  if (mapped === "cancelado" && !row.cancel_reason) {
    updates.cancel_reason = extracted.motivo ?? "Cancelado (sincronizado)";
    updates.cancelled_at = nowIso;
  }

  const { error: updErr } = await supabaseAdmin
    .from("orders")
    .update(updates as never)
    .eq("id", row.id);

  if (updErr) {
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "reconcile",
      ok: false,
      mensaje: `update falló: ${updErr.message}`,
      payload: { order_id: row.id, rp_pedido_id: row.rp_pedido_id } as unknown as Json,
    });
    return { changed: false, status: row.status, source: "error", message: updErr.message };
  }

  await supabaseAdmin.from("rp_sync_log").insert({
    tipo: "reconcile",
    ok: true,
    mensaje: `${row.status} → ${mapped} (rp=${extracted.estado})`,
    payload: {
      order_id: row.id,
      rp_pedido_id: row.rp_pedido_id,
      before: row.status,
      after: mapped,
      rp_estado: extracted.estado,
      eta_min: extracted.eta_min,
    } as unknown as Json,
  });

  return { changed: true, status: mapped, source: "reconcile" };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const reconcileOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ orderId: z.string().regex(UUID_RE) }).parse(input),
  )
  .handler(async ({ data }) => reconcileOne(data.orderId));

// -----------------------------------------------------------------------------
// Pedidos huérfanos: status no terminal, >15 min sin webhook que los toque.
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

  // Filtra los que ya tienen al menos un webhook con order_id == id.
  const ids = orders.map((o) => o.id);
  if (ids.length === 0) return { orphans: [] as OrphanRow[] };

  // Consultamos en bloque los logs tipo webhook con order_id en payload.
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

export const reconcileOrphanOrders = createServerFn({ method: "POST" }).handler(async () => {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("id, rp_pedido_id, status")
    .in("status", ["enviado", "recibido"])
    .lt("created_at", cutoff)
    .not("rp_pedido_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!orders || orders.length === 0) return { processed: 0, changed: 0 };

  let changed = 0;
  for (const o of orders) {
    const r = await reconcileOne(o.id);
    if (r.changed) changed += 1;
    await new Promise((res) => setTimeout(res, 300));
  }
  return { processed: orders.length, changed };
});
