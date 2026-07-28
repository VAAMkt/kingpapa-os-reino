import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import { supabase } from "@/integrations/supabase/client";
import { reconcileOrder } from "@/lib/orders.reconcile.functions";
import { getOrderTracking, type OrderTrackingSnapshot } from "@/lib/rp-tracking.functions";

type OrderStatus =
  | "enviado"
  | "recibido"
  | "en_preparacion"
  | "en_camino"
  | "entregado"
  | "cancelado"
  | "error";

type OrderRow = {
  id: string;
  status: OrderStatus;
  rp_pedido_id: string | null;
  cancel_reason: string | null;
  tipo: "delivery" | "pickup";
  updated_at: string;
  created_at: string;
};

const TERMINAL = new Set<OrderStatus>(["entregado", "cancelado", "error"]);
const STALE_SECONDS = 90;
const BACKOFFS_MS = [60_000, 120_000, 180_000, 300_000, 300_000, 300_000, 300_000];
const ORDER_TTL_MS = 45 * 60_000;
const TRACKING_POLL_MS = 30_000;

const DELIVERY_PASOS: { label: string; emoji: string; status: OrderStatus[] }[] = [
  { label: "Recibimos tu pedido", emoji: "📋", status: ["enviado", "recibido"] },
  { label: "Cocinando pa’ vos", emoji: "🧀", status: ["en_preparacion"] },
  { label: "Motorizado en camino", emoji: "🛵", status: ["en_camino"] },
  { label: "¡A disfrutarlo, mi rey!", emoji: "👑", status: ["entregado"] },
];

const PICKUP_PASOS: { label: string; emoji: string; status: OrderStatus[] }[] = [
  { label: "Recibimos tu pedido", emoji: "📋", status: ["enviado", "recibido"] },
  { label: "Cocinando pa’ vos", emoji: "🧀", status: ["en_preparacion"] },
  { label: "Listo para recoger", emoji: "🛍️", status: ["en_camino"] },
  { label: "Pedido recogido", emoji: "👑", status: ["entregado"] },
];

const PICKUP_MICROCOPY: Record<OrderStatus, { title: string; sub: string }> = {
  enviado: { title: "Tu pedido entró al Reino 👑", sub: "La sede está confirmando tu recogida." },
  recibido: { title: "La cocina recibió tu pedido", sub: "Lo prepararemos para la hora elegida." },
  en_preparacion: { title: "Cocinando pa’ vos 🧀", sub: "Tu corona está en preparación." },
  en_camino: { title: "¡Listo para recoger! 🛍️", sub: "Puedes acercarte a la sede por tu pedido." },
  entregado: { title: "Pedido recogido 👑", sub: "Gracias por comer con la banda 🔥" },
  cancelado: { title: "Se cayó el pedido", sub: "Mirá el motivo abajo, te ayudamos por WhatsApp." },
  error: { title: "Se nos enredó la vuelta", sub: "Escribinos por WhatsApp y lo resolvemos ya." },
};

const MICROCOPY: Record<OrderStatus, { title: string; sub: string }> = {
  enviado: { title: "Tu pedido entró al Reino 👑", sub: "Tranqui parcero, en segundos la cocina lo pilla." },
  recibido: { title: "La cocina lo tiene entre manos", sub: "Ya está en la vuelta, cero drama." },
  en_preparacion: { title: "Cocinando pa’ vos 🧀", sub: "Papas doradas + toppings al grill. Brutal." },
  en_camino: { title: "El motorizado va rodando 🛵", sub: "Ya sale del Reino, va derechito pa’ vos." },
  entregado: { title: "¡A disfrutarlo, mi rey! 👑", sub: "Gracias por comer con la banda 🔥" },
  cancelado: { title: "Se cayó el pedido", sub: "Mirá el motivo abajo, te ayudamos por WhatsApp." },
  error: { title: "Se nos enredó la vuelta", sub: "Escribinos por WhatsApp y lo resolvemos ya." },
};

function stepIndex(
  status: OrderStatus,
  pasos: { status: OrderStatus[] }[],
): number {
  for (let i = pasos.length - 1; i >= 0; i--) {
    if (pasos[i].status.includes(status)) return i + 1;
  }
  return 0;
}

function formatTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

function onlyDigits(s: string | null | undefined): string | null {
  if (!s) return null;
  const d = s.replace(/\D/g, "");
  return d.length >= 7 ? d : null;
}

