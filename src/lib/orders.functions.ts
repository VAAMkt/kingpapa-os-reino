// Server functions del checkout. Thin file: solo createServerFn + imports.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { submitOrder } from "./orders.server";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rpCancelarDelivery, rpVerificarProductosAgotados } from "@/lib/restaurantpe.server";

const checkoutSchema = z.object({
  sedeId: z.string().uuid(),
  tipo: z.enum(["delivery", "pickup"]),
  pago: z.enum(["efectivo", "datafono", "online"]),
  cliente: z.object({
    nombre: z.string().min(1).max(120),
    telefono: z.string().min(7).max(40),
    direccion: z.string().max(300).nullable().optional(),
    detalles: z.string().max(300).nullable().optional(),
  }),
  notas: z.string().max(500).nullable().optional(),
  items: z
    .array(
      z.object({
        productoId: z.string().uuid(),
        cantidad: z.number().int().min(1).max(50),
        modificadores: z
          .array(
            z.object({
              grupoId: z.number().int(),
              opcionId: z.number().int(),
            }),
          )
          .max(20)
          .optional(),
      }),
    )
    .min(1)
    .max(50),
});

export const submitCheckoutOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => checkoutSchema.parse(input))
  .handler(async ({ data }) => {
    // Auth opcional: si viene un bearer válido, asociamos el pedido al user.
    let userId: string | null = null;
    try {
      const authHeader = getRequestHeader("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (url && key) {
          const sb = createClient(url, key, {
            global: { headers: { Authorization: `Bearer ${token}` } },
          });
          const { data: userData } = await sb.auth.getUser();
          userId = userData.user?.id ?? null;
        }
      }
    } catch {
      // Pedido como invitado.
    }

    const result = await submitOrder({ ...data, userId });
    return result;
  });

/**
 * Busca el pedido más reciente del cliente (últimas 24h) por:
 *   - id (UUID)
 *   - rp_pedido_id (id interno del POS)
 *   - rp_numero_comanda (número corto del POS)
 *   - teléfono (cliente->>'telefono', últimos 10 dígitos)
 * Devuelve solo el id para evitar exponer datos del cliente.
 */
export const findRecentOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ query: z.string().min(4).max(60) }).parse(input))
  .handler(async ({ data }) => {
    const raw = data.query.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
    const digits = raw.replace(/\D/g, "");
    const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    if (isUuid) {
      const { data: row } = await supabaseAdmin
        .from("orders")
        .select("id, created_at")
        .eq("id", raw)
        .gt("created_at", cutoffIso)
        .maybeSingle();
      return row ? { orderId: row.id } : { notFound: true as const };
    }

    // Si parece número de comanda / id POS (3-10 dígitos), prioriza esa búsqueda.
    if (digits.length >= 3 && digits.length <= 10) {
      const { data: rows } = await supabaseAdmin
        .from("orders")
        .select("id, created_at")
        .or(`rp_numero_comanda.eq.${digits},rp_pedido_id.eq.${digits}`)
        .gt("created_at", cutoffIso)
        .order("created_at", { ascending: false })
        .limit(1);
      if (rows && rows.length > 0) return { orderId: rows[0].id };
    }

    // Fallback: teléfono. Buscamos por sufijo de 10 dígitos para tolerar prefijos.
    if (digits.length >= 7) {
      const tail = digits.slice(-10);
      const { data: rows } = await supabaseAdmin
        .from("orders")
        .select("id, created_at, cliente")
        .gt("created_at", cutoffIso)
        .order("created_at", { ascending: false })
        .limit(20);
      const match = (rows ?? []).find((r) => {
        const tel = ((r.cliente as { telefono?: string } | null)?.telefono ?? "").replace(
          /\D/g,
          "",
        );
        return tel.endsWith(tail);
      });
      if (match) return { orderId: match.id };
    }

    return { notFound: true as const };
  });

/**
 * P3 — Cancelación bidireccional desde el admin.
 * Llama a `cancelarDelivery` en Restaurant.pe y, sea cual sea el resultado
 * del POS, marca el pedido como cancelado en nuestra DB para que el cliente
 * lo vea en tiempo real (Realtime). Si el POS falla, logueamos y avisamos
 * pero NO bloqueamos: la cancelación local manda — al fin y al cabo, el
 * pedido NO sale.
 */
