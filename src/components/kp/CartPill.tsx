import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useCart, openCart } from "@/lib/cart";
import { track } from "@/lib/analytics";

const cop = (n: number) => "$" + n.toLocaleString("es-CO");

/** Rutas donde ya existe un CTA inferior propio o no aplica comprar. */
function ocultoEn(pathname: string): boolean {
  return (
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/gracias") ||
    pathname.startsWith("/admin")
  );
}

export function CartPill() {
  const { count, subtotal } = useCart();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [pulse, setPulse] = useState(false);
  const prevCount = useRef(count);

  useEffect(() => {
    if (count > prevCount.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 350);
      prevCount.current = count;
      return () => clearTimeout(t);
    }
    prevCount.current = count;
  }, [count]);

  if (count === 0 || ocultoEn(pathname)) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 px-3 pt-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:px-0 sm:pt-0 pointer-events-none"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
    >
      <button
        onClick={() => {
          track("cart_opened", { items: count, subtotal });
          openCart();
        }}
        className={`pointer-events-auto w-full sm:w-auto min-h-14 bg-kp-red text-kp-cheese font-display uppercase border-2 border-kp-ink shadow-brutal px-4 py-3 flex items-center justify-between gap-3 transition-transform motion-reduce:transition-none active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kp-ink ${
          pulse ? "sm:scale-[1.03] -translate-y-[2px]" : ""
        }`}
        aria-label={`Ver pedido, ${count} productos, subtotal ${cop(subtotal)}`}
      >
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-grid place-items-center min-w-7 h-7 px-1 bg-kp-cheese text-kp-ink border-2 border-kp-ink"
          >
            {count}
          </span>
          <span>Ver pedido</span>
        </span>
        <span>{cop(subtotal)}</span>
      </button>
    </div>
  );
}
