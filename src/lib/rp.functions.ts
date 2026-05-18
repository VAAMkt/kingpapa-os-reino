// Server functions para sincronización y consulta del catálogo Restaurant.pe.
// REGLA tss-serverfn-split: este archivo SOLO contiene declaraciones de
// createServerFn + sus imports. Helpers van en *.server.ts.
//
// FASE 3 — Catálogo Maestro Global:
//   - categorias_master / productos_master: una sola fila por rp_id (marca).
//   - sede_producto_overrides: visibilidad/stock por (sede, producto).

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

// Extrae categorías y productos del envelope de obtenerCartaPorLocal.
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
  const categoriasAll = categoriasRaw.map((c, i) =>
    normalizeCategoria(c as Parameters<typeof normalizeCategoria>[0], i),
  );
  const categorias = categoriasAll.filter((c) => c.activo);
  const activeCatIds = new Set(categorias.map((c) => c.rp_id));
  const productos = productosRaw
    .map((p, i) =>
      normalizeProduct(p as Parameters<typeof normalizeProduct>[0], i),
    )
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .filter((p) => p.rp_categoria_id != null && activeCatIds.has(p.rp_categoria_id));
  return { categorias, productos };
}

// Sincroniza el menú de UNA sede contra las tablas maestras + overrides.
// - Upsert global por rp_id en categorias_master/productos_master (no pisa orden/activo manuales).
// - Upsert per-sede en sede_producto_overrides (no pisa disponible manual de filas existentes).
// - Marca como no disponibles los overrides cuyos productos ya no vienen en el catálogo.
async function syncSedeMenu(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  sede: { id: string; rp_local_id: number | null },
): Promise<{ categorias: number; productos: number }> {
  const menu = await rpGetCatalogo(sede.rp_local_id!);
  const { categorias: catsRaw, productos: prodsRaw } = extractMenu(menu);

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

  // 1) Upsert categorias_master por rp_id.
  //    - Filas NUEVAS: nombre + orden viene del POS.
  //    - Filas EXISTENTES: NO pisamos nombre (el admin puede haberlo renombrado),
  //      solo refrescamos updated_at para que conste la sync.
  const catIdByRpId = new Map<number, string>();
  if (categorias.length > 0) {
    const rpIds = categorias.map((c) => c.rp_id);
    const { data: existingCats } = await supabase
      .from("categorias_master")
      .select("rp_id")
      .in("rp_id", rpIds);
    const existing = new Set((existingCats ?? []).map((r: { rp_id: number }) => r.rp_id));
    const rows = categorias.map((c) => {
      const base: Record<string, unknown> = { rp_id: c.rp_id };
      if (!existing.has(c.rp_id)) {
        base.nombre = c.nombre;
        base.orden = c.orden;
      } else {
        base.updated_at = new Date().toISOString();
      }
      return base;
    });
    const { data: upsertedCats, error: catErr } = await supabase
      .from("categorias_master")
      .upsert(rows as never, { onConflict: "rp_id" })
      .select("id, rp_id");
    if (catErr) throw new Error(`categorías: ${catErr.message}`);
    for (const row of (upsertedCats ?? []) as { id: string; rp_id: number }[]) {
      catIdByRpId.set(row.rp_id, row.id);
    }
  }

  // 2) Upsert productos_master por rp_id.
  //    - Filas NUEVAS: TODO viene del POS (nombre, descripcion, precio, imagen, ...).
  //    - Filas EXISTENTES: NO pisamos nombre/descripcion/orden/disponible (los edita el admin).
  //      SÍ refrescamos campos que vienen del POS: precio, imagen_url, modificadores, almacen_id, categoria.
  const prodIdByRpId = new Map<number, string>();
  if (productos.length > 0) {
    const rpIds = productos.map((p) => p.rp_id);
    const { data: existingProds } = await supabase
      .from("productos_master")
      .select("rp_id")
      .in("rp_id", rpIds);
    const existing = new Set((existingProds ?? []).map((r: { rp_id: number }) => r.rp_id));
    const rows = productos.map((p) => {
      const base: Record<string, unknown> = {
        rp_id: p.rp_id,
        categoria_id:
          p.rp_categoria_id != null
            ? catIdByRpId.get(p.rp_categoria_id) ?? null
            : null,
        precio: p.precio,
        imagen_url: p.imagen_url,
        modificadores: p.modificadores,
        modificadores_raw: p.modificadores_raw,
        almacen_id: p.almacen_id,
      };
      if (!existing.has(p.rp_id)) {
        base.nombre = p.nombre;
        base.descripcion = p.descripcion;
        base.orden = p.orden;
        base.disponible = p.disponible;
      }
      return base;
    });
    const { data: upsertedProds, error: prodErr } = await supabase
      .from("productos_master")
      .upsert(rows as never, { onConflict: "rp_id" })
      .select("id, rp_id");
    if (prodErr) throw new Error(`productos: ${prodErr.message}`);
    for (const row of (upsertedProds ?? []) as { id: string; rp_id: number }[]) {
      prodIdByRpId.set(row.rp_id, row.id);
    }
  }

  // 3) Upsert overrides: una fila por (sede, producto) que vino en el catálogo.
  //    Solo seteamos `disponible=true` para filas NUEVAS — respetamos el toggle manual.
  if (prodIdByRpId.size > 0) {
    const productIds = Array.from(prodIdByRpId.values());
    const { data: existingOvr } = await supabase
      .from("sede_producto_overrides")
      .select("producto_id")
      .eq("sede_id", sede.id)
      .in("producto_id", productIds);
    const existingProdIds = new Set(
      (existingOvr ?? []).map((r: { producto_id: string }) => r.producto_id),
    );
    const ovrRows = productIds.map((pid) => {
      const base: Record<string, unknown> = {
        sede_id: sede.id,
        producto_id: pid,
      };
      if (!existingProdIds.has(pid)) base.disponible = true;
      return base;
    });
    const { error: ovrErr } = await supabase
      .from("sede_producto_overrides")
      .upsert(ovrRows as never, { onConflict: "sede_id,producto_id" });
    if (ovrErr) throw new Error(`overrides: ${ovrErr.message}`);

    // 4) Productos que YA NO vienen en el catálogo de esta sede -> override.disponible=false
    await supabase
      .from("sede_producto_overrides")
      .update({ disponible: false } as never)
      .eq("sede_id", sede.id)
      .not("producto_id", "in", `(${productIds.map((id) => `"${id}"`).join(",")})`);
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

    return { ok: true, categorias, productos };
  });