export function TrackerOperativo({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState<OrderTrackingSnapshot | null>(null);
  const [notifyOn, setNotifyOn] = useState(false);

  const prevStatusRef = useRef<OrderStatus | null>(null);
  const orderRef = useRef<OrderRow | null>(null);
  const reconcile = useServerFn(reconcileOrder);
  const fetchTracking = useServerFn(getOrderTracking);

  // Fetch enriched tracking (motorizado, timestamps) periódicamente.
  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const snap = await fetchTracking({ data: { orderId } });
        if (!cancelled) setTracking(snap);
      } catch {
        // silencioso: el tracker principal sigue funcionando
      }
      if (cancelled) return;
      const cur = orderRef.current;
      if (cur && TERMINAL.has(cur.status)) return;
      timer = setTimeout(tick, TRACKING_POLL_MS);
    }
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, fetchTracking]);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    function applyRow(next: OrderRow | null) {
      if (cancelled) return;
      orderRef.current = next;
      setOrder(next);
      setLoading(false);
      if (next && prevStatusRef.current && next.status !== prevStatusRef.current) {
        // Notificación push cuando cambia el estado y el usuario dio permiso.
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          const copy = MICROCOPY[next.status];
          try {
            new Notification("KINGPAPA 👑", { body: copy?.title ?? next.status });
          } catch {
            /* noop */
          }
        }
      }
      if (
        next &&
        next.status === "cancelado" &&
        prevStatusRef.current &&
        prevStatusRef.current !== "cancelado"
      ) {
        toast.error("Tu pedido fue cancelado. Mira el motivo abajo.");
      }
      if (next) prevStatusRef.current = next.status;
    }

    async function fetchOrder() {
      const { data } = await supabase
        .from("orders")
        .select("id, status, rp_pedido_id, cancel_reason, tipo, updated_at, created_at")
        .eq("id", orderId)
        .maybeSingle();
      applyRow((data as OrderRow | null) ?? null);
    }

    fetchOrder();

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => applyRow(payload.new as OrderRow),
      )
      .subscribe();

    reconcile({ data: { orderId } }).catch(() => {});

    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    function scheduleNext() {
      if (cancelled) return;
      const cur = orderRef.current;
      if (!cur) {
        timer = setTimeout(scheduleNext, 30_000);
        return;
      }
      if (TERMINAL.has(cur.status)) return;
      const ageFromCreated = Date.now() - new Date(cur.created_at).getTime();
      if (ageFromCreated > ORDER_TTL_MS) {
        reconcile({ data: { orderId } }).catch(() => {});
        return;
      }
      const ageSec = (Date.now() - new Date(cur.updated_at).getTime()) / 1000;
      if (ageSec < STALE_SECONDS) {
        timer = setTimeout(scheduleNext, (STALE_SECONDS - ageSec + 1) * 1000);
        return;
      }
      reconcile({ data: { orderId } }).catch(() => {});
      const delay = BACKOFFS_MS[Math.min(attempt, BACKOFFS_MS.length - 1)];
      attempt += 1;
      timer = setTimeout(scheduleNext, delay);
    }

    timer = setTimeout(scheduleNext, STALE_SECONDS * 1000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [orderId, reconcile]);

  // Estado inicial de notificaciones
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setNotifyOn(Notification.permission === "granted");
  }, []);

  async function requestNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const res = await Notification.requestPermission();
      setNotifyOn(res === "granted");
      if (res === "granted") toast.success("Te avisaremos cuando cambie tu pedido.");
    } catch {
      /* noop */
    }
  }

  async function share() {
    if (typeof navigator === "undefined") return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    const shareData = {
      title: "Mi pedido KINGPAPA",
      text: "Sigue mi Reino en vivo 👑",
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        /* usuario canceló */
      }
    }
    if (navigator.clipboard && url) {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado ✅");
      } catch {
        /* noop */
      }
    }
  }

  const status: OrderStatus = order?.status ?? "enviado";
  const isPickup = order?.tipo === "pickup";
  const pasos = isPickup ? PICKUP_PASOS : DELIVERY_PASOS;
  const isError = status === "cancelado" || status === "error";
  const step = isError ? 0 : stepIndex(status, pasos);
  const progreso = Math.min((step / pasos.length) * 100, 100);
  const idLargo = order?.rp_pedido_id ?? null;
  const motorizado = tracking?.motorizado ?? null;

  // Timestamps por paso (usando lo que tengamos: created_at, updated_at, motorizado).
  const stepTimes: (string | null)[] = [
    formatTime(order?.created_at),
    // en_preparacion — no siempre lo tenemos: usa updated_at si estamos ahí o después
    step >= 2 ? formatTime(motorizado?.en_tienda_at ?? order?.updated_at ?? null) : null,
    step >= 3 ? formatTime(motorizado?.en_curso_at ?? order?.updated_at ?? null) : null,
    step >= 4 ? formatTime(motorizado?.entregado_at ?? order?.updated_at ?? null) : null,
  ];

  const copy = isPickup
    ? PICKUP_MICROCOPY[status] ?? PICKUP_MICROCOPY.enviado
    : MICROCOPY[status] ?? MICROCOPY.enviado;

  const celular = onlyDigits(motorizado?.celular);
  const showMotorizadoCard =
    !isPickup && status === "en_camino" && !!(motorizado?.nombre || celular);

  return (
    <BrutalCard tone="black" className="p-5 md:p-7">
      <div className="flex items-start justify-between mb-4 gap-3">
        <h3 className="font-display text-2xl md:text-3xl text-kp-yellow uppercase">
          {isPickup ? "Tu pedido para recoger" : "Tu Reino en camino"}
        </h3>
        {idLargo ? (
          <BrutalBadge tone="yellow">Pedido #{idLargo}</BrutalBadge>
        ) : (
          <span className="text-xs font-display uppercase text-kp-cheese/70">
            {loading ? "conectando…" : "en la vuelta…"}
          </span>
        )}
      </div>

      {!isError ? (
        <div className="mb-4">
          <p className="font-display uppercase text-kp-yellow text-lg md:text-xl leading-tight">
            {copy.title}
          </p>
          <p className="text-xs text-kp-cheese/80 mt-1">{copy.sub}</p>
        </div>
      ) : null}

      {isError ? (
        <div className="border-2 border-kp-red bg-kp-red/10 p-4 mb-3">
          <p className="font-display uppercase text-kp-red text-sm">{copy.title}</p>
          {status === "cancelado" ? (
            order?.cancel_reason ? (
              <p className="text-xs text-kp-cheese/90 mt-1">
                Motivo: <strong>{order.cancel_reason}</strong>
              </p>
            ) : (
              <p className="text-xs text-kp-cheese/90 mt-1">
                Tu pedido se canceló desde el local. Escribinos por WhatsApp y lo resolvemos.
              </p>
            )
          ) : null}
          <p className="text-xs text-kp-cheese/80 mt-1">
            Escribinos por WhatsApp y te ayudamos de una 🙏
          </p>
        </div>
      ) : (
        <div className="h-4 bg-kp-cheese border-2 border-kp-cheese mb-5 overflow-hidden">
          <div
            className="h-full bg-kp-yellow transition-all duration-700"
            style={{ width: `${progreso}%` }}
          />
        </div>
      )}

      <ol className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {pasos.map((p, idx) => {
          const done = idx < step;
          const active = idx === step - 1;
          const time = stepTimes[idx];
          return (
            <li
              key={p.label}
              className={`border-2 p-3 text-center transition-colors ${
                done || active
                  ? "bg-kp-yellow text-kp-ink border-kp-yellow"
                  : "bg-transparent text-kp-cheese border-kp-cheese/40"
              }`}
            >
              <div className="text-2xl mb-1">{p.emoji}</div>
              <span className="block font-display uppercase text-xs leading-tight">
                {p.label}
              </span>
              {time ? (
                <span className="block mt-1 text-[10px] font-display opacity-70">
                  {time}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      {showMotorizadoCard ? (
        <div className="mt-5 border-2 border-kp-yellow bg-kp-yellow/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-display uppercase text-kp-yellow text-xs">
                Tu motorizado
              </p>
              <p className="font-display uppercase text-kp-cheese text-lg leading-tight">
                {motorizado?.nombre ?? "En ruta"}
              </p>
              {motorizado?.transportista ? (
                <p className="text-[11px] text-kp-cheese/70">
                  vía {motorizado.transportista}
                </p>
              ) : null}
            </div>
            <span className="text-4xl">🛵</span>
          </div>
          {celular ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <BrutalButton
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  if (typeof window !== "undefined") window.location.href = `tel:${celular}`;
                }}
              >
                📞 Llamar
              </BrutalButton>
              <BrutalButton
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.open(`https://wa.me/${celular}`, "_blank", "noopener");
                  }
                }}
              >
                💬 WhatsApp
              </BrutalButton>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <BrutalButton type="button" variant="primary" size="sm" onClick={share}>
          🔗 Compartir tracking
        </BrutalButton>
        {!notifyOn && typeof window !== "undefined" && "Notification" in window ? (
          <BrutalButton
            type="button"
            variant="primary"
            size="sm"
            onClick={requestNotifications}
          >
            🔔 Avisarme cuando cambie
          </BrutalButton>
        ) : null}
      </div>

      <p className="text-xs text-kp-cheese/70 mt-4">
        Se actualiza solo. Si pasan 30 min sin novedad, tíranos un WhatsApp y le metemos mano.
      </p>
    </BrutalCard>
  );
}
