// Server functions del checkout. Thin file: solo createServerFn + imports.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { submitOrder } from "./orders.server";
import { checkoutSchema } from "./checkout-validation";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rpCancelarDelivery, rpVerificarProductosAgotados } from "@/lib/restaurantpe.server";
import { classifyOrderLookup } from "@/lib/order-lookup";

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

export const setOrderAnalyticsExclusion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        orderId: z.string().uuid(),
        excluded: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["super_admin", "editor", "marketing"]);
    if (roleError) throw new Error(roleError.message);
    if (!roles?.length) throw new Error("No tienes permiso para modificar las métricas.");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .update({
        is_test: data.excluded,
        analytics_excluded_at: data.excluded ? new Date().toISOString() : null,
        analytics_exclusion_reason: data.excluded
          ? "Marcado como prueba desde administración"
          : null,
      })
      .eq("id", data.orderId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Pedido no encontrado.");
    return { ok: true as const, excluded: data.excluded };
  });

/**
 * Busca el pedido más reciente del cliente (últimas 24h) por:
 *   - id (UUID)
 *   - rp_pedido_id (id interno del POS)
 *   - rp_numero_comanda (número corto del POS)
 *   - UUID no-adivinable
 *   - teléfono completo (últimos 10 dígitos)
 * Devuelve solo el id para evitar exponer datos del cliente.
 */
export const findRecentOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ query: z.string().min(4).max(60) }).parse(input))
  .handler(async ({ data }) => {
    const lookup = classifyOrderLookup(data.query);
    if (!lookup) return { notFound: true as const };
    const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    if (lookup.kind === "uuid") {
      const { data: row } = await supabaseAdmin
        .from("orders")
        .select("id, created_at")
        .eq("id", lookup.value)
        .gt("created_at", cutoffIso)
        .maybeSingle();
      return row ? { orderId: row.id } : { notFound: true as const };
    }

    // ponytail: escaneo acotado; normalizar teléfono en columna indexada si se superan 500 pedidos/día.
    const { data: rows } = await supabaseAdmin
      .from("orders")
      .select("id, created_at, cliente")
      .gt("created_at", cutoffIso)
      .order("created_at", { ascending: false })
      .limit(500);
    const match = (rows ?? []).find((r) => {
      const phone = ((r.cliente as { telefono?: string } | null)?.telefono ?? "").replace(
        /\D/g,
        "",
      );
      return phone.endsWith(lookup.value);
    });
    return match ? { orderId: match.id } : { notFound: true as const };
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
