import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { supabase } from "@/integrations/supabase/client";
import { reconcileOrder } from "@/lib/orders.reconcile.functions";

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
// Backoff: 60s, 120s, 180s, 300s, 300s… techo a 5 min.
const BACKOFFS_MS = [60_000, 120_000, 180_000, 300_000, 300_000, 300_000, 300_000];
// Auto-kill TTL: 45 min desde created_at. El server-side reconcileOrder
// cierra la orden como 'cancelado' (timeout_sistema) en su próxima llamada.
const ORDER_TTL_MS = 45 * 60_000;


const PASOS: { label: string; emoji: string; status: OrderStatus[] }[] = [
  { label: "Recibimos tu pedido", emoji: "📋", status: ["enviado", "recibido"] },
  { label: "Coronando en cocina", emoji: "🧀", status: ["en_preparacion"] },
  { label: "Motorizado en camino", emoji: "🛵", status: ["en_camino"] },
  { label: "¡A disfrutarlo!", emoji: "👑", status: ["entregado"] },
];

function stepIndex(status: OrderStatus): number {
  for (let i = PASOS.length - 1; i >= 0; i--) {
    if (PASOS[i].status.includes(status)) return i + 1;
  }
  return 0;
}

export function TrackerOperativo({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);

  const prevStatusRef = useRef<OrderStatus | null>(null);
  const orderRef = useRef<OrderRow | null>(null);
  const reconcile = useServerFn(reconcileOrder);
  const mountedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    mountedAtRef.current = Date.now();

    function applyRow(next: OrderRow | null) {
      if (cancelled) return;
      orderRef.current = next;
      setOrder(next);
      setLoading(false);
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

    // Webhook + Realtime es el camino feliz. Reconciliación pull es la red
    // de seguridad cuando RP no dispara el webhook.
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => applyRow(payload.new as OrderRow),
      )
      .subscribe();

    // Reconcile al montar (cubre gap entre checkout y primer webhook).
    reconcile({ data: { orderId } }).catch(() => {});

    // Lazy reconciliation con backoff cuando no llegan eventos.
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
      // Auto-kill TTL: si pasaron >45 min desde created_at, dejamos de pollear.
      // El server-side reconcileOrder ya cerró/cerrará la orden como cancelado.
      const ageFromCreated = Date.now() - new Date(cur.created_at).getTime();
      if (ageFromCreated > ORDER_TTL_MS) {
        // Disparamos un último reconcile para gatillar el auto-abandono server-side.
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

  const status: OrderStatus = order?.status ?? "enviado";
  const isError = status === "cancelado" || status === "error";
  const step = isError ? 0 : stepIndex(status);
  const progreso = Math.min((step / PASOS.length) * 100, 100);
  const idLargo = order?.rp_pedido_id ?? null;

  return (
    <BrutalCard tone="black" className="p-5 md:p-7">
      <div className="flex items-start justify-between mb-4 gap-3">
        <h3 className="font-display text-2xl md:text-3xl text-kp-yellow uppercase">
          Tu Reino en camino
        </h3>
        {idLargo ? (
          <BrutalBadge tone="yellow">Pedido #{idLargo}</BrutalBadge>
        ) : (
          <span className="text-xs font-display uppercase text-kp-cheese/70">
            {loading ? "conectando…" : "registrando…"}
          </span>
        )}
      </div>

      {isError ? (
        <div className="border-2 border-kp-red bg-kp-red/10 p-4 mb-3">
          <p className="font-display uppercase text-kp-red text-sm">
            {status === "cancelado" ? "Pedido cancelado" : "Hubo un problema con tu pedido"}
          </p>
          {status === "cancelado" ? (
            order?.cancel_reason ? (
              <p className="text-xs text-kp-cheese/90 mt-1">
                Motivo: <strong>{order.cancel_reason}</strong>
              </p>
            ) : (
              <p className="text-xs text-kp-cheese/90 mt-1">
                Tu pedido fue cancelado desde el local. Contáctanos por WhatsApp para más detalles.
              </p>
            )
          ) : null}
          <p className="text-xs text-kp-cheese/80 mt-1">
            Escríbenos por WhatsApp para resolverlo de inmediato.
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
        {PASOS.map((p, idx) => {
          const done = idx < step;
          const active = idx === step - 1;
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
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-kp-cheese/70 mt-4">
        Se actualiza automáticamente. Si pasan 30 minutos sin novedad, escríbenos por WhatsApp.
      </p>
    </BrutalCard>
  );
}
