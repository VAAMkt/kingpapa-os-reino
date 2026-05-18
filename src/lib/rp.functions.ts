// Server functions para sincronización y consulta del catálogo Restaurant.pe.
// REGLA tss-serverfn-split: este archivo SOLO contiene declaraciones de
// createServerFn + sus imports. Helpers van en *.server.ts.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  rpGetDominioInfo,
  rpGetCatalogo,
  rpGetStock,
} from "@/lib/restaurantpe.server";
import {
  normalizeBranch,
  normalizeCategoria,
  normalizeProduct,
} from "@/lib/restaurantpe-normalize";

// Para mutaciones usamos `context.supabase` (cliente del usuario autenticado)
// para que las RLS validen el rol editor/super_admin.
// Para lecturas públicas usamos `supabaseAdmin` (sin sesión disponible).

// Extrae categorías y productos del envelope real devuelto por
// `obtenerCartaPorLocal`. El envelope trae los productos en `data` (array)
// y las categorías en `listaCategorias` (raíz). Si `listaCategorias` viene
// vacío pero los productos traen `categoria_id` + `categoria_descripcion`,
// derivamos las categorías desde los productos como fallback.
function extractMenu(menu: unknown) {
  const env = (menu ?? {}) as Record<string, unknown>;
  const productosRaw = Array.isArray(env.data)
    ? (env.data as Record<string, unknown>[])
    : Array.isArray(menu)
      ? (menu as Record<string, unknown>[])
      : [];
  let categoriasRaw = Array.isArray(env.listaCategorias)
    ? (env.listaCategorias as Record<string, unknown>[])
    : [];
  if (categoriasRaw.length === 0 && productosRaw.length > 0) {
    const map = new Map<string, Record<string, unknown>>();
    for (const p of productosRaw) {
      const id = p["categoria_id"];
      const desc = p["categoria_descripcion"];
      if (id == null) continue;
      const key = String(id);
      if (!map.has(key)) {
        map.set(key, {
          categoria_id: id,
          categoria_descripcion: desc ?? `Categoría ${key}`,
          categoria_orden: 0,
        });
      }
    }
    categoriasRaw = Array.from(map.values());
  }
  const categorias = categoriasRaw.map((c) =>
    normalizeCategoria(c as Parameters<typeof normalizeCategoria>[0]),
  );
  const productos = productosRaw.map((p) =>
    normalizeProduct(p as Parameters<typeof normalizeProduct>[0]),
  );
  return { categorias, productos };
}

// Sincroniza el menú de UNA sede usando upserts en lote (3 llamadas a la base
// en vez de cientos). Devuelve los conteos. Lanza error si algo falla.
async function syncSedeMenu(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  sede: { id: string; rp_local_id: number | null },
): Promise<{ categorias: number; productos: number }> {
  const menu = await rpGetCatalogo(sede.rp_local_id!);
  const { categorias: catsRaw, productos: prodsRaw } = extractMenu(menu);

  // Deduplicar por rp_id: el upsert con onConflict no permite la misma clave
  // dos veces en un batch (Postgres: "ON CONFLICT DO UPDATE command cannot
  // affect row a second time"). Nos quedamos con la primera ocurrencia.
  const dedupeByRpId = <T extends { rp_id: number }>(arr: T[]): T[] => {
    const seen = new Set<number>();
    const out: T[] = [];
    for (const item of arr) {
      if (!item.rp_id || seen.has(item.rp_id)) continue;
      seen.add(item.rp_id);
      out.push(item);
    }
    return out;
  };
  const categorias = dedupeByRpId(catsRaw);
  const productos = dedupeByRpId(prodsRaw);

  if (categorias.length === 0 && productos.length === 0) {
    return { categorias: 0, productos: 0 };
  }

  // 1) Bulk upsert categorías y recibir el mapeo rp_id -> id en una sola llamada.
  const catIdByRpId = new Map<number, string>();
  if (categorias.length > 0) {
    const { data: upsertedCats, error: catErr } = await supabase
      .from("rp_categorias")
      .upsert(
        categorias.map((c) => ({
          sede_id: sede.id,
          rp_id: c.rp_id,
          nombre: c.nombre,
          orden: c.orden,
          activo: true,
        })),
        { onConflict: "sede_id,rp_id" },
      )
      .select("id, rp_id");
    if (catErr) throw new Error(`categorías: ${catErr.message}`);
    for (const row of upsertedCats ?? []) {
      catIdByRpId.set(row.rp_id as number, row.id as string);
    }
  }

  // 2) Bulk upsert productos en una sola llamada.
  if (productos.length > 0) {
    const rows = productos.map((p) => ({
      sede_id: sede.id,
      rp_id: p.rp_id,
      categoria_id:
        p.rp_categoria_id != null ? catIdByRpId.get(p.rp_categoria_id) ?? null : null,
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: p.precio,
      imagen_url: p.imagen_url,
      disponible: p.disponible,
      modificadores: p.modificadores as never,
      almacen_id: p.almacen_id,
    }));
    const { error: prodErr } = await supabase
      .from("rp_productos")
      .upsert(rows, { onConflict: "sede_id,rp_id" });
    if (prodErr) throw new Error(`productos: ${prodErr.message}`);
  }

  // 3) Marcar como no disponibles los que ya no vienen en el catálogo (1 query).
  const incomingIds = productos.map((p) => p.rp_id);
  if (incomingIds.length > 0) {
    await supabase
      .from("rp_productos")
      .update({ disponible: false })
      .eq("sede_id", sede.id)
      .not("rp_id", "in", `(${incomingIds.join(",")})`);
  }

  return { categorias: categorias.length, productos: productos.length };
}

