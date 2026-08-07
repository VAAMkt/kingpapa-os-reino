import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalButton, BrutalLink } from "@/components/ui-kp/BrutalButton";
import { getMyLoyalty, NEXT_TIER } from "@/lib/loyalty.functions";
import { getMyOrders, type MyOrderRow } from "@/lib/mi-reino.functions";
import { addItem, openCart } from "@/lib/cart";
import { toast } from "sonner";
import { MiReinoQueryError } from "@/components/kp/MiReinoQueryError";

export const Route = createFileRoute("/mi-reino/")({
  component: MiReinoInicio,
});

function MiReinoInicio() {
  const loyaltyFn = useServerFn(getMyLoyalty);
  const ordersFn = useServerFn(getMyOrders);
  const navigate = useNavigate();
  const loyaltyQuery = useQuery({ queryKey: ["my-loyalty"], queryFn: () => loyaltyFn() });
  const ordersQuery = useQuery({ queryKey: ["my-orders"], queryFn: () => ordersFn() });
  if (loyaltyQuery.isError || ordersQuery.isError) {
    return (
      <MiReinoQueryError
        onRetry={() => {
          void loyaltyQuery.refetch();
          void ordersQuery.refetch();
        }}
      />
    );
  }
  const loyalty = loyaltyQuery.data;
  const orders = ordersQuery.data;

  const last = orders?.[0];
  const bal = loyalty?.account.puntos_balance ?? 0;
  const life = loyalty?.account.puntos_lifetime ?? 0;
  const tier = loyalty?.account.tier ?? "parcero";
  const next = NEXT_TIER[tier];
  const pct = next ? Math.min(100, Math.round((life / next.target) * 100)) : 100;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <BrutalCard tone="purple" className="p-5">
        <BrutalBadge tone="yellow">Corona · {tier.toUpperCase()}</BrutalBadge>
        <div className="mt-3 flex items-end gap-3">
          <p className="font-display text-6xl leading-none">{bal}</p>
          <p className="text-sm mb-1">puntos disponibles</p>
        </div>
        <div className="mt-4">
          <div className="h-3 border-2 border-kp-ink bg-kp-cheese overflow-hidden">
            <div className="h-full bg-kp-yellow" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs mt-1">
            {next
              ? `${life}/${next.target} pts para ser ${next.name.toUpperCase()}`
              : "Ya eres CORONADO, no hay más allá 👑"}
          </p>
        </div>
        <BrutalLink href="/mi-reino/puntos" variant="dark" className="mt-4">
          Canjear puntos
        </BrutalLink>
      </BrutalCard>

      <BrutalCard tone="cheese" className="p-5">
        <BrutalBadge tone="lime">Tu último pedido</BrutalBadge>
        {last ? (
          <>
            <div className="mt-2 flex justify-between items-start gap-2">
              <div>
                <p className="font-display text-2xl uppercase leading-tight">
                  {last.items.length} producto{last.items.length !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-kp-ink/60">
                  {new Date(last.created_at).toLocaleString("es-CO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <span className="font-mono text-sm">
                ${Math.round(last.total).toLocaleString("es-CO")}
              </span>
            </div>
            <p className="text-sm mt-2 line-clamp-2">
              {last.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(" · ")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <BrutalButton
                size="sm"
                variant="primary"
                onClick={() => {
                  repeatOrderClient(last);
                  toast.success("¡Listo, parce! Carrito coronado.");
                  navigate({ to: "/menu" });
                  setTimeout(openCart, 100);
                }}
              >
                Repetir pedido
              </BrutalButton>
              <Link
                to="/gracias"
                search={{ order_id: last.id }}
                className="font-display uppercase text-xs px-3 py-2 border-2 border-kp-ink bg-kp-yellow"
              >
                Ver estado
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm mt-2">Aún no le has clavado el diente. Empieza por el menú.</p>
            <BrutalLink href="/menu" variant="primary" className="mt-4">
              Ver menú
            </BrutalLink>
          </>
        )}
      </BrutalCard>
    </div>
  );
}

export function repeatOrderClient(order: MyOrderRow) {
  for (const it of order.items) {
    addItem({
      productoId: it.productoId,
      nombre: it.nombre,
      precio: it.precio,
      cantidad: it.cantidad,
      modificadores: it.modificadores,
      silent: true,
    });
  }
}
