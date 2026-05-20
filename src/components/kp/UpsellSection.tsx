import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import { addItem, useCart } from "@/lib/cart";
import { useActiveSede } from "@/lib/active-sede";
import { rpProductoToProducto, type RpCategoriaRow, type RpProductoRow } from "@/lib/menu";
import type { Producto } from "@/types/kp";
import { toast } from "sonner";

const cop = (n: number) => "$" + n.toLocaleString("es-CO");

const UPSELL_CAT_KEYWORDS = ["bebida", "postre", "adicion", "acompan"];

/**
 * Lee el menú cacheado por la sede activa y devuelve hasta `max` productos
 * de categorías "complementarias" (bebidas, postres, adiciones, acompañantes),
 * excluyendo IDs ya presentes en el contexto actual.
 */
export function useUpsellSuggestions(opts: {
  excludeIds?: string[];
  max?: number;
} = {}): Producto[] {
  const { excludeIds = [], max = 3 } = opts;
  const qc = useQueryClient();
  const sede = useActiveSede();
  return useMemo(() => {
    if (!sede?.slug) return [];
    const data = qc.getQueryData<{ categorias: RpCategoriaRow[]; productos: RpProductoRow[] }>([
      "menu",
      sede.slug,
    ]);
    if (!data) return [];
    const catsById = new Map(data.categorias.map((c) => [c.id, c]));
    const matchIds = new Set(
      data.categorias
        .filter((c) => {
          const n = (c.nombre ?? "").toLowerCase();
          return UPSELL_CAT_KEYWORDS.some((k) => n.includes(k));
        })
        .map((c) => c.id),
    );
    const excluded = new Set(excludeIds);
    const list: Producto[] = [];
    for (const row of data.productos) {
      if (!row.categoria_id || !matchIds.has(row.categoria_id)) continue;
      if (excluded.has(row.id)) continue;
      list.push(rpProductoToProducto(row, catsById));
      if (list.length >= max) break;
    }
    return list;
  }, [qc, sede?.slug, excludeIds.join("|"), max]);
}

export function UpsellSection({
  excludeIds = [],
  title = "A tu corona le falta…",
  subtitle = "Súmale uno y coróname el pedido",
  tone = "purple",
}: {
  excludeIds?: string[];
  title?: string;
  subtitle?: string;
  tone?: "purple" | "yellow";
}) {
  const sugeridos = useUpsellSuggestions({ excludeIds });
  if (sugeridos.length === 0) return null;
  const bg = tone === "yellow" ? "bg-kp-yellow/40" : "bg-kp-purple/20";
  return (
    <div className={`border-2 border-kp-ink ${bg} p-3 space-y-2`}>
      <h3 className="font-display uppercase text-lg leading-none">{title}</h3>
      <p className="text-[11px] font-display uppercase opacity-70">{subtitle}</p>
      <ul className="space-y-2">
        {sugeridos.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-3 bg-kp-cheese border-2 border-kp-ink p-2"
          >
            {p.imagen ? (
              <img
                src={p.imagen}
                alt=""
                className="w-14 h-14 object-cover border-2 border-kp-ink shrink-0"
              />
            ) : (
              <div className="w-14 h-14 bg-kp-ink shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-display uppercase text-sm leading-tight truncate">
                {p.nombre}
              </p>
              <p className="font-display text-base">{cop(p.precioDesde)}</p>
            </div>
            <BrutalButton
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                addItem({
                  productoId: p.id,
                  nombre: p.nombre,
                  precio: p.precioDesde,
                  imagen: p.imagen,
                  silent: true,
                });
                toast.success(`${p.nombre} sumado`);
              }}
            >
              + Agregar
            </BrutalButton>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Helper para componentes que ya tienen el hook useCart cerca. */
export function useCartUpsellExcludeIds(): string[] {
  const { items } = useCart();
  return items.map((i) => i.productoId);
}
