// Capa de adaptación: rp_productos (Supabase) -> tipo `Producto` que usa la UI.
import type { Producto, Categoria } from "@/types/kp";
import placeholder from "@/assets/hero-salchipapa.jpg";

export type RpProductoRow = {
  id: string;
  rp_id: number;
  categoria_id: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number | string;
  imagen_url: string | null;
  disponible: boolean;
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
    imagen: row.imagen_url || placeholder,
    pesoAprox: "",
    precioDesde: Number(row.precio) || 0,
    nivelHambre: 3,
    nivelPicante: 0,
    ocasiones: [],
    categorias: [catSlug],
    paraCompartir: false,
  };
}

export function buildCategorias(cats: RpCategoriaRow[]): Categoria[] {
  const base: Categoria[] = [{ id: "all", nombre: "Todas", filtro: "Todas" }];
  for (const c of cats) {
    base.push({ id: slugify(c.nombre), nombre: c.nombre, filtro: c.nombre });
  }
  return base;
}
