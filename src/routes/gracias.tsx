import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalButton, BrutalLink } from "@/components/ui-kp/BrutalButton";
import { TrackerOperativo } from "@/components/kp/TrackerOperativo";
import { resolveOrderId } from "@/lib/orders.poll.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/gracias")({
  validateSearch: (s: Record<string, unknown>) => {
    const raw =
      typeof s.order_id === "string"
        ? s.order_id
        : typeof s.order_id === "number"
          ? String(s.order_id)
          : "";
    // Defensive: strip JSON-encoded surrounding quotes (e.g. `"159276"`).
    const clean = raw.replace(/^"+|"+$/g, "").trim();
    return { order_id: clean };
  },
  head: () => ({
    meta: [
      { title: "¡Tu corona se está forjando! — KINGPAPA" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GraciasPage,
});

const cop = (n: number) => "$" + n.toLocaleString("es-CO");

type LastOrder = {
  orderId: string;
  tipo: "delivery" | "pickup";
  pago: string;
  cliente: { nombre: string; telefono: string; direccion: string | null; detalles: string };
  sede: { id: string; slug: string; label: string } | null;
  items: { key: string; nombre: string; cantidad: number; precio: number }[];
  total: number;
};

function GraciasPage() {
  const { order_id } = Route.useSearch();
  const [order, setOrder] = useState<LastOrder | null>(null);
  const [sedeWa, setSedeWa] = useState<string | null>(null);
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [rpPedidoId, setRpPedidoId] = useState<string | null>(null);
  const resolveFn = useServerFn(resolveOrderId);

  // Resolver UUID real de orders.id (acepta UUID o rp_pedido_id numérico).
  useEffect(() => {
    if (!order_id) return;
    let cancelled = false;
    resolveFn({ data: { ref: order_id } })
      .then((r) => {
        if (cancelled) return;
        if ("id" in r && typeof r.id === "string") setResolvedId(r.id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [order_id, resolveFn]);

  // Suscripción a la fila orders para obtener el rp_pedido_id (deliveryId) en vivo.
  useEffect(() => {
    if (!resolvedId) return;
    let cancelled = false;
    const apply = (row: { rp_pedido_id: string | null } | null) => {
      if (!row || cancelled) return;
      setRpPedidoId(row.rp_pedido_id ?? null);
    };
    supabase
      .from("orders")
      .select("rp_pedido_id")
      .eq("id", resolvedId)
      .maybeSingle()
      .then(({ data }) => apply(data as never));
    const channel = supabase
      .channel(`gracias-${resolvedId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${resolvedId}` },
        (payload) => apply(payload.new as never),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [resolvedId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("kp.lastOrder");
      if (raw) {
        const parsed = JSON.parse(raw) as LastOrder;
        if (parsed.orderId === order_id) setOrder(parsed);
      }
    } catch { /* ignore */ }
  }, [order_id]);

  // Buscar WhatsApp de la sede desde el backend público.
  useEffect(() => {
    if (!order?.sede?.slug) return;
    import("@/lib/sedes").then(({ listPublicSedes }) =>
      listPublicSedes().then((sedes) => {
        const s = sedes.find((x) => x.slug === order.sede!.slug);
        if (s?.whatsapp) setSedeWa(s.whatsapp);
      }).catch(() => {})
    );
  }, [order?.sede?.slug]);

  const esRecoger = order?.tipo === "pickup";
  const waNumber = (sedeWa ?? "573172455336").replace(/\D/g, "");
  const refVisible = rpPedidoId ?? order_id;
  const waText = encodeURIComponent(
    `Hola KINGPAPA, mi pedido #${refVisible} (${esRecoger ? "RECOGER" : "DELIVERY"}). ` +
      (order ? `Total: ${cop(order.total)}` : ""),
  );
  const waUrl = `https://wa.me/${waNumber}?text=${waText}`;

  return (
    <section className="mx-auto max-w-3xl px-4 md:px-6 py-10 space-y-5">
      <BrutalCard tone="yellow" className="p-6 text-center">
        <BrutalBadge tone="black">Pedido recibido</BrutalBadge>
        <h1 className="font-display text-4xl md:text-6xl uppercase leading-none mt-3">
          👑 Tu corona se está forjando
        </h1>
        <p className="mt-3 text-sm opacity-80">
          Tu número de pedido (úsalo con el motorizado o por WhatsApp):
        </p>
        <div className="mt-3 border-2 border-kp-ink bg-kp-cheese px-4 py-3 inline-block">
          <span className="font-display text-3xl md:text-4xl tracking-widest">
            #{refVisible}
          </span>
        </div>
      </BrutalCard>

      {resolvedId ? <TrackerOperativo orderId={resolvedId} /> : null}

      {order && (
        <BrutalCard tone="cheese" className="p-5">
          <h2 className="font-display uppercase text-xl mb-2">Resumen</h2>
          <p className="text-sm">
            <strong>{esRecoger ? "Recoges en" : "Llega a"}:</strong>{" "}
            {esRecoger ? order.sede?.label : order.cliente.direccion}
          </p>
          <p className="text-sm">
            <strong>Contacto:</strong> {order.cliente.nombre} · {order.cliente.telefono}
          </p>
          <ul className="mt-3 divide-y-2 divide-kp-ink/20">
            {order.items.map((i) => (
              <li key={i.key} className="py-2 flex justify-between gap-3">
                <span className="font-display uppercase text-sm">{i.cantidad}× {i.nombre}</span>
                <span className="font-display text-sm">{cop(i.precio * i.cantidad)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between mt-3 pt-3 border-t-2 border-kp-ink">
            <span className="font-display uppercase">Total</span>
            <span className="font-display text-2xl">{cop(order.total)}</span>
          </div>
        </BrutalCard>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <BrutalLink href={waUrl} external variant="fire" size="lg" block>
          💬 Escribir a la sede por WhatsApp
        </BrutalLink>
        <Link to="/menu">
          <BrutalButton variant="ghost" size="lg" block>Volver al menú</BrutalButton>
        </Link>
      </div>
    </section>
  );
}
