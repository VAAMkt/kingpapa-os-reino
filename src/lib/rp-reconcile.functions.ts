// Fase 1 (anti-Quipu-stuck) + Fase 2 (reconciliación determinista pull).
//
// - `checkQuipuBacklog`: por cada sede con `rp_local_id`, lista los deliveries
//   que llegaron a la web de Restaurant.pe pero NO al POS Quipu, y cruza esa
//   lista con nuestros pedidos activos. Sólo observabilidad — no muta orders.
// - `pollActiveOrders`: por cada pedido activo con `rp_pedido_id`, consulta
//   el snapshot autoritativo del tenant y actualiza status si progresó
//   (mismo STATUS_RANK del webhook, nunca regresa).
// - `runReconcile`: ejecuta ambos (para el hook cron / botón admin).

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  rpGetSinNotificarAQuipu,
  rpGetDeliveryById,
  type RpSinQuipuRow,
} from "@/lib/restaurantpe.server";
import {
  mapDeliveryEstado,
  extractDeliveryEstado,
  extractComandaNumber,
  extractMotorizado,
} from "@/lib/restaurantpe-normalize";
import type { Json } from "@/integrations/supabase/types";

// Debe coincidir con el ranking del webhook (`rp-webhook.ts`).
const STATUS_RANK: Record<string, number> = {
  enviado: 0,
  recibido: 1,
  en_preparacion: 2,
  en_camino: 3,
  entregado: 4,
  cancelado: 99,
  error: 99,
};
const TERMINAL = new Set(["entregado", "cancelado", "error"]);

// Ventana defensiva: sólo tocamos pedidos creados hace <6h. Fuera de ahí
// dejamos el auto-abandono del reconciliador viejo hacer su trabajo.
const POLL_WINDOW_MS = 6 * 60 * 60_000;
// No pollear pedidos recién creados (<60s): dar chance al POS de procesar.
const POLL_MIN_AGE_MS = 60_000;

// ---------------------------------------------------------------------------
// Fase 1 — backlog Quipu
// ---------------------------------------------------------------------------

export type QuipuStuckRow = {
  sede_id: string;
  sede_slug: string;
  local_id: number;
  delivery_id: string;
  ageMinutes: number;
  matched_order_id: string | null;
  matched_by: "integracion" | "rp_pedido_id" | null;
  cliente_nombre: string | null;
  cliente_celular: string | null;
  delivery_estado: number | null;
};

export type QuipuBacklogResult = {
  ok: boolean;
  bySede: Array<{
    sede_id: string;
    sede_slug: string;
    local_id: number;
    total_stuck: number;
    error?: string;
  }>;
  matchedOurs: QuipuStuckRow[];
};

