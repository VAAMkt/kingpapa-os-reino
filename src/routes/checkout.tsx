import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BrutalCard, BrutalBadge, BrutalInput } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import { useCart, clearCart, setOrderType, incItem, decItem, removeItem, type OrderType } from "@/lib/cart";
import { useActiveSede, setActiveSede, recomputeCoverage } from "@/lib/active-sede";
import { listPublicSedes } from "@/lib/sedes";
import { openOrderIntent } from "@/components/kp/OrderIntentDialog";
import { submitCheckoutOrder, precheckStock } from "@/lib/orders.functions";
import { toast } from "sonner";
import { track } from "@/lib/analytics";

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
const PAYMENTS_ENABLED = import.meta.env.VITE_PAYMENTS_ENABLED === "true";
type PagoMetodo = "efectivo" | "datafono" | "online";
type FieldErrors = Partial<Record<"nombre" | "telefono" | "direccion", string>>;

const FORM_KEY = "kp.checkoutForm";
type PersistedForm = Partial<{
  nombre: string;
  telefono: string;
  direccion: string;
  detalles: string;
  notas: string;
  pago: PagoMetodo;
}>;

function loadPersistedForm(): PersistedForm {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FORM_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function CheckoutPage() {
  const submitOrder = useServerFn(submitCheckoutOrder);
  const precheckFn = useServerFn(precheckStock);
  const { items, count, subtotal, orderType } = useCart();
  const sede = useActiveSede();
  const navigate = useNavigate();

  const persisted = useMemo(() => loadPersistedForm(), []);

  const [nombre, setNombre] = useState(persisted.nombre ?? "");
  const [telefono, setTelefono] = useState(persisted.telefono ?? "");
  const [direccion, setDireccion] = useState(persisted.direccion ?? sede?.direccionTexto ?? "");
  const [detalles, setDetalles] = useState(persisted.detalles ?? sede?.detalles ?? "");
  const [notas, setNotas] = useState(persisted.notas ?? "");
  const [pago, setPago] = useState<PagoMetodo>(() => {
    const p = persisted.pago ?? "efectivo";
    return p === "online" && !PAYMENTS_ENABLED ? "efectivo" : p;
  });
  const [enviando, setEnviando] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [resumenAbierto, setResumenAbierto] = useState(false);

  // checkout_started: dispara una vez al montar si hay carrito.
  useEffect(() => {
    if (count > 0) track("checkout_started", { items_count: count, subtotal });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Persiste el formulario en localStorage para que recargar la página
  // o editar por error no borre lo que el usuario ya escribió.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        FORM_KEY,
        JSON.stringify({ nombre, telefono, direccion, detalles, notas, pago }),
      );
    } catch {
      /* ignore quota errors */
    }
  }, [nombre, telefono, direccion, detalles, notas, pago]);

  // Si la sede activa trae una dirección nueva (p.ej. el usuario reabrió
  // el LocationGate y eligió otra) y el campo sigue vacío, la adoptamos.
  useEffect(() => {
    if (sede?.direccionTexto && !direccion) setDireccion(sede.direccionTexto);
    if (sede?.detalles && !detalles) setDetalles(sede.detalles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede?.direccionTexto, sede?.detalles]);

  // Sincroniza la edición manual del checkout hacia la sede activa para que
  // el header y el resumen reflejen el texto más reciente.
  useEffect(() => {
    if (!sede) return;
    const sameDir = (sede.direccionTexto ?? "") === direccion;
    const sameDet = (sede.detalles ?? "") === (detalles || "");
    if (sameDir && sameDet) return;
    setActiveSede({
      ...sede,
      direccionTexto: direccion || sede.direccionTexto,
      detalles: detalles || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direccion, detalles]);

  const tipo: OrderType = orderType ?? (sede?.enCobertura ? "delivery" : "pickup");
  const esRecoger = tipo === "pickup";

  // Auto-rehidratación de cobertura: si el cache tiene enCobertura=false pero
  // la dirección sí cae dentro del radio de alguna sede, lo arreglamos solos
  // sin obligar al usuario a reabrir el LocationGate.
  const sedesQ = useQuery({
    queryKey: ["sedes", "public"],
    queryFn: listPublicSedes,
    staleTime: 60_000,
  });
  useEffect(() => {
    if (!sede || !sedesQ.data) return;
    const { active: updated, changed } = recomputeCoverage(sede, sedesQ.data);
    if (changed && updated) {
      setActiveSede(updated);
      if (updated.enCobertura && tipo === "pickup") {
        setOrderType("delivery");
        toast.success("¡Buenas noticias! Tu dirección sí tiene cobertura 🛵");
      }
    }
  }, [sede, sedesQ.data, tipo]);

  const total = useMemo(() => subtotal, [subtotal]);
  const puntos = Math.floor(subtotal / 1000) * 10;

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

  function validar(): FieldErrors {
    const errs: FieldErrors = {};
    if (!nombre.trim()) errs.nombre = "¿Cómo te llamas?";
    if (!/^\d{7,}$/.test(telefono.replace(/\D/g, ""))) errs.telefono = "Teléfono inválido";
    if (!esRecoger && !direccion.trim()) errs.direccion = "Dirección obligatoria";
    return errs;
  }

  function buildOrderPayload() {
    return {
      sedeId: sede!.sedeId!,
      tipo,
      pago,
      cliente: {
        nombre,
        telefono,
        direccion: esRecoger ? null : direccion,
        detalles: detalles || null,
      },
      notas: notas || null,
      items: items.map((i) => ({
        productoId: i.productoId,
        cantidad: i.cantidad,
        modificadores: (i.modificadores ?? []).map((m) => ({
          grupoId: m.grupoId,
          opcionId: m.opcionId,
        })),
      })),
    };
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    const errs = validar();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const first = Object.values(errs)[0];
      if (first) toast.error(first);
      return;
    }
    if (!sede?.sedeId) {
      toast.error("Selecciona una sede antes de continuar");
      return;
    }
    setEnviando(true);
    track("order_submitted", {
      items_count: count,
      subtotal,
      sede_id: sede.sedeId,
      metodo_pago: pago,
    });
    try {
      // P2 — Pre-check de stock con fallo suave (timeout 3s server-side).
      // Si el POS responde a tiempo y marca algo como agotado, bloqueamos.
      // Si no responde, dejamos pasar la compra (no podemos perder ventas
      // por una caída de su API).
      try {
        const pre = await precheckFn({
          data: {
            sedeId: sede.sedeId,
            items: items.map((i) => ({
              productoId: i.productoId,
              cantidad: i.cantidad,
            })),
          },
        });
        if (!pre.soft && pre.agotados && pre.agotados.length > 0) {
          const nombres = (pre.agotadosNombres ?? []).join(", ") || "algunos productos";
          track("order_error", { error_type: "stock", mensaje: nombres });
          toast.error(`Sin stock ahora mismo: ${nombres}. Ajusta tu pedido.`);
          setEnviando(false);
          return;
        }
      } catch (preErr) {
        // Fallo suave: continuamos pero registramos.
        track("order_error", {
          error_type: "precheck",
          mensaje: preErr instanceof Error ? preErr.message : String(preErr),
        });
      }
      const result = await submitOrder({ data: buildOrderPayload() });
      const orderId = result.orderId;
      track("order_success", {
        order_id: orderId,
        total: result.total,
        sede_id: sede.sedeId,
      });
      const lastOrder = {
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
        total: result.total,
      };
      try {
        localStorage.setItem("kp.lastOrder", JSON.stringify(lastOrder));
        localStorage.removeItem(FORM_KEY);
      } catch {
        /* ignore */
      }
      clearCart();
      navigate({ to: "/gracias", search: { order_id: orderId } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No pudimos enviar tu pedido";
      track("order_error", { error_type: "submit", mensaje: msg });
      toast.error(msg);
      setEnviando(false);
    }
  }

  const ctaLabel = enviando
    ? "Coronando…"
    : esRecoger
      ? `Confirmar recogida · ${cop(total)}`
      : `Pedir a Domicilio · ${cop(total)}`;

  const direccionResumen = esRecoger
    ? sede?.label ?? "Sede"
    : direccion || sede?.direccionTexto || "Tu dirección";

  return (
    <section className="mx-auto max-w-6xl px-4 md:px-6 py-6 md:py-10 space-y-4 pb-28 lg:pb-10">
      <BrutalBadge tone="black">Checkout</BrutalBadge>
      <h1 className="font-display text-3xl md:text-5xl uppercase leading-none">
        Confirma tu corona
      </h1>

      {/* Pill discreto de tipo de entrega */}
      <button
        type="button"
        onClick={openOrderIntent}
        className="w-full md:w-auto inline-flex items-center gap-2 border-2 border-kp-ink bg-kp-cheese px-3 py-2 font-display uppercase text-xs hover:bg-kp-yellow transition"
      >
        <span className="text-base">{esRecoger ? "🏃" : "🛵"}</span>
        <span className="truncate max-w-[60vw] md:max-w-none">
          {esRecoger ? "Recoger en" : "Domicilio a"}: {direccionResumen}
        </span>
        <span className="opacity-60 underline ml-1">cambiar</span>
      </button>

      {/* Aviso amigable si está fuera de cobertura y quedó en pickup */}
      {esRecoger && sede && !sede.enCobertura && sede.lat != null && (
        <div className="border-2 border-kp-ink bg-kp-yellow/60 px-3 py-2 text-xs">
          Estás un poco lejos para nuestro domicilio
          {sede.distanciaKm ? ` (${sede.distanciaKm.toFixed(1)} km de ${sede.label.replace(/^Recoger en\s+/i, "")})` : ""}.
          Tu pedido quedó configurado para recoger en tienda. Puedes cambiarlo si prefieres intentar domicilio.
        </div>
      )}

      {/* Resumen colapsable en mobile */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setResumenAbierto((v) => !v)}
          className="w-full flex items-center justify-between border-2 border-kp-ink bg-kp-yellow px-3 py-2 font-display uppercase text-sm"
        >
          <span>
            {resumenAbierto ? "Ocultar" : "Ver"} pedido · {count} ítem{count === 1 ? "" : "s"}
          </span>
          <span className="text-base">{cop(total)}</span>
        </button>
        {resumenAbierto && (
          <div className="mt-2">
            <ResumenPedido items={items} total={total} puntos={puntos} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        {/* FORM */}
        <form onSubmit={confirmar} className="space-y-4">
          {/* Datos cliente */}
          <BrutalCard tone="cheese" className="p-4 space-y-3">
            <h2 className="font-display uppercase text-lg">Tus datos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field error={errors.nombre}>
                <BrutalInput
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre"
                  autoComplete="name"
                  className={errors.nombre ? "border-kp-red" : ""}
                />
              </Field>
              <Field error={errors.telefono}>
                <BrutalInput
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Teléfono / WhatsApp"
                  inputMode="tel"
                  autoComplete="tel"
                  className={errors.telefono ? "border-kp-red" : ""}
                />
              </Field>
            </div>
            {!esRecoger && (
              <>
                <Field error={errors.direccion}>
                  <BrutalInput
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Dirección de entrega"
                    autoComplete="street-address"
                    className={errors.direccion ? "border-kp-red" : ""}
                  />
                </Field>
                <BrutalInput
                  value={detalles}
                  onChange={(e) => setDetalles(e.target.value)}
                  placeholder="Apto, torre, referencias (opcional)"
                />
              </>
            )}
          </BrutalCard>

          {/* Pago compacto */}
          <BrutalCard tone="cheese" className="p-4 space-y-2">
            <h2 className="font-display uppercase text-lg">Método de pago</h2>
            <div className="flex flex-wrap gap-2">
              {(([
                { id: "efectivo", label: "💵 Efectivo" },
                { id: "datafono", label: "💳 Datáfono" },
                ...(PAYMENTS_ENABLED ? [{ id: "online", label: "🌐 Online" }] : []),
              ]) as { id: PagoMetodo; label: string }[]).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setPago(opt.id);
                    track("payment_method_selected", { metodo: opt.id });
                  }}
                  className={`px-3 py-2 border-2 font-display uppercase text-xs ${
                    pago === opt.id
                      ? "bg-kp-ink text-kp-cheese border-kp-ink"
                      : "bg-kp-cheese text-kp-ink border-kp-ink/40 hover:border-kp-ink"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </BrutalCard>

          {/* Detalles de entrega siempre visibles */}
          <DetallesEntrega
            sede={sede}
            esRecoger={esRecoger}
            direccion={direccion}
            subtotal={subtotal}
            total={total}
          />


          {/* Notas colapsadas */}
          <details className="border-2 border-kp-ink/30 bg-kp-cheese px-3 py-2">
            <summary className="font-display uppercase text-xs cursor-pointer">
              + Agregar nota para la cocina
            </summary>
            <div className="mt-2">
              <BrutalInput
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ej: sin cebolla, extra crispy…"
              />
            </div>
          </details>

          {/* CTA desktop */}
          <div className="hidden lg:block">
            <BrutalButton type="submit" variant="fire" size="lg" block disabled={enviando}>
              {ctaLabel}
            </BrutalButton>
          </div>
        </form>

        {/* RESUMEN desktop */}
        <aside className="hidden lg:block lg:sticky lg:top-4 self-start">
          <ResumenPedido items={items} total={total} puntos={puntos} />
        </aside>
      </div>

      {/* CTA sticky mobile */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t-2 border-kp-ink bg-kp-cheese p-3">
        <BrutalButton
          type="button"
          variant="fire"
          size="lg"
          block
          disabled={enviando}
          onClick={(e) => confirmar(e as unknown as React.FormEvent)}
        >
          {ctaLabel}
        </BrutalButton>
      </div>
    </section>
  );
}

function Field({ error, children }: { error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      {children}
      {error && <p className="text-xs text-kp-red font-display uppercase">{error}</p>}
    </div>
  );
}

function ResumenPedido({
  items,
  total,
  puntos,
}: {
  items: ReturnType<typeof useCart>["items"];
  total: number;
  puntos: number;
}) {
  return (
    <BrutalCard tone="yellow" className="p-4">
      <h2 className="font-display uppercase text-lg mb-2">Tu pedido</h2>
      <ul className="divide-y-2 divide-kp-ink/20">
        {items.map((i) => (
          <li key={i.key} className="py-2 space-y-2">
            <div className="flex justify-between gap-3">
              <span className="font-display uppercase text-sm">{i.nombre}</span>
              <span className="font-display text-sm">{cop(i.precio * i.cantidad)}</span>
            </div>
            {i.modificadores && i.modificadores.length > 0 && (
              <ul className="text-[11px] opacity-70 pl-3 list-disc">
                {i.modificadores.map((m) => (
                  <li key={`${m.grupoId}-${m.opcionId}`}>
                    {m.nombre}
                    {m.precio > 0 && ` (+${cop(m.precio)})`}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center border-2 border-kp-ink bg-kp-cheese">
                <button
                  type="button"
                  aria-label="Disminuir cantidad"
                  onClick={() => decItem(i.key)}
                  className="min-w-[44px] min-h-[44px] font-display text-lg leading-none flex items-center justify-center hover:bg-kp-yellow"
                >
                  −
                </button>
                <span className="min-w-[44px] min-h-[44px] flex items-center justify-center font-display text-sm border-x-2 border-kp-ink">
                  {i.cantidad}
                </span>
                <button
                  type="button"
                  aria-label="Aumentar cantidad"
                  onClick={() => incItem(i.key)}
                  className="min-w-[44px] min-h-[44px] font-display text-lg leading-none flex items-center justify-center hover:bg-kp-yellow"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                aria-label="Eliminar del pedido"
                onClick={() => {
                  removeItem(i.key);
                  toast.success("Eliminado del pedido");
                }}
                className="min-w-[44px] min-h-[44px] px-3 border-2 border-kp-ink bg-kp-cheese font-display uppercase text-xs hover:bg-kp-red hover:text-kp-cheese inline-flex items-center gap-1"
              >
                <span aria-hidden>🗑</span>
                <span>Eliminar</span>
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between mt-3 pt-3 border-t-2 border-kp-ink">
        <span className="font-display uppercase">Total</span>
        <span className="font-display text-2xl">{cop(total)}</span>
      </div>
      <div className="mt-3 border-2 border-kp-ink bg-kp-yellow px-3 py-2 font-display uppercase text-xs flex items-center justify-between">
        <span>👑 Sumas al confirmar</span>
        <span className="text-base">+{puntos} pts</span>
      </div>
    </BrutalCard>
  );
}

function DetallesEntrega({
  sede,
  esRecoger,
  direccion,
  subtotal,
  total,
}: {
  sede: ReturnType<typeof useActiveSede>;
  esRecoger: boolean;
  direccion: string;
  subtotal: number;
  total: number;
}) {
  // TODO: enchufar costo de domicilio desde Restaurant.pe
  // cuando esté disponible en el modelo de sede / getMenuForSede.
  // Tiempo estimado: fallback fijo por ahora.
  const tiempoEstimado = "20–40 min (estimado)";
  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="font-display uppercase opacity-70">{label}</span>
      <span className="font-display text-right">{value}</span>
    </div>
  );
  return (
    <BrutalCard tone="cheese" className="p-4 space-y-2">
      <h2 className="font-display uppercase text-lg">Detalles de entrega</h2>
      <Row label="Sede" value={sede?.label ?? "—"} />
      <Row label="Tiempo estimado" value={tiempoEstimado} />
      <Row label="Tipo" value={esRecoger ? "Recoger en sede" : "Domicilio"} />
      {!esRecoger && (
        <Row label="Dirección" value={direccion || sede?.direccionTexto || "—"} />
      )}
      <div className="border-t-2 border-kp-ink/30 pt-2 space-y-1">
        <Row label="Subtotal" value={cop(subtotal)} />
        {!esRecoger && (
          <Row label="Domicilio" value="A confirmar por WhatsApp" />
        )}
        <div className="flex items-center justify-between pt-2 mt-1 border-t-2 border-kp-ink">
          <span className="font-display uppercase">Total</span>
          <span className="font-display text-2xl">{cop(total)}</span>
        </div>
      </div>
    </BrutalCard>
  );
}

