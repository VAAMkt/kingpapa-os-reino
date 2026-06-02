// Server fns para mutaciones del panel admin sobre pedidos.
// Centralizadas aquí para validar rol y reportar errores explícitos
// (las UPDATEs directas vía RLS retornan 0 filas en silencio si el
// usuario no tiene rol, lo que ocultaba cancelaciones perdidas).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { rpCancelarDelivery } from "@/lib/restaurantpe.server";

const STATUSES = [
  "enviado",
  "recibido",
  "en_preparacion",
  "en_camino",
  "entregado",
  "cancelado",
  "error",
] as const;

const Input = z.object({
  orderId: z.string().uuid(),
  status: z.enum(STATUSES),
  cancelReason: z.string().min(1).max(300).nullable().optional(),
});

export const updateOrderStatusAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Verificamos rol con el cliente autenticado (RLS sobre user_roles).
    const { data: roles, error: rolesErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rolesErr) throw new Error(`No se pudo validar el rol: ${rolesErr.message}`);
    const okRoles = new Set(["super_admin", "editor"]);
    const allowed = (roles ?? []).some((r) => okRoles.has(String(r.role)));
    if (!allowed) {
      throw new Error("No tienes permiso para cambiar el estado de pedidos.");
    }

    let posCancelled = false;
    let posError: string | undefined;

    if (data.status === "cancelado") {
      const { data: row } = await supabaseAdmin
        .from("orders")
        .select("rp_pedido_id")
        .eq("id", data.orderId)
        .maybeSingle();
      const rpId = row?.rp_pedido_id;
      if (rpId) {
        const motivo = data.cancelReason ?? "Cancelado desde la web";
        const r = await rpCancelarDelivery(rpId, motivo);
        posCancelled = r.ok;
        if (!r.ok) posError = r.mensaje;
      }
    }

    const patch: Record<string, unknown> =
      data.status === "cancelado"
        ? {
            status: data.status,
            cancel_reason: data.cancelReason ?? "Cancelado desde el POS",
            cancelled_at: new Date().toISOString(),
          }
        : { status: data.status };

    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update(patch as never)
      .eq("id", data.orderId);
    if (updErr) throw new Error(`Update falló: ${updErr.message}`);

    return { ok: true as const, posCancelled, posError };
  });