export const checkQuipuBacklog = createServerFn({ method: "POST" }).handler(
  async (): Promise<QuipuBacklogResult> => {
    const { data: sedes } = await supabaseAdmin
      .from("sedes")
      .select("id, slug, rp_local_id")
      .not("rp_local_id", "is", null)
      .eq("publicado", true);

    const bySede: QuipuBacklogResult["bySede"] = [];
    const allStuck: Array<{ sede: (typeof sedes)[number]; row: RpSinQuipuRow }> = [];

    for (const s of sedes ?? []) {
      const localId = Number(s.rp_local_id);
      if (!Number.isFinite(localId) || localId <= 0) continue;
      try {
        const rows = await rpGetSinNotificarAQuipu(localId);
        bySede.push({
          sede_id: s.id,
          sede_slug: s.slug,
          local_id: localId,
          total_stuck: rows.length,
        });
        for (const r of rows) allStuck.push({ sede: s, row: r });
      } catch (err) {
        bySede.push({
          sede_id: s.id,
          sede_slug: s.slug,
          local_id: localId,
          total_stuck: 0,
          error: err instanceof Error ? err.message : "error",
        });
      }
    }

    if (allStuck.length === 0) {
      await supabaseAdmin.from("rp_sync_log").insert({
        tipo: "quipu_backlog",
        ok: true,
        mensaje: `Backlog Quipu vacío en ${bySede.length} sede(s).`,
        payload: { bySede } as unknown as Json,
      });
      return { ok: true, bySede, matchedOurs: [] };
    }

    // Cruce con nuestras órdenes: match por rp_pedido_id (delivery_id)
    // o por delivery_codigointegracion == orders.id.
    const deliveryIds = allStuck.map((s) => s.row.delivery_id).filter(Boolean);
    const integrationIds = allStuck
      .map((s) => s.row.delivery_codigointegracion)
      .filter((v): v is string => !!v);

    const [{ data: byDelivery }, { data: byIntegration }] = await Promise.all([
      deliveryIds.length
        ? supabaseAdmin
            .from("orders")
            .select("id, rp_pedido_id, status, created_at")
            .in("rp_pedido_id", deliveryIds)
        : Promise.resolve({ data: [] as never[] }),
      integrationIds.length
        ? supabaseAdmin
            .from("orders")
            .select("id, rp_pedido_id, status, created_at")
            .in("id", integrationIds)
        : Promise.resolve({ data: [] as never[] }),
    ]);

    const byDeliveryMap = new Map<string, (typeof byDelivery)[number]>();
    for (const o of byDelivery ?? []) {
      if (o.rp_pedido_id) byDeliveryMap.set(String(o.rp_pedido_id), o);
    }
    const byIntegrationMap = new Map<string, (typeof byIntegration)[number]>();
    for (const o of byIntegration ?? []) byIntegrationMap.set(o.id, o);

    const now = Date.now();
    const matched: QuipuStuckRow[] = [];
    for (const { sede, row } of allStuck) {
      const byInteg = row.delivery_codigointegracion
        ? byIntegrationMap.get(row.delivery_codigointegracion)
        : undefined;
      const byDel = byDeliveryMap.get(row.delivery_id);
      const order = byInteg ?? byDel;
      if (!order) continue;
      // Sólo alertamos si nuestra orden sigue activa.
      if (TERMINAL.has(order.status)) continue;
      const fecha = row.delivery_fecha ? Date.parse(row.delivery_fecha) : now;
      const ageMinutes = Math.max(
        0,
        Math.floor((now - (Number.isFinite(fecha) ? fecha : now)) / 60_000),
      );
      matched.push({
        sede_id: sede.id,
        sede_slug: sede.slug,
        local_id: Number(sede.rp_local_id),
        delivery_id: row.delivery_id,
        ageMinutes,
        matched_order_id: order.id,
        matched_by: byInteg ? "integracion" : "rp_pedido_id",
        cliente_nombre: row.delivery_nombres,
        cliente_celular: row.delivery_celular,
        delivery_estado: row.delivery_estado,
      });
    }

    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "quipu_backlog",
      ok: matched.length === 0,
      mensaje:
        matched.length === 0
          ? `Backlog Quipu: ${allStuck.length} stuck en RP, 0 de KingPapa.`
          : `⚠ Backlog Quipu: ${matched.length} pedido(s) KingPapa atascados antes de Quipu.`,
      payload: { bySede, matchedOurs: matched } as unknown as Json,
    });

    return { ok: matched.length === 0, bySede, matchedOurs: matched };
  },
);

// ---------------------------------------------------------------------------
// Fase 2 — poll determinista de órdenes activas
// ---------------------------------------------------------------------------

export type PollResult = {
  scanned: number;
  updated: number;
  errors: number;
  changes: Array<{
    order_id: string;
    rp_pedido_id: string;
    from: string;
    to: string;
  }>;
};

