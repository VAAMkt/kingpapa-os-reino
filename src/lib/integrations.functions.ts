// Server function de soporte para el panel /admin/integraciones.
// Reporta el estado de las integraciones externas sin exponer valores
// de secrets — sólo flags "configurado / faltante" y el timestamp del
// último webhook recibido.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { rpGetPaymentMethods } from "@/lib/restaurantpe.server";

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
