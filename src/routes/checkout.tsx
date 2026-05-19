import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { BrutalCard, BrutalBadge, BrutalInput } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import { useCart, clearCart, setOrderType, type OrderType } from "@/lib/cart";
import { useActiveSede } from "@/lib/active-sede";
import { openOrderIntent } from "@/components/kp/OrderIntentDialog";
import { toast } from "sonner";

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
type PagoMetodo = "efectivo" | "datafono" | "online";

function newOrderId() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return "KP-" + s;
}

function CheckoutPage() {
  const { items, count, subtotal, orderType } = useCart();
  const sede = useActiveSede();
  const navigate = useNavigate();

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState(sede?.direccionTexto ?? "");
  const [detalles, setDetalles] = useState(sede?.detalles ?? "");
  const [notas, setNotas] = useState("");
  const [pago, setPago] = useState<PagoMetodo>("efectivo");
  const [enviando, setEnviando] = useState(false);

  const tipo: OrderType = orderType ?? (sede?.enCobertura ? "delivery" : "pickup");
  const esRecoger = tipo === "pickup";

  const total = useMemo(() => subtotal, [subtotal]);

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

  function validar(): string | null {
    if (!nombre.trim()) return "Nombre obligatorio";
    if (!/^\d{7,}$/.test(telefono.replace(/\D/g, ""))) return "Teléfono inválido";
    if (!esRecoger && !direccion.trim()) return "Dirección obligatoria para domicilio";
    return null;
  }

  function confirmar(e: React.FormEvent) {
    e.preventDefault();
    const err = validar();
    if (err) {
      toast.error(err);
      return;
    }
    setEnviando(true);
    const orderId = newOrderId();
    const payload = {
      orderId,
      createdAt: Date.now(),
      tipo,
      pago,
      cliente: { nombre, telefono, direccion: esRecoger ? null : direccion, detalles },
      notas,
      sede: sede
        ? { id: sede.sedeId, slug: sede.slug, label: sede.label }
        : null,
      items,
      subtotal,
      total,
    };
    try {
      localStorage.setItem("kp.lastOrder", JSON.stringify(payload));
    } catch {
      /* ignore */
    }
    clearCart();
    navigate({ to: "/gracias", search: { order_id: orderId } });
  }

  return (
    <section className="mx-auto max-w-6xl px-4 md:px-6 py-8 md:py-10 space-y-5">
      <BrutalBadge tone="black">Checkout</BrutalBadge>
      <h1 className="font-display text-4xl md:text-5xl uppercase leading-none">
        Confirma tu corona
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        {/* FORM */}
        <form onSubmit={confirmar} className="space-y-4">
          {/* Tipo de pedido */}
          <BrutalCard tone="cheese" className="p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <BrutalBadge tone={esRecoger ? "red" : "lime"}>
                  {esRecoger ? "🏃 Recoger en sede" : "🛵 Domicilio"}
                </BrutalBadge>
                <p className="mt-2 font-display text-base">{sede?.label ?? "Sin sede"}</p>
              </div>
              <div className="flex gap-2">
                <BrutalButton
                  type="button"
                  variant={tipo === "delivery" ? "fire" : "ghost"}
                  size="sm"
                  onClick={() => setOrderType("delivery")}
                  disabled={sede ? !sede.enCobertura : true}
                  title={sede && !sede.enCobertura ? "Tu dirección está fuera de cobertura" : undefined}
                >
                  🛵 Domicilio
                </BrutalButton>
                <BrutalButton
                  type="button"
                  variant={tipo === "pickup" ? "dark" : "ghost"}
                  size="sm"
                  onClick={() => setOrderType("pickup")}
                >
                  🏃 Recoger
                </BrutalButton>
                <BrutalButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={openOrderIntent}
                >
                  Cambiar
                </BrutalButton>
              </div>
            </div>
          </BrutalCard>

          {/* Datos cliente */}
          <BrutalCard tone="cheese" className="p-4 space-y-3">
            <h2 className="font-display uppercase text-xl">Tus datos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <BrutalInput
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre"
                autoComplete="name"
              />
              <BrutalInput
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Teléfono / WhatsApp"
                inputMode="tel"
                autoComplete="tel"
              />
            </div>
            {!esRecoger && (
              <>
                <BrutalInput
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Dirección de entrega"
                  autoComplete="street-address"
                />
                <BrutalInput
                  value={detalles}
                  onChange={(e) => setDetalles(e.target.value)}
                  placeholder="Detalles (Apto, torre, puntos de referencia)"
                />
              </>
            )}
            <BrutalInput
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas para la cocina (opcional)"
            />
          </BrutalCard>

          {/* Pago */}
          <BrutalCard tone="cheese" className="p-4 space-y-3">
            <h2 className="font-display uppercase text-xl">Método de pago</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {([
                { id: "efectivo", label: "💵 Efectivo" },
                { id: "datafono", label: "💳 Datáfono al recibir" },
                { id: "online", label: "🌐 Pago en línea" },
              ] as { id: PagoMetodo; label: string }[]).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPago(opt.id)}
                  className={`px-3 py-3 border-2 font-display uppercase text-sm ${
                    pago === opt.id
                      ? "bg-kp-ink text-kp-cheese border-kp-ink"
                      : "bg-kp-cheese text-kp-ink border-kp-ink/40 hover:border-kp-ink"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {pago === "online" && (
              <p className="text-xs opacity-70">
                Pasarela online próximamente — el equipo confirmará por WhatsApp.
              </p>
            )}
          </BrutalCard>

          <BrutalButton type="submit" variant="fire" size="lg" block disabled={enviando}>
            {enviando ? "Coronando…" : `Confirmar pedido · ${cop(total)}`}
          </BrutalButton>
        </form>

        {/* RESUMEN */}
        <aside className="lg:sticky lg:top-4 self-start space-y-3">
          <BrutalCard tone="yellow" className="p-4">
            <h2 className="font-display uppercase text-xl mb-3">Tu pedido</h2>
            <ul className="divide-y-2 divide-kp-ink/20">
              {items.map((i) => (
                <li key={i.key} className="py-2">
                  <div className="flex justify-between gap-3">
                    <span className="font-display uppercase text-sm">
                      {i.cantidad}× {i.nombre}
                    </span>
                    <span className="font-display text-sm">{cop(i.precio * i.cantidad)}</span>
                  </div>
                  {i.modificadores && i.modificadores.length > 0 && (
                    <ul className="text-[11px] opacity-70 mt-1 pl-3 list-disc">
                      {i.modificadores.map((m) => (
                        <li key={`${m.grupoId}-${m.opcionId}`}>
                          {m.nombre}
                          {m.precio > 0 && ` (+${cop(m.precio)})`}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between mt-3 pt-3 border-t-2 border-kp-ink">
              <span className="font-display uppercase">Total</span>
              <span className="font-display text-2xl">{cop(total)}</span>
            </div>
          </BrutalCard>
        </aside>
      </div>
    </section>
  );
}
