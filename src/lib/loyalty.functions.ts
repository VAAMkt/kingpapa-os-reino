// Server functions de fidelización.
// Todas requieren sesión; RLS filtra por auth.uid().
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LoyaltyAccount = {
  user_id: string;
  puntos_balance: number;
  puntos_lifetime: number;
  tier: string;
  referral_code: string;
  completed_orders: number;
};

export type LedgerRow = {
  id: string;
  tipo: string;
  puntos: number;
  motivo: string;
  created_at: string;
  order_id: string | null;
};

export type Reward = {
  id: string;
  nombre: string;
  descripcion: string | null;
  costo_puntos: number;
  tipo: string;
  valor: number;
  imagen: string | null;
  stock: number | null;
  orden: number;
};

export type Redemption = {
  id: string;
  codigo: string;
  status: string;
  puntos_gastados: number;
  expires_at: string;
  used_at: string | null;
  created_at: string;
  reward: { nombre: string; tipo: string; valor: number } | null;
};

export const getMyLoyalty = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ account: LoyaltyAccount; ledger: LedgerRow[] }> => {
    const { supabase, userId } = context;
    const [{ data: acc }, { data: ledger }, { count: completedOrders }] = await Promise.all([
      supabase
        .from("loyalty_accounts")
        .select("user_id, puntos_balance, puntos_lifetime, tier, referral_code")
        .eq("user_id", userId)
        .maybeSingle()
        .throwOnError(),
      supabase
        .from("loyalty_ledger")
        .select("id, tipo, puntos, motivo, created_at, order_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30)
        .throwOnError(),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "entregado")
        .eq("is_test", false)
        .is("analytics_excluded_at", null)
        .throwOnError(),
    ]);
    return {
      account: {
        ...((acc as Omit<LoyaltyAccount, "completed_orders"> | null) ?? {
          user_id: userId,
          puntos_balance: 0,
          puntos_lifetime: 0,
          tier: "parcero",
          referral_code: "",
        }),
        completed_orders: completedOrders ?? 0,
      },
      ledger: (ledger ?? []) as LedgerRow[],
    };
  });

export const listRewards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Reward[]> => {
    const { data } = await context.supabase
      .from("loyalty_rewards")
      .select("id, nombre, descripcion, costo_puntos, tipo, valor, imagen, stock, orden")
      .eq("activo", true)
      .order("orden", { ascending: true })
      .order("costo_puntos", { ascending: true })
      .throwOnError();
    return (data ?? []) as Reward[];
  });

export const redeemReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ reward_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc("redeem_reward", {
      _reward_id: data.reward_id,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(res) ? res[0] : res;
    return row as { redemption_id: string; codigo: string; expires_at: string };
  });

export const listMyRedemptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Redemption[]> => {
    const { data } = await context.supabase
      .from("loyalty_redemptions")
      .select(
        "id, codigo, status, puntos_gastados, expires_at, used_at, created_at, loyalty_rewards(nombre, tipo, valor)",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50)
      .throwOnError();
    return (data ?? []).map((r) => {
      const rec = r as unknown as Record<string, unknown>;
      const rw = rec.loyalty_rewards as { nombre: string; tipo: string; valor: number } | null;
      return {
        id: rec.id as string,
        codigo: rec.codigo as string,
        status: rec.status as string,
        puntos_gastados: rec.puntos_gastados as number,
        expires_at: rec.expires_at as string,
        used_at: (rec.used_at as string | null) ?? null,
        created_at: rec.created_at as string,
        reward: rw,
      };
    });
  });

export const saveSubditoQuiz = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email().optional().nullable(),
        whatsapp: z.string().max(40).optional().nullable(),
        arquetipo: z.string().max(50).optional().nullable(),
        ciudad: z.string().max(80).optional().nullable(),
        respuestas: z.record(z.string(), z.string()).default({}),
      })
      .refine((v) => !!(v.email || v.whatsapp), { message: "Email o WhatsApp requerido" })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // Best-effort: si el email ya existe (índice único), reintenta como update.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Intenta enlazar con el user_id si vino Authorization
    let user_id: string | null = null;
    try {
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      const auth = getRequestHeader("authorization");
      if (auth?.startsWith("Bearer ")) {
        const { createClient } = await import("@supabase/supabase-js");
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (url && key) {
          const sb = createClient(url, key, {
            global: { headers: { Authorization: auth } },
          });
          const { data: u } = await sb.auth.getUser();
          user_id = u.user?.id ?? null;
        }
      }
    } catch {
      /* invitado */
    }

    const row = {
      user_id,
      email: data.email ?? null,
      whatsapp: data.whatsapp ?? null,
      arquetipo: data.arquetipo ?? null,
      ciudad: data.ciudad ?? null,
      respuestas: data.respuestas,
      source: "quiz",
    };
    const { error } = await supabaseAdmin.from("subditos").insert(row);
    if (error && !/duplicate key/i.test(error.message)) {
      throw new Error(error.message);
    }
    return { ok: true };
  });
