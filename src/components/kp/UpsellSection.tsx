import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import { addItem, useCart } from "@/lib/cart";
import { useActiveSede } from "@/lib/active-sede";
import { rpProductoToProducto, type RpCategoriaRow, type RpProductoRow } from "@/lib/menu";
import type { Producto } from "@/types/kp";
import { toast } from "sonner";

const cop = (n: number) => "$" + n.toLocaleString("es-CO");

type UpsellGroupKey = "adicion" | "bebida" | "postre" | "acompan";

const GROUP_ORDER: { key: UpsellGroupKey; keywords: string[]; title: string; subtitle: string }[] = [
  {
    key: "adicion",
    keywords: ["adicion"],
    title: "Súmale una adición",
    subtitle: "Tocino, queso extra, salsas… arma tu corona.",
  },
  {
    key: "bebida",
    keywords: ["bebida"],
    title: "¿Lo acompañas con bebida?",
    subtitle: "Una fría siempre cae bien 👑",
  },
  {
    key: "postre",
    keywords: ["postre"],
    title: "Cierra con un postre",
    subtitle: "El final perfecto del reinado.",
  },
  {
    key: "acompan",
    keywords: ["acompan"],
    title: "Pídele un acompañamiento",
    subtitle: "Papas, aros, lo que se te antoje.",
  },
];

export type UpsellGroup = {
  key: UpsellGroupKey;
  title: string;
  subtitle: string;
  productos: Producto[];
};

/**
 * Devuelve los grupos de upsell disponibles para la sede activa, en orden
 * de prioridad fijo (adiciones → bebidas → postres → acompañamientos).
 * Cada grupo trae hasta `maxPerGroup` productos y excluye los `excludeIds`.
 */
export function useUpsellGroups(opts: {
  excludeIds?: string[];
  maxPerGroup?: number;
} = {}): UpsellGroup[] {
  const { excludeIds = [], maxPerGroup = 3 } = opts;
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
    const excluded = new Set(excludeIds);

    return GROUP_ORDER.map((grp) => {
      const catIds = new Set(
        data.categorias
          .filter((c) => {
            const n = (c.nombre ?? "").toLowerCase();
            return grp.keywords.some((k) => n.includes(k));
          })
          .map((c) => c.id),
      );
      const productos: Producto[] = [];
      for (const row of data.productos) {
        if (!row.categoria_id || !catIds.has(row.categoria_id)) continue;
        if (excluded.has(row.id)) continue;
        productos.push(rpProductoToProducto(row, catsById));
        if (productos.length >= maxPerGroup) break;
      }
      return { key: grp.key, title: grp.title, subtitle: grp.subtitle, productos };
    }).filter((g) => g.productos.length > 0);
  }, [qc, sede?.slug, excludeIds.join("|"), maxPerGroup]);
}

export function UpsellSection({
  excludeIds = [],
  tone = "purple",
}: {
  excludeIds?: string[];
  title?: string; // legacy — ignorado, ahora el título viene del grupo
  subtitle?: string; // legacy — ignorado
  tone?: "purple" | "yellow";
}) {
  const groups = useUpsellGroups({ excludeIds });
  const [dismissed, setDismissed] = useState<Set<UpsellGroupKey>>(new Set());

  const active = useMemo(
    () => groups.find((g) => !dismissed.has(g.key)) ?? null,
    [groups, dismissed],
  );

  if (!active) return null;

  const bg = tone === "yellow" ? "bg-kp-yellow/40" : "bg-kp-purple/20";

  const advance = () => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(active.key);
      return next;
    });
  };

  return (
    <div className={`relative border-2 border-kp-ink ${bg} p-3 space-y-2`}>
      <button
        type="button"
        onClick={advance}
        aria-label="Saltar esta sugerencia"
        className="absolute top-1.5 right-1.5 w-7 h-7 border-2 border-kp-ink bg-kp-cheese font-display text-sm leading-none flex items-center justify-center hover:bg-kp-yellow"
      >
        ✕
      </button>
      <h3 className="font-display uppercase text-lg leading-none pr-8">{active.title}</h3>
      <p className="text-[11px] font-display uppercase opacity-70">{active.subtitle}</p>
      <ul className="space-y-2">
        {active.productos.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-3 bg-kp-cheese border-2 border-kp-ink p-2"
          >
            {p.imagen ? (
              <img
                src={p.imagen}
                alt=""
                loading="lazy"
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
                // auto-avanza al siguiente grupo (bebidas tras adiciones, etc.)
                advance();
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
