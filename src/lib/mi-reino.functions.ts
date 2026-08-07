// Server functions del área "Mi Reino" del cliente.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { phoneSchema } from "@/lib/form-validation";

export type MyOrderItem = {
  productoId: string;
  nombre: string;
  cantidad: number;
  precio: number;
  modificadores?: { grupoId: number; opcionId: number; nombre: string; precio: number }[];
};

export type MyOrderRow = {
  id: string;
  status: string;
  tipo: string;
  total: number;
  subtotal: number;
  created_at: string;
  sede_id: string;
  rp_numero_comanda: string | null;
  items: MyOrderItem[];
  is_favorite?: boolean;
  alias?: string | null;
};

export const getMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyOrderRow[]> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("orders")
      .select("id, status, tipo, total, subtotal, created_at, sede_id, rp_numero_comanda, items")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30)
      .throwOnError();

    const { data: favs } = await supabase
      .from("order_favorites")
      .select("order_id, alias")
      .eq("user_id", userId)
      .throwOnError();
    const favMap = new Map((favs ?? []).map((f) => [f.order_id, f.alias]));

    return ((data ?? []) as unknown as MyOrderRow[]).map((o) => ({
      ...o,
      is_favorite: favMap.has(o.id),
      alias: favMap.get(o.id) ?? null,
    }));
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        order_id: z.string().uuid(),
        alias: z.string().trim().max(60).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("order_favorites")
      .select("id")
      .eq("user_id", userId)
      .eq("order_id", data.order_id)
      .maybeSingle()
      .throwOnError();

    if (existing) {
      if (data.alias === undefined) {
        await supabase.from("order_favorites").delete().eq("id", existing.id).throwOnError();
        return { favorite: false };
      }
      await supabase
        .from("order_favorites")
        .update({ alias: data.alias || null })
        .eq("id", existing.id)
        .throwOnError();
      return { favorite: true };
    }
    await supabase
      .from("order_favorites")
      .insert({ user_id: userId, order_id: data.order_id, alias: data.alias || null })
      .throwOnError();
    return { favorite: true };
  });

export const listMyFavorites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyOrderRow[]> => {
    const { supabase, userId } = context;
    const { data: favs } = await supabase
      .from("order_favorites")
      .select(
        "order_id, alias, created_at, orders(id, status, tipo, total, subtotal, created_at, sede_id, rp_numero_comanda, items)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .throwOnError();
    return (favs ?? [])
      .map((f) => {
        const o = (f as unknown as { orders: MyOrderRow | null }).orders;
        if (!o) return null;
        const alias = (f as { alias: string | null }).alias;
        const row: MyOrderRow = { ...o, is_favorite: true, alias };
        return row;
      })
      .filter((x): x is MyOrderRow => x !== null);
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        display_name: z.string().trim().max(120).optional().nullable(),
        whatsapp: z.union([z.literal(""), phoneSchema]).optional().nullable(),
        ciudad: z.string().trim().max(80).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        display_name: data.display_name || null,
        whatsapp: data.whatsapp || null,
        ciudad: data.ciudad || null,
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("id, display_name, whatsapp, ciudad, arquetipo")
      .eq("id", context.userId)
      .maybeSingle()
      .throwOnError();
    return (
      data ?? {
        id: context.userId,
        display_name: null,
        whatsapp: null,
        ciudad: null,
        arquetipo: null,
      }
    );
  });