export const pollActiveOrders = createServerFn({ method: "POST" }).handler(
  async (): Promise<PollResult> => {
    const now = Date.now();
    const since = new Date(now - POLL_WINDOW_MS).toISOString();
    const until = new Date(now - POLL_MIN_AGE_MS).toISOString();

    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, rp_pedido_id, status, rp_response, created_at, rp_numero_comanda")
      .not("rp_pedido_id", "is", null)
      .not("status", "in", "(entregado,cancelado,error)")
      .gte("created_at", since)
      .lte("created_at", until)
      .order("created_at", { ascending: false })
      .limit(60);

    const changes: PollResult["changes"] = [];
    let updated = 0;
    let errors = 0;

    for (const row of orders ?? []) {
      const deliveryId = row.rp_pedido_id;
      if (!deliveryId) continue;
      try {
        const snap = await rpGetDeliveryById(deliveryId);
        if (!snap) continue;

        const numeric = extractDeliveryEstado(snap);
        const mapped = mapDeliveryEstado(numeric);
        if (!mapped) continue;

        const currentRank = STATUS_RANK[row.status] ?? 0;
        const nextRank = STATUS_RANK[mapped] ?? 0;
        // No regresar. Sólo actualizamos si es progresión estricta.
        if (nextRank <= currentRank) {
          // Aun así refrescamos comanda/motorizado si aparecieron.
          const comanda = extractComandaNumber(snap);
          const motorizado = extractMotorizado(snap);
          const patch: Record<string, unknown> = {};
          if (comanda && !row.rp_numero_comanda) patch.rp_numero_comanda = comanda;
          if (Object.keys(patch).length > 0) {
            const merged = mergeRpResponse(row.rp_response, {
              poll_snapshot_at: new Date().toISOString(),
              poll_delivery_estado: numeric,
              poll_motorizado: motorizado,
            });
            patch.rp_response = merged as unknown as Json;
            await supabaseAdmin
              .from("orders")
              .update(patch as never)
              .eq("id", row.id);
          }
          continue;
        }

        const comanda = extractComandaNumber(snap);
        const motorizado = extractMotorizado(snap);
        const merged = mergeRpResponse(row.rp_response, {
          poll_snapshot_at: new Date().toISOString(),
          poll_delivery_estado: numeric,
          poll_status: mapped,
          poll_motorizado: motorizado,
        });
        const patch: Record<string, unknown> = {
          status: mapped,
          rp_response: merged as unknown as Json,
        };
        if (comanda && !row.rp_numero_comanda) patch.rp_numero_comanda = comanda;
        if (mapped === "cancelado") {
          patch.cancelled_at = new Date().toISOString();
          patch.cancel_reason =
            "poll_reconcile: delivery_estado=4 (anulado en Restaurant.pe)";
        }
        await supabaseAdmin.from("orders").update(patch as never).eq("id", row.id);

        await supabaseAdmin.from("rp_sync_log").insert({
          tipo: "poll_reconcile",
          ok: true,
          mensaje: `poll: ${row.status} → ${mapped} (delivery_estado=${numeric})`,
          payload: {
            order_id: row.id,
            rp_pedido_id: deliveryId,
            from: row.status,
            to: mapped,
            delivery_estado: numeric,
          } as unknown as Json,
        });
        changes.push({
          order_id: row.id,
          rp_pedido_id: String(deliveryId),
          from: row.status,
          to: mapped,
        });
        updated += 1;
      } catch (err) {
        errors += 1;
        await supabaseAdmin.from("rp_sync_log").insert({
          tipo: "poll_reconcile",
          ok: false,
          mensaje: err instanceof Error ? err.message : "poll error",
          payload: {
            order_id: row.id,
            rp_pedido_id: deliveryId,
          } as unknown as Json,
        });
      }
    }

    return { scanned: orders?.length ?? 0, updated, errors, changes };
  },
);

function mergeRpResponse(
  prev: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    prev && typeof prev === "object" && !Array.isArray(prev)
      ? { ...(prev as Record<string, unknown>) }
      : {};
  return { ...base, ...patch };
}

export const runReconcile = createServerFn({ method: "POST" }).handler(
  async () => {
    const [poll, backlog] = await Promise.all([
      // Poll primero — más importante para el usuario final.
      (async () => {
        try {
          return await pollActiveOrders({} as never);
        } catch (err) {
          return {
            scanned: 0,
            updated: 0,
            errors: 1,
            changes: [],
            error: err instanceof Error ? err.message : "poll fatal",
          };
        }
      })(),
      (async () => {
        try {
          return await checkQuipuBacklog({} as never);
        } catch (err) {
          return {
            ok: false,
            bySede: [],
            matchedOurs: [],
            error: err instanceof Error ? err.message : "backlog fatal",
          };
        }
      })(),
    ]);
    return { poll, backlog };
  },
);
