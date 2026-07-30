// Server function de soporte para el panel /admin/integraciones.
// Reporta el estado de las integraciones externas sin exponer valores
// de secrets — sólo flags "configurado / faltante" y el timestamp del
// último webhook recibido.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { rpGetPaymentMethods, rpGetDeliveryById } from "@/lib/restaurantpe.server";

export const getIntegrationsStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    // Último webhook crudo recibido de Restaurant.pe.
    const { data: lastRaw } = await supabaseAdmin
      .from("rp_sync_log")
      .select("created_at")
      .eq("tipo", "webhook_raw")
      .order("created_at", { ascending: false })
      .limit(1);

    const lastWebhookAt = lastRaw && lastRaw.length > 0 ? lastRaw[0].created_at : null;

    return {
      rp: {
        token_set: !!process.env.RESTAURANT_PE_TOKEN,
        dominio_set: !!process.env.RESTAURANT_PE_DOMINIO,
        webhook_secret_set: !!process.env.RP_WEBHOOK_SECRET,
        last_webhook_at: lastWebhookAt,
        webhook_path: "/api/public/rp-webhook",
      },
      lovable_ai: {
        key_set: !!process.env.LOVABLE_API_KEY,
      },
      google_maps: {
        browser_key_set: !!process.env.GOOGLE_MAPS_BROWSER_KEY_1,
        server_key_set: !!process.env.GOOGLE_MAPS_API_KEY_1,
      },
    };
  });


export const getPaymentMethodsAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["super_admin", "editor", "marketing"]);
    if (roleError) throw new Error(roleError.message);
    if (!roles?.length) throw new Error("No tienes permiso para auditar métodos de pago.");

    const { data: sedes, error: sedesError } = await supabaseAdmin
      .from("sedes")
      .select("id, nombre, rp_local_id")
      .not("rp_local_id", "is", null)
      .order("nombre");
    if (sedesError) throw new Error(sedesError.message);

    return Promise.all(
      (sedes ?? []).map(async (sede) => {
        try {
          const methods = await rpGetPaymentMethods(sede.rp_local_id!);
          return {
            sede_id: sede.id,
            sede_nombre: sede.nombre,
            local_id: sede.rp_local_id,
            ok: true as const,
            methods,
            error: null,
          };
        } catch (error) {
          return {
            sede_id: sede.id,
            sede_nombre: sede.nombre,
            local_id: sede.rp_local_id,
            ok: false as const,
            methods: [],
            error: error instanceof Error ? error.message : "Error desconocido",
          };
        }
      }),
    );
  });


function paymentFields(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output: Record<string, unknown> = {};
  const allowed = /(pago|payment|tarjeta|card|monto|pagocon|costoenvio|total)/i;
  const blocked = /(token|secret|telefono|celular|direccion|cliente|nombre|email|dni|ruc)/i;
  for (const [key, fieldValue] of Object.entries(value as Record<string, unknown>)) {
    if (blocked.test(key)) continue;
    if (allowed.test(key) && (fieldValue == null || ["string", "number", "boolean"].includes(typeof fieldValue))) {
      output[key] = fieldValue;
    }
    if (fieldValue && typeof fieldValue === "object" && !Array.isArray(fieldValue)) {
      const nested = paymentFields(fieldValue);
      for (const [nestedKey, nestedValue] of Object.entries(nested)) {
        output[`${key}.${nestedKey}`] = nestedValue;
      }
    }
  }
  return output;
}

export const runPaymentEvidenceAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["super_admin", "editor", "marketing"]);
    if (roleError) throw new Error(roleError.message);
    if (!roles?.length) throw new Error("No tienes permiso para ejecutar esta prueba.");

    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("id, rp_pedido_id, sede_id, tipo, pago, total, created_at, rp_payload")
      .not("rp_pedido_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);

    const { data: sedes } = await supabaseAdmin.from("sedes").select("id, nombre");
    const sedeMap = new Map((sedes ?? []).map((sede) => [sede.id, sede.nombre]));

    return Promise.all(
      (orders ?? []).map(async (order) => {
        const payload =
          order.rp_payload && typeof order.rp_payload === "object" && !Array.isArray(order.rp_payload)
            ? (order.rp_payload as Record<string, unknown>)
            : {};
        const deliverySent =
          payload.delivery && typeof payload.delivery === "object" && !Array.isArray(payload.delivery)
            ? (payload.delivery as Record<string, unknown>)
            : {};
        try {
          const snapshot = await rpGetDeliveryById(order.rp_pedido_id!);
          return {
            order_id: order.id,
            rp_pedido_id: order.rp_pedido_id,
            sede: sedeMap.get(order.sede_id) ?? order.sede_id,
            tipo: order.tipo,
            pago_web: order.pago,
            total: order.total,
            created_at: order.created_at,
            enviado: paymentFields(deliverySent),
            persistido_rp: paymentFields(snapshot),
            ok: true as const,
            error: null,
          };
        } catch (auditError) {
          return {
            order_id: order.id,
            rp_pedido_id: order.rp_pedido_id,
            sede: sedeMap.get(order.sede_id) ?? order.sede_id,
            tipo: order.tipo,
            pago_web: order.pago,
            total: order.total,
            created_at: order.created_at,
            enviado: paymentFields(deliverySent),
            persistido_rp: {},
            ok: false as const,
            error: auditError instanceof Error ? auditError.message : "Error desconocido",
          };
        }
      }),
    );
  });
