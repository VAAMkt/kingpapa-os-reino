// Server function de soporte para el panel /admin/integraciones.
// Reporta el estado de las integraciones externas sin exponer valores
// de secrets — sólo flags "configurado / faltante" y el timestamp del
// último webhook recibido.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

    // Última compra reportada a Meta por la API de Conversiones.
    const { data: lastCapi } = await supabaseAdmin
      .from("orders")
      .select("meta_capi_sent_at")
      .not("meta_capi_sent_at", "is", null)
      .order("meta_capi_sent_at", { ascending: false })
      .limit(1);

    const { fetchDatasetQuality } = await import("@/lib/capi.server");
    const quality = await fetchDatasetQuality();

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
      meta: {
        token_set: !!(process.env.META_CAPI_ACCESS_TOKEN || process.env.DATASET_QUALITY_API),
        test_mode: !!process.env.META_TEST_EVENT_CODE,
        dataset_id: "1348178064148165",
        last_purchase_sent_at:
          lastCapi && lastCapi.length > 0
            ? ((lastCapi[0] as { meta_capi_sent_at: string | null }).meta_capi_sent_at ?? null)
            : null,
        quality_error: quality.error ?? null,
        quality_metrics: quality.metrics ?? [],
      },
    };
  });
