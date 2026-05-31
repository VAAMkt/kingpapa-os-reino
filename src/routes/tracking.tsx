import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BrutalCard } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import { Input } from "@/components/ui/input";
import { findRecentOrder } from "@/lib/orders.functions";

export const Route = createFileRoute("/tracking")({
  head: () => ({
    meta: [
      { title: "Rastrea tu pedido — KINGPAPA" },
      { name: "description", content: "Busca tu pedido por número de comanda o teléfono." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TrackingPage,
});

function TrackingPage() {
  const navigate = useNavigate();
  const findOrder = useServerFn(findRecentOrder);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 4) {
      toast.error("Ingresa al menos 4 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const res = await findOrder({ data: { query: q } });
      if (res && "orderId" in res && res.orderId) {
        navigate({ to: "/gracias", search: { order_id: res.orderId } });
      } else {
        toast.error("No encontramos un pedido reciente con esos datos.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al buscar el pedido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-xl px-4 md:px-6 py-10 space-y-5">
      <BrutalCard tone="yellow" className="p-6">
        <h1 className="font-display text-3xl md:text-5xl uppercase leading-none">
          Rastrea tu pedido 👑
        </h1>
        <p className="mt-3 text-sm opacity-80">
          Ingresa tu número de comanda, ID de pedido o el teléfono con el que pediste
          en las últimas 24 horas.
        </p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ej: 158716 o 3001234567"
            className="border-2 border-kp-ink font-display uppercase"
            autoFocus
            inputMode="text"
            autoComplete="off"
          />
          <BrutalButton type="submit" variant="dark" size="lg" block disabled={loading}>
            {loading ? "Buscando…" : "Encontrar mi pedido"}
          </BrutalButton>
        </form>
      </BrutalCard>
      <p className="text-xs text-kp-ink/60 text-center">
        ¿No lo encuentras? Escríbenos por WhatsApp y te ayudamos.
      </p>
    </section>
  );
}