export const cancelOrderFromAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        orderId: z.string().uuid(),
        motivo: z.string().min(1).max(300),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: order, error: ordErr } = await supabase
      .from("orders")
      .select("id, status, rp_pedido_id, sede_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (ordErr) throw new Error(ordErr.message);
    if (!order) throw new Error("Pedido no encontrado");
    if (order.status === "cancelado") {
      return { ok: true as const, alreadyCancelled: true };
    }

    let rpOk = true;
    let rpError: string | null = null;
    if (order.rp_pedido_id) {
      try {
        await rpCancelarDelivery({
          deliveryId: order.rp_pedido_id,
          motivo: data.motivo,
        });
      } catch (e) {
        rpOk = false;
        rpError = e instanceof Error ? e.message : String(e);
      }
    }

    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({
        status: "cancelado",
        cancel_reason: data.motivo,
        cancelled_at: new Date().toISOString(),
      } as never)
      .eq("id", order.id);
    if (updErr) throw new Error(updErr.message);

    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "cancel",
      sede_id: order.sede_id,
      ok: rpOk,
      mensaje: rpOk
        ? `Cancelado en POS y DB (rp_pedido_id=${order.rp_pedido_id ?? "n/d"})`
        : `Cancelado en DB; POS falló: ${rpError ?? "sin detalle"}`,
      payload: {
        order_id: order.id,
        rp_pedido_id: order.rp_pedido_id,
        motivo: data.motivo,
      } as never,
    });

    return { ok: true as const, posOk: rpOk, posError: rpError };
  });

/**
 * P2 — Pre-check de stock antes de enviar el pedido.
 * Diseño defensivo: timeout 3s, fallo suave. Si Restaurant.pe no responde
 * a tiempo o falla, devolvemos `agotados: []` para que el checkout siga.
 * NUNCA bloqueamos una venta por una caída de la API del POS.
 */
export const precheckStock = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        sedeId: z.string().uuid(),
        items: z
          .array(
            z.object({
              productoId: z.string().uuid(),
              cantidad: z.number().int().min(1).max(50),
            }),
          )
          .min(1)
          .max(50),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: sede } = await supabaseAdmin
      .from("sedes")
      .select("rp_local_id")
      .eq("id", data.sedeId)
      .maybeSingle();
    if (!sede?.rp_local_id) {
      // Sin rp_local_id no podemos preguntar al POS → fallo suave.
      return { ok: true as const, agotados: [] as string[], soft: true };
    }

    const { data: prods } = await supabaseAdmin
      .from("productos_master")
      .select("id, rp_id, nombre")
      .in(
        "id",
        data.items.map((i) => i.productoId),
      );
    const prodMap = new Map<string, { rp_id: number; nombre: string }>(
      ((prods ?? []) as Array<{ id: string; rp_id: number; nombre: string }>).map((p) => [
        p.id,
        { rp_id: p.rp_id, nombre: p.nombre },
      ]),
    );

    const lista = data.items
      .map((it) => {
        const p = prodMap.get(it.productoId);
        if (!p) return null;
        return {
          pedido_productoid: p.rp_id,
          pedido_cantidad: it.cantidad,
          _localId: it.productoId,
          _nombre: p.nombre,
        };
      })
      .filter(
        (
          x,
        ): x is {
          pedido_productoid: number;
          pedido_cantidad: number;
          _localId: string;
          _nombre: string;
        } => x !== null,
      );

    if (lista.length === 0) {
      return { ok: true as const, agotados: [] as string[], soft: true };
    }

    const result = await rpVerificarProductosAgotados({
      localId: sede.rp_local_id,
      productos: lista.map(({ pedido_productoid, pedido_cantidad }) => ({
        pedido_productoid,
        pedido_cantidad,
      })),
      timeoutMs: 3_000,
    });

    if (result == null) {
      // Timeout o caída del POS → fallo suave: dejamos pasar la compra.
      return {
        ok: true as const,
        agotados: [] as string[],
        agotadosNombres: [] as string[],
        soft: true,
      };
    }

    const agotadosRpIds = new Set(result.filter((r) => r.agotado).map((r) => r.pedido_productoid));
    const agotados = lista
      .filter((it) => agotadosRpIds.has(it.pedido_productoid))
      .map((it) => it._localId);
    const agotadosNombres = lista
      .filter((it) => agotadosRpIds.has(it.pedido_productoid))
      .map((it) => it._nombre);

    return {
      ok: true as const,
      agotados,
      agotadosNombres,
      soft: false,
    };
  });
