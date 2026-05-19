// Capa de adaptación: rp_productos (Supabase) -> tipo `Producto` que usa la UI.
import type { Producto, Categoria, ModificadorGrupo } from "@/types/kp";

export type RpProductoRow = {
  id: string;
  rp_id: number;
  categoria_id: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number | string;
  imagen_url: string | null;
  disponible: boolean;
  destacado?: boolean;
  es_nuevo?: boolean;
  es_mas_vendido?: boolean;
  es_recomendado?: boolean;
  etiqueta_custom?: string | null;
  modificadores?: unknown;
  modificadores_raw?: unknown;
};

export type RpCategoriaRow = {
  id: string;
  rp_id: number;
  nombre: string;
  orden: number;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

function coerceModificadores(raw: unknown): ModificadorGrupo[] {
  if (!Array.isArray(raw)) return [];
  const out: ModificadorGrupo[] = [];
  for (const g of raw) {
    if (!g || typeof g !== "object") continue;
    const gx = g as Record<string, unknown>;
    const opciones = Array.isArray(gx.opciones)
      ? (gx.opciones as Record<string, unknown>[])
          .filter((o) => o && typeof o === "object")
          .map((o) => ({
            id: Number(o.id) || 0,
            nombre: String(o.nombre ?? ""),
            precio: Number(o.precio) || 0,
          }))
      : [];
    out.push({
      id: Number(gx.id) || 0,
      nombre: String(gx.nombre ?? ""),
      min: Number(gx.min) || 0,
      max: Math.max(Number(gx.max) || 1, 1),
      opciones,
    });
  }
  return out;
}

export function rpProductoToProducto(
  row: RpProductoRow,
  categoriasById: Map<string, RpCategoriaRow>,
): Producto {
  const cat = row.categoria_id ? categoriasById.get(row.categoria_id) : undefined;
  const catSlug = cat ? slugify(cat.nombre) : "general";
  return {
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion ?? "",
    imagen: row.imagen_url ?? "",
    pesoAprox: "",
    precioDesde: Number(row.precio) || 0,
    nivelHambre: 3,
    nivelPicante: 0,
    ocasiones: [],
    categorias: [catSlug],
    paraCompartir: false,
    esNuevo: row.es_nuevo ?? false,
    esMasVendido: row.es_mas_vendido ?? false,
    esRecomendado: row.es_recomendado ?? false,
    destacado: row.destacado ?? false,
    etiquetaCustom: row.etiqueta_custom ?? null,
    modificadores: coerceModificadores(row.modificadores),
  };
}

export function buildCategorias(cats: RpCategoriaRow[]): Categoria[] {
  const base: Categoria[] = [{ id: "all", nombre: "Todas", filtro: "Todas" }];
  for (const c of cats) {
    base.push({ id: slugify(c.nombre), nombre: c.nombre, filtro: c.nombre });
  }
  return base;
}