// Devuelve menú para una sede: JOIN productos_master ⨝ sede_producto_overrides.
// Mantiene el mismo shape `{ sede, categorias, productos }` que la UI ya consume.
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

    // Overrides disponibles para esta sede + producto maestro activo.
    const { data: ovr, error: ovrErr } = await supabaseAdmin
      .from("sede_producto_overrides")
      .select(
        `disponible, precio_override, stock_cache,
         productos_master!inner (
           id, rp_id, categoria_id, nombre, nombre_override, descripcion, descripcion_override, precio,
           imagen_url, disponible, almacen_id, orden,
           destacado, es_nuevo, es_mas_vendido, es_recomendado, etiqueta_custom
         )`,
      )
      .eq("sede_id", sede.id)
      .eq("disponible", true);
    if (ovrErr) throw new Error(ovrErr.message);

    type OvrRow = {
      disponible: boolean;
      precio_override: number | null;
      stock_cache: number | null;
      productos_master: {
        id: string;
        rp_id: number;
        categoria_id: string | null;
        nombre: string;
        nombre_override: string | null;
        descripcion: string | null;
        descripcion_override: string | null;
        precio: number | string;
        imagen_url: string | null;
        disponible: boolean;
        almacen_id: number | null;
        orden: number;
        destacado: boolean;
        es_nuevo: boolean;
        es_mas_vendido: boolean;
        es_recomendado: boolean;
        etiqueta_custom: string | null;
      };
    };

    const productos = ((ovr ?? []) as unknown as OvrRow[])
      .filter((r) => r.productos_master?.disponible)
      .map((r) => {
        const pm = r.productos_master;
        return {
          id: pm.id,
          rp_id: pm.rp_id,
          categoria_id: pm.categoria_id,
          nombre: pm.nombre_override ?? pm.nombre,
          descripcion: pm.descripcion_override ?? pm.descripcion,
          precio: r.precio_override ?? pm.precio,
          imagen_url: pm.imagen_url,
          disponible: true,
          almacen_id: pm.almacen_id,
          orden: pm.orden,
          destacado: pm.destacado,
          es_nuevo: pm.es_nuevo,
          es_mas_vendido: pm.es_mas_vendido,
          es_recomendado: pm.es_recomendado,
          etiqueta_custom: pm.etiqueta_custom,
        };
      })
      .sort((a, b) => a.orden - b.orden);

    // Categorías que efectivamente tienen productos visibles en esta sede.
    const catIds = Array.from(
      new Set(productos.map((p) => p.categoria_id).filter((x): x is string => !!x)),
    );
    let categorias: Array<{ id: string; rp_id: number; nombre: string; orden: number }> = [];
    if (catIds.length > 0) {
      const { data: cats, error: catErr } = await supabaseAdmin
        .from("categorias_master")
        .select("id, rp_id, nombre, nombre_override, orden")
        .in("id", catIds)
        .eq("activo", true)
        .order("orden");
      if (catErr) throw new Error(catErr.message);
      categorias = ((cats ?? []) as Array<{
        id: string;
        rp_id: number;
        nombre: string;
        nombre_override: string | null;
        orden: number;
      }>).map((c) => ({
        id: c.id,
        rp_id: c.rp_id,
        nombre: c.nombre_override ?? c.nombre,
        orden: c.orden,
      }));
    }

    return {
      sede: { id: sede.id, slug: sede.slug, nombre: sede.nombre, ciudad: sede.ciudad },
      categorias,
      productos,
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
      .from("productos_master")
      .select("id, rp_id, almacen_id, nombre")
      .in("id", data.productIds);

    const results: Array<{ id: string; rp_id: number; stock: number | null; ok: boolean }> = [];
    for (const p of (productos ?? []) as Array<{
      id: string;
      rp_id: number;
      almacen_id: number | null;
    }>) {
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

    const targets = (sedes ?? []).filter((s: { rp_local_id: number | null }) => s.rp_local_id != null);
    if (targets.length === 0) {
      return { ok: true, sedes: 0, categorias: 0, productos: 0, errores: [] as string[] };
    }

    let totalCats = 0;
    let totalProds = 0;
    const errores: string[] = [];

    // Las sedes comparten tablas master ahora — bajamos a CONCURRENCY=2
    // para evitar contención en upserts simultáneos por rp_id.
    const CONCURRENCY = 2;
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      const batch = targets.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((sede: { id: string; nombre: string; rp_local_id: number | null }) =>
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

// ========== ADMIN MENU (catálogo global, sin sede) ==========

export const listAdminMenu = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: categorias, error: catErr }, { data: productos, error: prodErr }] =
      await Promise.all([
        supabase
          .from("categorias_master")
          .select("id, rp_id, nombre, nombre_override, orden, activo")
          .order("orden")
          .order("nombre"),
        supabase
          .from("productos_master")
          .select(
            "id, rp_id, categoria_id, nombre, nombre_override, descripcion, descripcion_override, precio, imagen_url, disponible, orden, destacado, es_nuevo, es_mas_vendido, es_recomendado, etiqueta_custom, clasificacion_me, margen_pct",
          )
          .order("orden")
          .order("nombre"),
      ]);
    if (catErr) throw new Error(catErr.message);
    if (prodErr) throw new Error(prodErr.message);
    return { categorias: categorias ?? [], productos: productos ?? [] };
  });