export const syncBranches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const data = await rpGetDominioInfo();
    const locales = (data.locales ?? []).map(normalizeBranch);

    const log: { matched: number; missing: number[] } = { matched: 0, missing: [] };

    for (const local of locales) {
      const { data: existing } = await supabase
        .from("sedes")
        .select("id, rp_local_id")
        .eq("rp_local_id", local.rp_local_id)
        .maybeSingle();

      if (existing) {
        const { error: updErr } = await supabase
          .from("sedes")
          .update({
            lat: local.lat ?? undefined,
            lng: local.lng ?? undefined,
            delivery: local.delivery,
            pickup: local.pickup,
          })
          .eq("id", existing.id);
        if (updErr) throw new Error(`Sede ${local.rp_local_id}: ${updErr.message}`);
        log.matched += 1;
      } else {
        log.missing.push(local.rp_local_id);
      }
    }

    await supabase.from("rp_sync_log").insert({
      tipo: "branches",
      payload: { locales, log } as never,
      ok: true,
      mensaje: `Sincronizadas ${log.matched} sedes. ${log.missing.length} locales sin mapear.`,
    });

    return { ok: true, matched: log.matched, missingLocalIds: log.missing, total: locales.length };
  });

export const syncMenuForSede = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ sedeId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: sede, error: sedeErr } = await supabase
      .from("sedes")
      .select("id, rp_local_id, nombre")
      .eq("id", data.sedeId)
      .maybeSingle();
    if (sedeErr) throw new Error(sedeErr.message);
    if (!sede) throw new Error("Sede no encontrada");
    if (!sede.rp_local_id)
      throw new Error(`Sede "${sede.nombre}" no tiene rp_local_id asignado`);

    const { categorias, productos } = await syncSedeMenu(supabase, {
      id: sede.id,
      rp_local_id: sede.rp_local_id,
    });

    await supabase.from("rp_sync_log").insert({
      tipo: "menu",
      sede_id: sede.id,
      payload: { categorias, productos } as never,
      ok: true,
      mensaje: `Sincronizadas ${categorias} categorías y ${productos} productos.`,
    });

    return {
      ok: true,
      categorias,
      productos,
    };
  });

