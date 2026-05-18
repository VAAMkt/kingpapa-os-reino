import { useCart, openCart } from "@/lib/cart";

const cop = (n: number) => "$" + n.toLocaleString("es-CO");

export function CartPill() {
  const { count, subtotal } = useCart();
  if (count === 0) return null;
  return (
    <button
      onClick={openCart}
      className="fixed bottom-4 right-4 z-40 bg-kp-red text-kp-cheese font-display uppercase border-2 border-kp-ink shadow-brutal px-4 py-3 hover:-translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center gap-2"
      aria-label="Abrir carrito"
    >
      <span>🛒 {count}</span>
      <span className="text-xs opacity-80">·</span>
      <span>{cop(subtotal)}</span>
    </button>
  );
}
