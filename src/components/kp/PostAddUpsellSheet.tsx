import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import { useUpsellGroups } from "@/components/kp/UpsellSection";
import { addItem } from "@/lib/cart";
import { track } from "@/lib/analytics";
import type { Producto } from "@/types/kp";
import { toast } from "sonner";

const cop = (n: number) => "$" + n.toLocaleString("es-CO");

/**
 * Hoja que aparece justo después de agregar un producto. Deja SIEMPRE claro
 * a qué producto se le están sumando adiciones/bebidas, y ofrece salir al
 * menú o avanzar al checkout.
 */
export function PostAddUpsellSheet({
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
        className="border-2 border-kp-ink bg-kp-cheese p-0 max-h-[88vh] flex flex-col sm:max-w-2xl sm:mx-auto"
      >
        <SheetTitle className="sr-only">Sumale algo a {producto?.nombre ?? "tu pedido"}</SheetTitle>
        <SheetDescription className="sr-only">
          Sugerencias para acompañar el producto que acabás de agregar.
        </SheetDescription>
        {producto && <Body producto={producto} onClose={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function Body({ producto, onClose }: { producto: Producto; onClose: () => void }) {
  const navigate = useNavigate();
  const excludeIds = useMemo(() => [producto.id], [producto.id]);
  const groups = useUpsellGroups({ excludeIds, maxPerGroup: 4 });
  const [dismissed, setDismissed] = useState<string[]>([]);

  const active = useMemo(
    () => groups.find((g) => !dismissed.includes(g.key)) ?? null,
    [groups, dismissed],
  );

  useEffect(() => {
    if (!active) return;
    track("upsell_shown", {
      producto_padre_id: producto.id,
      producto_padre_nombre: producto.nombre,
      grupo: active.key,
    });
  }, [active?.key, producto.id, producto.nombre]);

  const advance = (grupo: string) => {
    track("upsell_skipped", { producto_padre_id: producto.id, grupo });
    setDismissed((p) => [...p, grupo]);
  };

  return (
    <div className="flex flex-col min-h-0">
      {/* Cabecera: a QUÉ producto se le está sumando */}
      <div className="shrink-0 border-b-2 border-kp-ink bg-kp-yellow p-4 flex items-center gap-3">
        {producto.imagen ? (
          <img
            src={producto.imagen}
            alt=""
            className="w-14 h-14 shrink-0 object-cover border-2 border-kp-ink"
          />
        ) : (
          <div aria-hidden className="w-14 h-14 shrink-0 bg-kp-ink" />
        )}
        <div className="min-w-0">
          <p className="font-display uppercase text-[11px] opacity-70 leading-none">
            Sumaste al pedido
          </p>
          <p className="font-display uppercase text-xl leading-tight truncate">{producto.nombre}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {!active ? (
          <p className="font-display uppercase text-center py-6">
            Listo 👑 ¿Seguimos o vamos a pagar?
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display uppercase text-xl leading-none">{active.title}</h3>
                <p className="text-[11px] font-display uppercase opacity-70 mt-1">
                  Para tu {producto.nombre}
                </p>
              </div>
              <button
                type="button"
                onClick={() => advance(active.key)}
                className="shrink-0 min-h-11 px-3 border-2 border-kp-ink bg-kp-cheese font-display uppercase text-xs"
              >
                No, gracias
              </button>
            </div>

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
                    <div aria-hidden className="w-14 h-14 bg-kp-ink shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-display uppercase text-sm leading-tight line-clamp-2">
                      {p.nombre}
                    </p>
                    <p className="font-display text-base">{cop(p.precioDesde)}</p>
                  </div>
                  <BrutalButton
                    type="button"
                    variant="primary"
                    size="sm"
                    className="min-h-12 shrink-0"
                    onClick={() => {
                      addItem({
                        productoId: p.id,
                        nombre: p.nombre,
                        precio: p.precioDesde,
                        imagen: p.imagen,
                        paraProducto: producto.nombre,
                        silent: true,
                      });
                      track("upsell_added", {
                        producto_padre_id: producto.id,
                        producto_id: p.id,
                        producto_nombre: p.nombre,
                        cantidad: 1,
                        grupo: active.key,
                        precio_final: p.precioDesde,
                      });
                      toast.success(`${p.nombre} para tu ${producto.nombre}`);
                      setDismissed((prev) => [...prev, active.key]);
                    }}
                    aria-label={`Agregar ${p.nombre} para ${producto.nombre}`}
                  >
                    + Agregar
                  </BrutalButton>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t-2 border-kp-ink bg-kp-cheese p-4 grid grid-cols-2 gap-2">
        <BrutalButton type="button" variant="ghost" size="lg" block onClick={onClose}>
          Seguir en el menú
        </BrutalButton>
        <BrutalButton
          type="button"
          variant="fire"
          size="lg"
          block
          onClick={() => {
            track("upsell_to_checkout", { producto_padre_id: producto.id });
            onClose();
            navigate({ to: "/checkout" });
          }}
        >
          Ir al checkout
        </BrutalButton>
      </div>
    </div>
  );
}
