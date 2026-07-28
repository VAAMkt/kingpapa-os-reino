// Server functions para el dashboard admin, gestión de fidelización y súbditos.
// Autorización: requiere rol super_admin | marketing (verificado vía user_roles).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RANGES = ["24h", "7d", "30d"] as const;
type Range = (typeof RANGES)[number];

function rangeMs(r: Range) {
  return r === "24h" ? 24 * 3600 * 1000 : r === "7d" ? 7 * 86400 * 1000 : 30 * 86400 * 1000;
}

async function assertAdmin(
  supabase: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          a: string,
          v: string,
        ) => { in: (b: string, arr: string[]) => Promise<{ data: { role: string }[] | null }> };
      };
    };
  },
  userId: string,
) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["super_admin", "marketing"]);
  if (!data || data.length === 0) throw new Error("Forbidden: se requiere super_admin o marketing");
}

export type AdminDashboardData = {
  range: Range;
  kpis: {
    pedidos: number;
    ingresos: number;
    ticketPromedio: number;
    cancelacionPct: number;
    subditosNuevos: number;
    subditosTotal: number;
  };
  porCanal: { tipo: string; pedidos: number; ingresos: number }[];
  porSede: { sede_id: string; sede_nombre: string; pedidos: number; ingresos: number }[];
  productosTop: { nombre: string; cantidad: number }[];
  porEstado: { status: string; count: number }[];
  ultimos: {
    id: string;
    status: string;
    total: number;
    created_at: string;
    cliente_nombre: string;
    rp_numero_comanda: string | null;
  }[];
};

export const getAdminDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ range: z.enum(RANGES).default("7d") }).parse(input))
  .handler(async ({ data, context }): Promise<AdminDashboardData> => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - rangeMs(data.range)).toISOString();

    const [{ data: orders }, { data: sedes }, { data: subCount }, { data: subNuevos }] =
      await Promise.all([
        supabaseAdmin
          .from("orders")
          .select("id, status, tipo, total, sede_id, created_at, cliente, items, rp_numero_comanda")
          .gt("created_at", since)
          .order("created_at", { ascending: false }),
        supabaseAdmin.from("sedes").select("id, nombre"),
        supabaseAdmin.from("subditos").select("id", { count: "exact", head: true }),
        supabaseAdmin
          .from("subditos")
          .select("id", { count: "exact", head: true })
          .gt("created_at", since),
      ]);

    const rows = (orders ?? []) as Array<{
      id: string;
      status: string;
      tipo: string;
      total: number;
      sede_id: string;
      created_at: string;
      cliente: { nombre?: string } | null;
      items: MyItem[] | null;
      rp_numero_comanda: string | null;
    }>;

    const sedeName = new Map((sedes ?? []).map((s) => [s.id as string, s.nombre as string]));

    const total = rows.length;
    const canceladas = rows.filter((r) => r.status === "cancelado").length;
    const ingresos = rows
      .filter((r) => r.status !== "cancelado")
      .reduce((a, r) => a + Number(r.total || 0), 0);
    const activos = rows.filter((r) => r.status !== "cancelado").length;

    const canalMap = new Map<string, { pedidos: number; ingresos: number }>();
    const sedeMap = new Map<string, { pedidos: number; ingresos: number }>();
    const prodMap = new Map<string, number>();
    const estadoMap = new Map<string, number>();

    for (const r of rows) {
      const c = canalMap.get(r.tipo) ?? { pedidos: 0, ingresos: 0 };
      c.pedidos += 1;
      if (r.status !== "cancelado") c.ingresos += Number(r.total || 0);
      canalMap.set(r.tipo, c);

      const s = sedeMap.get(r.sede_id) ?? { pedidos: 0, ingresos: 0 };
      s.pedidos += 1;
      if (r.status !== "cancelado") s.ingresos += Number(r.total || 0);
      sedeMap.set(r.sede_id, s);

      estadoMap.set(r.status, (estadoMap.get(r.status) ?? 0) + 1);

      for (const it of r.items ?? []) {
        prodMap.set(it.nombre, (prodMap.get(it.nombre) ?? 0) + Number(it.cantidad || 0));
      }
    }

    const cliente = (c: unknown): string => {
      const o = c as { nombre?: string } | null;
      return o?.nombre ?? "—";
    };

    return {
      range: data.range,
      kpis: {
        pedidos: total,
        ingresos,
        ticketPromedio: activos > 0 ? Math.round(ingresos / activos) : 0,
        cancelacionPct: total > 0 ? Math.round((canceladas / total) * 100) : 0,
        subditosNuevos: (subNuevos as unknown as { count?: number } | null)?.count ?? 0,
        subditosTotal: (subCount as unknown as { count?: number } | null)?.count ?? 0,
      },
      porCanal: [...canalMap.entries()]
        .map(([tipo, v]) => ({ tipo, ...v }))
        .sort((a, b) => b.pedidos - a.pedidos),
      porSede: [...sedeMap.entries()]
        .map(([id, v]) => ({ sede_id: id, sede_nombre: sedeName.get(id) ?? id.slice(0, 6), ...v }))
        .sort((a, b) => b.pedidos - a.pedidos)
        .slice(0, 8),
      productosTop: [...prodMap.entries()]
        .map(([nombre, cantidad]) => ({ nombre, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 8),
      porEstado: [...estadoMap.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      ultimos: rows.slice(0, 10).map((r) => ({
        id: r.id,
        status: r.status,
        total: Number(r.total || 0),
        created_at: r.created_at,
        cliente_nombre: cliente(r.cliente),
        rp_numero_comanda: r.rp_numero_comanda,
      })),
    };
  });

type MyItem = { nombre: string; cantidad: number };

// ---------- Súbditos ----------
export const listSubditos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ search: z.string().max(120).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("subditos")
      .select("id, email, whatsapp, arquetipo, ciudad, created_at, source, user_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.search) {
      const q = data.search.trim();
      query = query.or(
        `email.ilike.%${q}%,whatsapp.ilike.%${q}%,ciudad.ilike.%${q}%,arquetipo.ilike.%${q}%`,
      );
    }
    const { data: rows } = await query;
    return rows ?? [];
  });