export const updateAdminCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        orden: z.number().int().min(0).max(9999).optional(),
        activo: z.boolean().optional(),
        nombre_override: z.string().max(120).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.orden !== undefined) patch.orden = data.orden;
    if (data.activo !== undefined) patch.activo = data.activo;
    if (data.nombre_override !== undefined) {
      patch.nombre_override = data.nombre_override?.trim() || null;
    }
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("categorias_master")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateAdminProducto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        orden: z.number().int().min(0).max(9999).optional(),
        disponible: z.boolean().optional(),
        nombre_override: z.string().max(120).nullable().optional(),
        descripcion_override: z.string().max(500).nullable().optional(),
        destacado: z.boolean().optional(),
        es_nuevo: z.boolean().optional(),
        es_mas_vendido: z.boolean().optional(),
        es_recomendado: z.boolean().optional(),
        etiqueta_custom: z.string().max(40).nullable().optional(),
        clasificacion_me: z
          .enum(["star", "plowhorse", "puzzle", "dog"])
          .nullable()
          .optional(),
        margen_pct: z.number().min(0).max(100).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    const keys = [
      "orden",
      "disponible",
      "destacado",
      "es_nuevo",
      "es_mas_vendido",
      "es_recomendado",
      "clasificacion_me",
      "margen_pct",
    ] as const;
    for (const k of keys) {
      if (data[k] !== undefined) patch[k] = data[k];
    }
    if (data.nombre_override !== undefined) {
      patch.nombre_override = data.nombre_override?.trim() || null;
    }
    if (data.descripcion_override !== undefined) {
      patch.descripcion_override = data.descripcion_override?.trim() || null;
    }
    if (data.etiqueta_custom !== undefined) {
      patch.etiqueta_custom = data.etiqueta_custom?.trim() || null;
    }
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("productos_master")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const reorderInput = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().uuid(),
        orden: z.number().int().min(0).max(99999),
      }),
    )
    .min(1)
    .max(500),
});

export const reorderAdminCategorias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => reorderInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const results = await Promise.all(
      data.updates.map((u) =>
        supabase.from("categorias_master").update({ orden: u.orden } as never).eq("id", u.id),
      ),
    );
    const err = results.find((r) => r.error)?.error;
    if (err) throw new Error(err.message);
    return { ok: true, count: data.updates.length };
  });

export const reorderAdminProductos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => reorderInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const results = await Promise.all(
      data.updates.map((u) =>
        supabase.from("productos_master").update({ orden: u.orden } as never).eq("id", u.id),
      ),
    );
    const err = results.find((r) => r.error)?.error;
    if (err) throw new Error(err.message);
    return { ok: true, count: data.updates.length };
  });

// Toggle per-sede de un producto (override.disponible).
export const toggleSedeProductoOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        sedeId: z.string().uuid(),
        productoId: z.string().uuid(),
        disponible: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sede_producto_overrides")
      .upsert(
        {
          sede_id: data.sedeId,
          producto_id: data.productoId,
          disponible: data.disponible,
        } as never,
        { onConflict: "sede_id,producto_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
