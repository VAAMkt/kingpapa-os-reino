import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { supabase } from "@/integrations/supabase/client";
import { pollOrderFromRp } from "@/lib/orders.poll.functions";

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
  rp_numero_comanda: string | null;
  cancel_reason: string | null;
  tipo: "delivery" | "pickup";
};

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
  const pollFn = useServerFn(pollOrderFromRp);

  const prevStatusRef = useRef<OrderStatus | null>(null);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function fetchOrder() {
      const { data } = await supabase
        .from("orders")
        .select("id, status, rp_pedido_id, rp_numero_comanda, cancel_reason, tipo")
        .eq("id", orderId)
        .maybeSingle();
      if (cancelled) return;
      const next = (data as OrderRow | null) ?? null;
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

    fetchOrder();

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          const next = payload.new as OrderRow;
          setOrder(next);
          if (
            next.status === "cancelado" &&
            prevStatusRef.current &&
            prevStatusRef.current !== "cancelado"
          ) {
            toast.error("Tu pedido fue cancelado. Mira el motivo abajo.");
          }
          prevStatusRef.current = next.status;
        },
      )
      .subscribe();

    // Polling cada 20s al POS vía server fn. Si el POS cambió el estado
    // (entregado, anulado, en reparto) o asignó número de comanda, la server
    // fn actualiza la fila y Realtime propaga el UPDATE.
    const poll = setInterval(() => {
      const s = prevStatusRef.current;
      if (s === "entregado" || s === "cancelado" || s === "error") return;
      pollFn({ data: { orderId } }).catch(() => {
        // silencioso: el siguiente tick reintenta
      });
    }, 20_000);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [orderId, pollFn]);

  const status: OrderStatus = order?.status ?? "enviado";
  const isError = status === "cancelado" || status === "error";
  const step = isError ? 0 : stepIndex(status);
  const progreso = Math.min((step / PASOS.length) * 100, 100);
  const comandaCorta = order?.rp_numero_comanda ?? null;
  const idLargo = order?.rp_pedido_id ?? null;

  return (
    <BrutalCard tone="black" className="p-5 md:p-7">
      <div className="flex items-start justify-between mb-4 gap-3">
        <h3 className="font-display text-2xl md:text-3xl text-kp-yellow uppercase">
          Tu Reino en camino
        </h3>
        {comandaCorta ? (
          <div className="flex flex-col items-end gap-1">
            <BrutalBadge tone="yellow">Comanda #{comandaCorta}</BrutalBadge>
            {idLargo ? (
              <span className="text-[10px] font-mono text-kp-cheese/60" title="ID interno (soporte)">
                ref: {idLargo}
              </span>
            ) : null}
          </div>
        ) : idLargo ? (
          <BrutalBadge tone="yellow">Comanda #{idLargo}</BrutalBadge>
        ) : loading ? (
          <span className="text-xs font-display uppercase text-kp-cheese/70">conectando…</span>
        ) : null}
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
