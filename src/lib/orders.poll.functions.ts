// Resolver de ID de pedido. Acepta UUID o `rp_pedido_id` numérico y devuelve
// el UUID real de `orders.id` (necesario para Realtime y para links viejos
// de WhatsApp / `/gracias?order_id=160364`).
//
// Nota arquitectural (junio 2026): se eliminó el polling de guerrilla contra
// el endpoint interno del POS de Restaurant.pe. La app es 100% reactiva al
// webhook público + Supabase Realtime. Ya no dependemos del POS cookie.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const resolveOrderId = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ ref: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data }) => {
    const ref = data.ref.trim();
    if (UUID_RE.test(ref)) {
      const { data: row } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("id", ref)
        .maybeSingle();
      return row ? { id: row.id } : { notFound: true as const };
    }
    const { data: rows } = await supabaseAdmin
      .from("orders")
      .select("id, created_at")
      .eq("rp_pedido_id", ref)
      .order("created_at", { ascending: false })
      .limit(1);
    if (rows && rows.length > 0) return { id: rows[0].id };
    return { notFound: true as const };
  });
