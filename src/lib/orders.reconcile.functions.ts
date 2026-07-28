// Reconciliación híbrida:
// 1) Restaurant.pe empuja estados al webhook público.
// 2) Si el webhook no llega, consultamos el snapshot por el endpoint tenant.
// La falta de sincronización nunca cancela automáticamente un pedido.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import {
  extractRpDeliveryId,
  rpFindDeliveryByIntegrationCode,
  rpGetDeliveryById,
} from "@/lib/restaurantpe.server";
import {
  extractComandaNumber,
  extractMotorizadoInfo,
  mapPolledDeliveryEstado,
  mapRpEstadoToLocal,
} from "@/lib/restaurantpe-normalize";

const TERMINAL = new Set(["entregado", "cancelado", "error"]);

type ReconcileSource = "webhook" | "poll" | "reconcile" | "noop" | "error" | "no_pedido_id";

export type ReconcileResult = {
  changed: boolean;
  status: string | null;
  source: ReconcileSource;
  message?: string;
};

async function reconcileOne(orderId: string): Promise<ReconcileResult> {
  const { data: row, error: selErr } = await supabaseAdmin
    .from("orders")
    .select("id, sede_id, status, rp_pedido_id, cancel_reason, created_at, rp_response")
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

  // Nunca cancelamos por falta de sincronización: el POS puede seguir
  // procesando el pedido aunque el webhook o la consulta estén caídos.
  if (!row.rp_pedido_id) {
    return { changed: false, status: row.status, source: "no_pedido_id" };
  }

  // Segunda vía de sincronización: consulta el snapshot del delivery cuando
  // el webhook no llegó. Requiere RESTAURANT_PE_TENANT_TOKEN en el runtime.
  try {
    const prev =
      row.rp_response && typeof row.rp_response === "object" && !Array.isArray(row.rp_response)
        ? (row.rp_response as Record<string, unknown>)
        : {};
    const storedDeliveryId =
      typeof prev.rp_delivery_id === "string" && prev.rp_delivery_id.trim()
        ? prev.rp_delivery_id.trim()
        : row.rp_pedido_id;
    let resolvedDeliveryId = storedDeliveryId;
    let snapshot: Record<string, unknown> | null = null;
    let directError: string | null = null;

    try {
      snapshot = await rpGetDeliveryById(storedDeliveryId);
    } catch (error) {
      directError = error instanceof Error ? error.message : String(error);
    }

    // registrarDelivery puede devolver pedido_id/comanda, mientras el webhook
    // usa delivery_id. Si no son iguales, resolvemos por el UUID canónico.
    if (!snapshot) {
      const { data: sede } = await supabaseAdmin
        .from("sedes")
        .select("rp_local_id")
        .eq("id", row.sede_id)
        .maybeSingle();
      if (sede?.rp_local_id) {
        const discovered = await rpFindDeliveryByIntegrationCode({
          localId: sede.rp_local_id,
          integrationCode: row.id,
        });
        const actualId = extractRpDeliveryId(discovered);
        if (discovered && actualId) {
          resolvedDeliveryId = actualId;
          try {
            snapshot = (await rpGetDeliveryById(actualId)) ?? discovered;
          } catch {
            snapshot = discovered;
          }
        }
      }
    }

    if (!snapshot) {
      throw new Error(
        directError
          ? `No se pudo resolver el delivery real: ${directError}`
          : "No se encontró el delivery por ID ni por código de integración",
      );
    }
    const inner =
      snapshot.data && typeof snapshot.data === "object" && !Array.isArray(snapshot.data)
        ? (snapshot.data as Record<string, unknown>)
        : snapshot;
    const rawEstado = inner.delivery_estado;
    const mapped =
      typeof rawEstado === "string" && !/^\d+$/.test(rawEstado.trim())
        ? mapRpEstadoToLocal(rawEstado)
        : mapPolledDeliveryEstado(rawEstado, row.status);
    const motorizado = extractMotorizadoInfo(snapshot);
    const numeroComanda = extractComandaNumber(snapshot);
    const nowIso = new Date().toISOString();
    const rank: Record<string, number> = {
      enviado: 0,
      recibido: 1,
      en_preparacion: 2,
      en_camino: 3,
      entregado: 4,
      cancelado: 99,
      error: 99,
    };
    const canAdvance =
      mapped != null &&
      mapped !== row.status &&
      (mapped === "cancelado" || (rank[mapped] ?? 0) >= (rank[row.status] ?? 0));
    const updates: Record<string, unknown> = {
      rp_response: {
        ...prev,
        rp_delivery_id: resolvedDeliveryId,
        webhook_delivery_ids: Array.from(
          new Set([
            ...(Array.isArray(prev.webhook_delivery_ids)
              ? prev.webhook_delivery_ids.map(String)
              : []),
            resolvedDeliveryId,
          ]),
        ),
        live_motorizado: motorizado,
        poll_snapshot_at: nowIso,
        poll_raw_estado: rawEstado ?? null,
      },
    };
    if (canAdvance) updates.status = mapped;
    if (numeroComanda) updates.rp_numero_comanda = numeroComanda;
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update(updates as never)
      .eq("id", row.id);
    if (updateError) throw new Error(updateError.message);

    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "reconcile",
      ok: true,
      mensaje: canAdvance
        ? `POS pull: ${row.status} → ${mapped}`
        : `POS pull sin cambio (status=${row.status}, raw=${String(rawEstado ?? "n/d")})`,
      payload: {
        order_id: row.id,
        rp_pedido_id: row.rp_pedido_id,
        previous_status: row.status,
        mapped_status: mapped,
        raw_estado: rawEstado ?? null,
        resolved_delivery_id: resolvedDeliveryId,
      } as unknown as Json,
    });
    return {
      changed: canAdvance,
      status: canAdvance && mapped ? mapped : row.status,
      source: "poll",
      message: mapped ? "snapshot_ok" : "unmapped_status",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "reconcile",
      ok: false,
      mensaje: `POS pull no disponible: ${message}`,
      payload: { order_id: row.id, rp_pedido_id: row.rp_pedido_id } as unknown as Json,
    });
    // Fallo suave: el webhook y Realtime siguen operando.
    return { changed: false, status: row.status, source: "noop", message };
  }
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
