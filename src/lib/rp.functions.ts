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

    const menu = await rpGetCatalogo(sede.rp_local_id);
    const categorias = (menu.listaCategorias ?? []).map(normalizeCategoria);
    const productos = (menu.data ?? []).map(normalizeProduct);

    const catIdByRpId = new Map<number, string>();
    for (const c of categorias) {
      const { data: up, error } = await supabase
        .from("rp_categorias")
        .upsert(
          {
            sede_id: sede.id,
            rp_id: c.rp_id,
            nombre: c.nombre,
            orden: c.orden,
            activo: true,
          },
          { onConflict: "sede_id,rp_id" },
        )
        .select("id, rp_id")
        .single();
      if (error) throw new Error(`Categoría ${c.nombre}: ${error.message}`);
      catIdByRpId.set(c.rp_id, up.id);
    }

    let upsertedProducts = 0;
    for (const p of productos) {
      const categoria_id = p.rp_categoria_id != null
        ? catIdByRpId.get(p.rp_categoria_id) ?? null
        : null;
      const { error } = await supabase.from("rp_productos").upsert(
        {
          sede_id: sede.id,
          rp_id: p.rp_id,
          categoria_id,
          nombre: p.nombre,
          descripcion: p.descripcion,
          precio: p.precio,
          imagen_url: p.imagen_url,
          disponible: p.disponible,
          modificadores: p.modificadores as never,
          almacen_id: p.almacen_id,
        },
        { onConflict: "sede_id,rp_id" },
      );
      if (error) throw new Error(`Producto ${p.nombre}: ${error.message}`);
      upsertedProducts += 1;
    }

    const incomingIds = productos.map((p) => p.rp_id);
    if (incomingIds.length > 0) {
      await supabase
        .from("rp_productos")
        .update({ disponible: false })
        .eq("sede_id", sede.id)
        .not("rp_id", "in", `(${incomingIds.join(",")})`);
    }

    await supabase.from("rp_sync_log").insert({
      tipo: "menu",
      sede_id: sede.id,
      payload: { categorias: categorias.length, productos: productos.length } as never,
      ok: true,
      mensaje: `Sincronizadas ${categorias.length} categorías y ${upsertedProducts} productos.`,
    });

    return {
      ok: true,
      categorias: categorias.length,
      productos: upsertedProducts,
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
    let totalCatsSchema = 0;
    let totalProdsSchema = 0;
    const errores: string[] = [];

    for (let i = 0; i < targets.length; i++) {
      const sede = targets[i];
      try {
        // El catálogo es por LOCAL, lo traemos para cada sede.
        const menu = await rpGetCatalogo(sede.rp_local_id!);
        const categorias = (menu.listaCategorias ?? []).map(normalizeCategoria);
        const productos = (menu.data ?? []).map(normalizeProduct);
        totalCatsSchema = categorias.length;
        totalProdsSchema = productos.length;

        const catIdByRpId = new Map<number, string>();
        for (const c of categorias) {
          const { data: up, error } = await supabase
            .from("rp_categorias")
            .upsert(
              { sede_id: sede.id, rp_id: c.rp_id, nombre: c.nombre, orden: c.orden, activo: true },
              { onConflict: "sede_id,rp_id" },
            )
            .select("id, rp_id")
            .single();
          if (error) throw new Error(`cat ${c.nombre}: ${error.message}`);
          catIdByRpId.set(c.rp_id, up.id);
          totalCats += 1;
        }
        for (const p of productos) {
          const categoria_id = p.rp_categoria_id != null
            ? catIdByRpId.get(p.rp_categoria_id) ?? null
            : null;
          const { error } = await supabase.from("rp_productos").upsert(
            {
              sede_id: sede.id,
              rp_id: p.rp_id,
              categoria_id,
              nombre: p.nombre,
              descripcion: p.descripcion,
              precio: p.precio,
              imagen_url: p.imagen_url,
              disponible: p.disponible,
              modificadores: p.modificadores as never,
              almacen_id: p.almacen_id,
            },
            { onConflict: "sede_id,rp_id" },
          );
          if (error) throw new Error(`prod ${p.nombre}: ${error.message}`);
          totalProds += 1;
        }
      } catch (e) {
        errores.push(`${sede.nombre}: ${(e as Error).message}`);
      }
      // pausa entre sedes para no saturar la API
      if (i < targets.length - 1) await new Promise((r) => setTimeout(r, 150));
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
      ultimaSchemaCats: totalCatsSchema,
      ultimaSchemaProds: totalProdsSchema,
      errores,
    };
  });
