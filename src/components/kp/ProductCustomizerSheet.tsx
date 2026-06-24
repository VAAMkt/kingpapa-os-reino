import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import { addItem, type CartModifier } from "@/lib/cart";
import { useUpsellGroups } from "@/components/kp/UpsellSection";
import type { Producto } from "@/types/kp";
import { toast } from "sonner";

const cop = (n: number) => "$" + n.toLocaleString("es-CO");

const GROUP_NAME_MAP: Record<string, string> = {
  "salsas": "Elige tu salsa",
  "salsa": "Elige tu salsa",
  "extras": "Agrégale más pecado",
  "adiciones": "Agrégale más pecado",
  "adición": "Agrégale más pecado",
  "bebidas": "Combínalo con bebida",
  "bebida": "Combínalo con bebida",
  "complementos": "Combínalo con bebida",
  "acompañamientos": "Pídele un acompañamiento",
  "acompañamiento": "Pídele un acompañamiento",
  "postres": "Cierra con un postre",
  "postre": "Cierra con un postre",
};
function prettyGroupName(raw: string): string {
  return GROUP_NAME_MAP[raw.trim().toLowerCase()] ?? raw;
}

export function ProductCustomizerSheet({
  producto,
  open,
  onOpenChange,
}: {
  producto: Producto | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="border-2 border-kp-ink bg-kp-cheese p-0 max-h-[92vh] h-[92vh] flex flex-col sm:max-w-2xl sm:mx-auto"
      >
        <SheetTitle className="sr-only">
          Personaliza {producto?.nombre ?? "tu corona"}
        </SheetTitle>
        <SheetDescription className="sr-only">
          Elige adiciones y cantidad antes de agregar al carrito.
        </SheetDescription>
        {producto && (
          <CustomizerBody producto={producto} onDone={() => onOpenChange(false)} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function CustomizerBody({
  producto,
  onDone,
}: {
  producto: Producto;
  onDone: () => void;
}) {
  const grupos = producto.modificadores ?? [];
  const [sel, setSel] = useState<Record<number, Set<number>>>({});
  const [cantidad, setCantidad] = useState(1);

  function toggle(grupoId: number, opcionId: number, max: number) {
    setSel((prev) => {
      const cur = new Set(prev[grupoId] ?? []);
      if (cur.has(opcionId)) {
        cur.delete(opcionId);
      } else {
        if (max === 1) {
          cur.clear();
        } else if (cur.size >= max) {
          toast.message(`Máximo ${max} en este grupo`);
          return prev;
        }
        cur.add(opcionId);
      }
      return { ...prev, [grupoId]: cur };
    });
  }

  const { extra, mods, valido, faltantes } = useMemo(() => {
    let extra = 0;
    const mods: CartModifier[] = [];
    const faltantes: string[] = [];
    let valido = true;
    for (const g of grupos) {
      const ids = sel[g.id] ?? new Set<number>();
      if (ids.size < g.min) {
        valido = false;
        faltantes.push(`${prettyGroupName(g.nombre)}: elige ${g.min}`);
      }
      for (const o of g.opciones) {
        if (ids.has(o.id)) {
          extra += o.precio;
          mods.push({
            grupoId: g.id,
            opcionId: o.id,
            nombre: o.nombre,
            precio: o.precio,
          });
        }
      }
    }
    return { extra, mods, valido, faltantes };
  }, [grupos, sel]);

  const unit = producto.precioDesde + extra;
  const total = unit * cantidad;

  // Upsell de bebida: sólo si el producto no incluye bebida ni es una bebida.
  const incluyeBebida = grupos.some((g) => /bebida/i.test(g.nombre));
  const esBebida = (producto.categorias ?? []).some((c) => /bebida/i.test(c));
  const upsellGroups = useUpsellGroups({ excludeIds: [producto.id], maxPerGroup: 3 });
  const bebidasSugeridas = useMemo(() => {
    if (incluyeBebida || esBebida) return [];
    const g = upsellGroups.find((x) => x.key === "bebida");
    return g?.productos ?? [];
  }, [incluyeBebida, esBebida, upsellGroups]);

  function agregar() {
    if (!valido) {
      toast.error(faltantes[0] ?? "Faltan opciones");
      return;
    }
    addItem({
      productoId: producto.id,
      nombre: producto.nombre,
      precio: unit,
      imagen: producto.imagen,
      modificadores: mods,
      cantidad,
    });
    toast.success(`${producto.nombre} al carrito`);
    onDone();
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Hero ≥40% altura */}
      <div className="relative shrink-0 h-[42vh] min-h-[260px] bg-kp-ink">
        {producto.imagen && (
          <img
            src={producto.imagen}
            alt={producto.nombre}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Scroll area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
        <div>
          <BrutalBadge tone="yellow">Personaliza</BrutalBadge>
          <h2 className="font-display text-3xl uppercase font-bold leading-none mt-2">
            {producto.nombre}
          </h2>
          {producto.descripcion && (
            <p className="text-sm mt-2 opacity-80">{producto.descripcion}</p>
          )}
          <p className="font-display text-2xl mt-2">{cop(producto.precioDesde)}</p>
        </div>

        {grupos.length === 0 && (
          <p className="text-sm opacity-70 border-2 border-dashed border-kp-ink/30 p-3">
            Este producto no tiene adiciones — confirma cantidad y agrégalo.
          </p>
        )}

        {grupos.map((g) => {
          const isRadio = g.max === 1;
          const selected = sel[g.id] ?? new Set<number>();
          const obligatorio = g.min > 0;
          const incompleto = obligatorio && selected.size < g.min;
          const borderCls = incompleto ? "border-kp-red/70" : "border-kp-ink";
          return (
            <div
              key={g.id}
              className={`border-2 ${borderCls} bg-kp-yellow/40 p-3 space-y-2`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display uppercase text-lg leading-none">
                  {prettyGroupName(g.nombre)}
                </h3>
                <span
                  className={`text-[10px] font-display uppercase px-1.5 py-0.5 border-2 ${
                    obligatorio
                      ? incompleto
                        ? "border-kp-red/70 text-kp-red bg-kp-cheese"
                        : "border-kp-ink bg-kp-ink text-kp-cheese"
                      : "border-kp-ink/40 bg-kp-cheese opacity-70"
                  }`}
                >
                  {obligatorio ? "Obligatorio" : "Opcional"} ·{" "}
                  {isRadio ? "Elige 1" : `Hasta ${g.max}`}
                </span>
              </div>
              <ul className="space-y-1">
                {g.opciones.map((o) => {
                  const checked = selected.has(o.id);
                  return (
                    <li key={o.id}>
                      <label
                        className={`flex items-center gap-3 cursor-pointer px-2 py-2 border-2 ${
                          checked
                            ? "bg-kp-ink text-kp-cheese border-kp-ink"
                            : "bg-kp-cheese text-kp-ink border-kp-ink/30 hover:border-kp-ink"
                        }`}
                      >
                        <input
                          type={isRadio ? "radio" : "checkbox"}
                          name={`grp-${g.id}`}
                          checked={checked}
                          onChange={() => toggle(g.id, o.id, g.max)}
                          className="accent-kp-yellow w-4 h-4"
                        />
                        <span className="flex-1 text-sm">{o.nombre}</span>
                        {o.precio > 0 && (
                          <span className="font-display text-sm">
                            + {cop(o.precio)}
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {bebidasSugeridas.length > 0 && (
          <div className="border-2 border-kp-ink bg-kp-purple/20 p-3 space-y-2">
            <h3 className="font-display uppercase text-lg leading-none">
              ¿Le sumás una bebida?
            </h3>
            <p className="text-[11px] font-display uppercase opacity-70">
              Una fría siempre cae bien 👑
            </p>
            <div className="flex gap-2 overflow-x-auto snap-x scrollbar-none -mx-1 px-1">
              {bebidasSugeridas.map((b) => (
                <div
                  key={b.id}
                  className="snap-start shrink-0 w-[150px] border-2 border-kp-ink bg-kp-cheese p-2 flex flex-col gap-1"
                >
                  {b.imagen ? (
                    <img
                      src={b.imagen}
                      alt=""
                      className="w-full aspect-square object-cover border-2 border-kp-ink"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-kp-ink" />
                  )}
                  <p className="font-display uppercase text-xs leading-tight line-clamp-2 min-h-[28px]">
                    {b.nombre}
                  </p>
                  <p className="font-display text-sm">{cop(b.precioDesde)}</p>
                  <BrutalButton
                    type="button"
                    variant="primary"
                    size="sm"
                    block
                    onClick={() => {
                      addItem({
                        productoId: b.id,
                        nombre: b.nombre,
                        precio: b.precioDesde,
                        imagen: b.imagen,
                        silent: true,
                      });
                      toast.success(`${b.nombre} sumada`);
                    }}
                  >
                    + Agregar
                  </BrutalButton>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer sticky siempre visible */}
      <div className="shrink-0 border-t-2 border-kp-ink bg-kp-cheese p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCantidad((c) => Math.max(1, c - 1))}
              className="w-11 h-11 border-2 border-kp-ink bg-kp-yellow font-display text-xl"
              aria-label="Restar"
            >
              −
            </button>
            <span className="font-display text-2xl w-10 text-center">{cantidad}</span>
            <button
              type="button"
              onClick={() => setCantidad((c) => Math.min(20, c + 1))}
              className="w-11 h-11 border-2 border-kp-ink bg-kp-yellow font-display text-xl"
              aria-label="Sumar"
            >
              +
            </button>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-display uppercase opacity-70">Total</div>
            <div className="font-display text-2xl leading-none">{cop(total)}</div>
          </div>
        </div>
        <BrutalButton variant="fire" size="lg" block onClick={agregar} disabled={!valido}>
          {valido ? `Agregar · ${cop(total)}` : faltantes[0] ?? "Completa las opciones"}
        </BrutalButton>
      </div>
    </div>
  );
}
