// Verifica el UUID no-adivinable usado como capacidad del tracker.
//
// Nota arquitectural (junio 2026): se eliminó el polling de guerrilla contra
// el endpoint interno del POS de Restaurant.pe. La app es 100% reactiva al
// webhook público + Supabase Realtime. Ya no dependemos del POS cookie.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ORDER_UUID_RE } from "@/lib/order-lookup";

export const resolveOrderId = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ ref: z.string().regex(ORDER_UUID_RE) }).parse(input),
  )
  .handler(async ({ data }) => {
    const ref = data.ref.trim();
    const { data: row } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("id", ref)
      .maybeSingle();
    return row ? { id: row.id } : { notFound: true as const };
  });
