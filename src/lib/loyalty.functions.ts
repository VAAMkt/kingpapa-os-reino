// Server functions de fidelización.
// Todas requieren sesión; RLS filtra por auth.uid().
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { phoneSchema } from "@/lib/form-validation";
import { CLANS } from "@/lib/loyalty-model";

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

export type QuizAnswers = {
  hambre: "1" | "3" | "5";
  picante: "0" | "1" | "3";
  ocasion: "parche" | "after-rumba" | "almuerzo-obrero" | "familia" | "antojo-mortal";
  presupuesto: "bajo" | "medio" | "alto";
  ciudad: "Cali" | "Bogotá" | "Jamundí" | "Medellín";
  canal: "web" | "whatsapp" | "rappi" | "didi" | "pickup";
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        whatsapp: phoneSchema,
        arquetipo: z.enum(CLANS),
        ciudad: z.string().trim().min(2).max(80),
        respuestas: z.object({
          hambre: z.enum(["1", "3", "5"]),
          picante: z.enum(["0", "1", "3"]),
          ocasion: z.enum(["parche", "after-rumba", "almuerzo-obrero", "familia", "antojo-mortal"]),
          presupuesto: z.enum(["bajo", "medio", "alto"]),
          ciudad: z.enum(["Cali", "Bogotá", "Jamundí", "Medellín"]),
          canal: z.enum(["web", "whatsapp", "rappi", "didi", "pickup"]),
        }),
        habeas_data_accepted: z.literal(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = typeof context.claims.email === "string" ? context.claims.email : null;
    const row = {
      user_id: context.userId,
      email,
      whatsapp: data.whatsapp,
      arquetipo: data.arquetipo,
      ciudad: data.ciudad,
      respuestas: data.respuestas,
      source: "quiz",
      habeas_data_accepted_at: new Date().toISOString(),
      habeas_data_version: "PO-CM-15/2024-01-31",
    };

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: context.userId,
        whatsapp: data.whatsapp,
        ciudad: data.ciudad,
        arquetipo: data.arquetipo,
      },
      { onConflict: "id" },
    );
    const { error: quizError } = await supabaseAdmin
      .from("subditos")
      .upsert(row, { onConflict: "user_id" });
    if (profileError || quizError) {
      console.error("[loyalty] No se pudo guardar el test", profileError ?? quizError);
      throw new Error("No pudimos guardar tu clan. Intenta de nuevo.");
    }
    return { ok: true, arquetipo: data.arquetipo };
  });