export const getMenuForSede = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ sedeSlug: z.string().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: sede, error: sedeErr } = await supabaseAdmin
      .from("sedes")
      .select("id, slug, nombre, ciudad, rp_local_id")
      .eq("slug", data.sedeSlug)
      .eq("publicado", true)
      .maybeSingle();
    if (sedeErr) throw new Error(sedeErr.message);
    if (!sede) return { sede: null, categorias: [], productos: [] };

    const [{ data: categorias }, { data: productos }] = await Promise.all([
      supabaseAdmin
        .from("rp_categorias")
        .select("id, rp_id, nombre, orden")
        .eq("sede_id", sede.id)
        .eq("activo", true)
        .order("orden"),
      supabaseAdmin
        .from("rp_productos")
        .select(
          "id, rp_id, categoria_id, nombre, descripcion, precio, imagen_url, disponible, modificadores, almacen_id",
        )
        .eq("sede_id", sede.id)
        .order("orden"),
    ]);

    return {
      sede: { id: sede.id, slug: sede.slug, nombre: sede.nombre, ciudad: sede.ciudad },
      categorias: categorias ?? [],
      productos: productos ?? [],
    };
  });

export const checkStockLive = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        sedeId: z.string().uuid(),
        productIds: z.array(z.string().uuid()).min(1).max(50),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: sede } = await supabaseAdmin
      .from("sedes")
      .select("rp_local_id")
      .eq("id", data.sedeId)
      .maybeSingle();
    if (!sede?.rp_local_id) throw new Error("Sede sin rp_local_id");

    const { data: productos } = await supabaseAdmin
      .from("rp_productos")
      .select("id, rp_id, almacen_id, nombre")
      .in("id", data.productIds);

    const results: Array<{ id: string; rp_id: number; stock: number | null; ok: boolean }> = [];
    for (const p of productos ?? []) {
      if (!p.almacen_id) {
        results.push({ id: p.id, rp_id: p.rp_id, stock: null, ok: true });
        continue;
      }
      try {
        const stockData = await rpGetStock({
          productoId: p.rp_id,
          localId: sede.rp_local_id,
          almacenId: p.almacen_id,
        });
        const stock = Number(stockData.total) || 0;
        results.push({ id: p.id, rp_id: p.rp_id, stock, ok: stock > 0 });
      } catch {
        results.push({ id: p.id, rp_id: p.rp_id, stock: null, ok: false });
      }
    }
    return { results };
  });

export const listSyncLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("rp_sync_log")
      .select("id, tipo, sede_id, ok, mensaje, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listRpLocales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const data = await rpGetDominioInfo();
    const locales = (data.locales ?? []).map(normalizeBranch);
    return locales.map((l) => ({
      rp_local_id: l.rp_local_id,
      nombre: l.nombre,
      direccion: l.direccion,
      lat: l.lat,
      lng: l.lng,
    }));
  });

export const syncAllMenus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const { data: sedes, error: sedesErr } = await supabase
      .from("sedes")
      .select("id, nombre, rp_local_id")
      .not("rp_local_id", "is", null);
    if (sedesErr) throw new Error(sedesErr.message);

    const targets = (sedes ?? []).filter((s) => s.rp_local_id != null);
    if (targets.length === 0) {
      return { ok: true, sedes: 0, categorias: 0, productos: 0, errores: [] as string[] };
    }

    let totalCats = 0;
    let totalProds = 0;
    const errores: string[] = [];

    // Concurrencia limitada: procesar sedes en lotes paralelos.
    const CONCURRENCY = 4;
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      const batch = targets.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((sede) =>
          syncSedeMenu(supabase, { id: sede.id, rp_local_id: sede.rp_local_id })
            .then((r) => ({ sede, ...r })),
        ),
      );
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === "fulfilled") {
          totalCats += r.value.categorias;
          totalProds += r.value.productos;
        } else {
          const sede = batch[j];
          errores.push(`${sede.nombre}: ${(r.reason as Error).message}`);
        }
      }
    }

    await supabase.from("rp_sync_log").insert({
      tipo: "menu_all",
      payload: { sedes: targets.length, categorias: totalCats, productos: totalProds } as never,
      ok: errores.length === 0,
      mensaje:
        errores.length === 0
          ? `OK: ${targets.length} sedes, ${totalCats} categorías y ${totalProds} productos upserteados.`
          : `Con errores en ${errores.length}/${targets.length}: ${errores.slice(0, 3).join(" | ")}`,
    });

    return {
      ok: errores.length === 0,
      sedes: targets.length,
      categorias: totalCats,
      productos: totalProds,
      errores,
    };
  });
