import { createFileRoute, Link } from "@tanstack/react-router";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalButton, BrutalLink } from "@/components/ui-kp/BrutalButton";
import { useCart, clearCart } from "@/lib/cart";
import { useActiveSede } from "@/lib/active-sede";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — KINGPAPA" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

const cop = (n: number) => "$" + n.toLocaleString("es-CO");

function CheckoutPage() {
  const { items, count, subtotal } = useCart();
  const sede = useActiveSede();

  if (count === 0) {
    return (
      <section className="mx-auto max-w-3xl px-4 md:px-6 py-12">
        <BrutalCard tone="yellow" className="p-6 text-center">
          <h1 className="font-display text-4xl uppercase">Tu carrito está vacío</h1>
          <p className="mt-2 text-sm">Agrega algo antes de coronar el pago.</p>
          <div className="mt-5">
            <Link to="/menu">
              <BrutalButton variant="fire" size="lg">Ir al menú</BrutalButton>
            </Link>
          </div>
        </BrutalCard>
      </section>
    );
  }

  const waText = encodeURIComponent(
    `Hola KINGPAPA, quiero pedir desde ${sede?.label ?? "mi ubicación"}:\n` +
      items.map((i) => `• ${i.cantidad}× ${i.nombre} (${cop(i.precio * i.cantidad)})`).join("\n") +
      `\nTotal: ${cop(subtotal)}`,
  );
  const waUrl = `https://wa.me/573172455336?text=${waText}`;

  return (
    <section className="mx-auto max-w-3xl px-4 md:px-6 py-10 space-y-5">
      <BrutalBadge tone="black">Checkout</BrutalBadge>
      <h1 className="font-display text-5xl uppercase leading-none">Confirma tu corona</h1>

      <BrutalCard tone="cheese" className="p-5">
        <p className="text-xs font-display uppercase">Sede</p>
        <p className="mt-1">{sede?.label ?? "Sin ubicación"}</p>
        <p className="text-xs mt-1">
          Modo: <strong>{sede?.enCobertura ? "Delivery" : "Recoger en sede"}</strong>
        </p>
      </BrutalCard>

      <BrutalCard tone="cheese" className="p-5">
        <ul className="divide-y-2 divide-kp-ink/20">
          {items.map((i) => (
            <li key={i.key} className="py-3 flex justify-between gap-3">
              <span className="font-display uppercase text-sm">
                {i.cantidad}× {i.nombre}
              </span>
              <span className="font-display">{cop(i.precio * i.cantidad)}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between mt-3 pt-3 border-t-2 border-kp-ink">
          <span className="font-display uppercase">Total</span>
          <span className="font-display text-3xl">{cop(subtotal)}</span>
        </div>
      </BrutalCard>

      <BrutalCard tone="yellow" className="p-5">
        <p className="font-display uppercase text-sm">Pasarela próximamente</p>
        <p className="text-xs mt-1">
          Mientras tanto, confirmamos tu pedido por WhatsApp y nuestro equipo lo procesa.
        </p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BrutalLink href={waUrl} external variant="fire" size="lg" block>
            Confirmar por WhatsApp
          </BrutalLink>
          <BrutalButton variant="ghost" size="lg" block onClick={clearCart}>
            Vaciar pedido
          </BrutalButton>
        </div>
      </BrutalCard>
    </section>
  );
}
