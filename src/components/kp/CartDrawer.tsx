import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import { useCart, incItem, decItem, removeItem, onOpenCart, clearCart } from "@/lib/cart";
import { useActiveSede } from "@/lib/active-sede";

const cop = (n: number) => "$" + n.toLocaleString("es-CO");

export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const { items, count, subtotal } = useCart();
  const sede = useActiveSede();
  const navigate = useNavigate();

  useEffect(() => onOpenCart(() => setOpen(true)), []);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent className="border-t-4 border-kp-ink bg-kp-cheese">
        <DrawerTitle className="sr-only">Tu carrito</DrawerTitle>
        <DrawerDescription className="sr-only">
          Resumen de productos antes de pagar.
        </DrawerDescription>
        <div className="mx-auto w-full max-w-2xl p-4 md:p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-3xl uppercase leading-none">Tu pedido</h2>
              {sede && (
                <p className="text-xs mt-1">
                  📍 {sede.label} · <strong>{sede.enCobertura ? "Delivery" : "Recoger"}</strong>
                </p>
              )}
            </div>
            {items.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs font-display uppercase underline decoration-kp-red decoration-2 underline-offset-4"
              >
                Vaciar
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="py-10 text-center">
              <p className="font-display uppercase text-xl">El carrito está vacío</p>
              <p className="text-sm mt-1">Agrega una corona del menú.</p>
            </div>
          ) : (
            <>
              <ul className="divide-y-2 divide-kp-ink/20 max-h-[50vh] overflow-y-auto">
                {items.map((i) => (
                  <li key={i.key} className="py-3 flex items-center gap-3">
                    {i.imagen && (
                      <img
                        src={i.imagen}
                        alt=""
                        className="w-14 h-14 object-cover border-2 border-kp-ink"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-display uppercase text-sm leading-tight">{i.nombre}</p>
                      <p className="text-xs">{cop(i.precio)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => decItem(i.key)}
                        className="w-7 h-7 border-2 border-kp-ink bg-kp-cheese font-display"
                        aria-label="Restar"
                      >−</button>
                      <span className="w-6 text-center font-display">{i.cantidad}</span>
                      <button
                        onClick={() => incItem(i.key)}
                        className="w-7 h-7 border-2 border-kp-ink bg-kp-yellow font-display"
                        aria-label="Sumar"
                      >+</button>
                      <button
                        onClick={() => removeItem(i.key)}
                        className="ml-2 text-xs underline"
                        aria-label="Eliminar"
                      >✕</button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between mt-4 pt-3 border-t-2 border-kp-ink">
                <span className="font-display uppercase">Subtotal</span>
                <span className="font-display text-3xl">{cop(subtotal)}</span>
              </div>

              {/* Gamificación: puntos del Reino */}
              <div className="mt-3 border-2 border-kp-ink bg-kp-yellow px-3 py-2 font-display uppercase text-xs flex items-center justify-between gap-2">
                <span>👑 Ganarás</span>
                <span className="text-lg">
                  +{Math.floor(subtotal / 1000) * 10} pts
                </span>
              </div>

              {/* FOMO: envío gratis (umbral provisional $40.000) */}
              {subtotal > 0 && subtotal < FREE_SHIPPING_THRESHOLD && (
                <div className="mt-2 border-2 border-dashed border-kp-ink/60 px-3 py-2 text-xs font-display uppercase">
                  Te faltan <strong>{cop(FREE_SHIPPING_THRESHOLD - subtotal)}</strong> para envío gratis
                </div>
              )}

              <BrutalButton
                variant="fire"
                size="lg"
                block
                className="mt-4"
                onClick={() => {
                  setOpen(false);
                  navigate({ to: "/checkout" }).catch(() => {
                    // Si la ruta no existe aún, abre WhatsApp como fallback
                    if (typeof window !== "undefined") {
                      window.location.href = "/checkout";
                    }
                  });
                }}
              >
                Ir a pagar · {count} ítem{count === 1 ? "" : "s"}
              </BrutalButton>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