// ---------- Loyalty admin ----------
export const listLoyaltyAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ search: z.string().max(120).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: accounts } = await supabaseAdmin
      .from("loyalty_accounts")
      .select("user_id, puntos_balance, puntos_lifetime, tier, referral_code, updated_at")
      .order("puntos_lifetime", { ascending: false })
      .limit(200);
    const ids = (accounts ?? []).map((a) => a.user_id as string);
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, display_name, whatsapp").in("id", ids)
      : { data: [] as { id: string; display_name: string | null; whatsapp: string | null }[] };
    const emails: Record<string, string | null> = {};
    if (ids.length) {
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      for (const u of usersData?.users ?? []) emails[u.id] = u.email ?? null;
    }
    const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const rows = (accounts ?? []).map((a) => {
      const p = pMap.get(a.user_id as string);
      return {
        user_id: a.user_id as string,
        display_name: p?.display_name ?? null,
        whatsapp: p?.whatsapp ?? null,
        email: emails[a.user_id as string] ?? null,
        puntos_balance: a.puntos_balance as number,
        puntos_lifetime: a.puntos_lifetime as number,
        tier: a.tier as string,
        referral_code: a.referral_code as string,
      };
    });
    if (data.search) {
      const q = data.search.toLowerCase();
      return rows.filter(
        (r) =>
          (r.display_name ?? "").toLowerCase().includes(q) ||
          (r.email ?? "").toLowerCase().includes(q) ||
          (r.whatsapp ?? "").toLowerCase().includes(q),
      );
    }
    return rows;
  });

export const adjustPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        user_id: z.string().uuid(),
        puntos: z.number().int(),
        motivo: z.string().min(3).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("loyalty_accounts")
      .insert({ user_id: data.user_id })
      .select()
      .maybeSingle();
    const { data: acc } = await supabaseAdmin
      .from("loyalty_accounts")
      .select("puntos_balance, puntos_lifetime")
      .eq("user_id", data.user_id)
      .single();
    const newBal = Math.max(0, (acc?.puntos_balance ?? 0) + data.puntos);
    const newLife = Math.max(0, (acc?.puntos_lifetime ?? 0) + Math.max(0, data.puntos));
    const tier = newLife >= 2000 ? "coronado" : newLife >= 500 ? "rey" : "parcero";
    await supabaseAdmin
      .from("loyalty_accounts")
      .update({ puntos_balance: newBal, puntos_lifetime: newLife, tier })
      .eq("user_id", data.user_id);
    await supabaseAdmin.from("loyalty_ledger").insert({
      user_id: data.user_id,
      tipo: "adjust",
      puntos: data.puntos,
      motivo: `Ajuste manual: ${data.motivo}`,
      meta: { by: context.userId },
    });
    return { ok: true, balance: newBal };
  });

export const listRewardsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("loyalty_rewards")
      .select("*")
      .order("orden", { ascending: true });
    return data ?? [];
  });

export const upsertReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        nombre: z.string().min(1).max(120),
        descripcion: z.string().max(400).optional().nullable(),
        costo_puntos: z.number().int().min(1),
        tipo: z.enum(["descuento_fijo", "producto", "envio_gratis"]),
        valor: z.number().min(0).default(0),
        activo: z.boolean().default(true),
        stock: z.number().int().min(0).optional().nullable(),
        orden: z.number().int().default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { error } = await supabaseAdmin.from("loyalty_rewards").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("loyalty_rewards")
      .insert(data)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id as string };
  });

export const deleteReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("loyalty_rewards").update({ activo: false }).eq("id", data.id);
    return { ok: true };
  });
