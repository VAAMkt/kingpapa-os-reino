import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalButton, BrutalLink } from "@/components/ui-kp/BrutalButton";
import { getMyLoyalty } from "@/lib/loyalty.functions";
import { CLAN_COPY, getClanRankIdentity, getLoyaltyProgress } from "@/lib/loyalty-model";
import { getMyOrders, type MyOrderRow } from "@/lib/mi-reino.functions";
import { addItem, openCart } from "@/lib/cart";
import { shareClanCard } from "@/lib/clan-share";
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
  if (loyaltyQuery.isLoading || ordersQuery.isLoading) {
    return <p className="font-display uppercase text-sm">Cargando tu Reino…</p>;
  }
  const loyalty = loyaltyQuery.data;
  const orders = ordersQuery.data;

  const last = orders?.[0];
  const bal = loyalty?.account.puntos_balance ?? 0;
  const progress = getLoyaltyProgress(loyalty?.account.completed_orders ?? 0);
  const clan = loyalty?.account.clan ?? null;
  const identity = clan ? getClanRankIdentity(clan, progress.current.name) : null;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <BrutalCard tone="purple" className="p-5">
        <BrutalBadge tone="yellow">
          Banda {progress.current.band} · {progress.current.name.toUpperCase()}
        </BrutalBadge>
        {clan && identity ? (
          <div className="mt-3">
            <p className="text-xs font-display uppercase text-kp-yellow">{clan}</p>
            <h2 className="font-display text-3xl uppercase leading-none mt-1">{identity.title}</h2>
            <p className="text-sm mt-2">{identity.description}</p>
            <p className="text-xs mt-2 opacity-75">{CLAN_COPY[clan]}</p>
          </div>
        ) : (
          <div className="mt-3">
            <h2 className="font-display text-3xl uppercase leading-none">Tu clan está por descubrir</h2>
            <p className="text-sm mt-2">Haz el test de 30 segundos y reclama tu identidad en la banda.</p>
            <BrutalLink href="/#test-clanes" variant="dark" className="mt-3">
              Descubrir mi clan
            </BrutalLink>
          </div>
        )}
        <div className="mt-3 flex items-end gap-3">
          <p className="font-display text-6xl leading-none">{bal}</p>
          <p className="text-sm mb-1">puntos disponibles</p>
        </div>
        <div className="mt-4">
          <div
            className="h-3 border-2 border-kp-ink bg-kp-cheese overflow-hidden"
            role="progressbar"
            aria-label={`Progreso hacia ${progress.next?.name ?? "el rango máximo"}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percent}
          >
            <div className="h-full bg-kp-yellow" style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="text-xs mt-1">
            {progress.next
              ? `${progress.orders} completado${progress.orders === 1 ? "" : "s"} · ${progress.remaining} pedido${progress.remaining === 1 ? "" : "s"} para ser ${progress.next.name.toUpperCase()}`
              : "Ya eres CONSAGRADO 👑"}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <BrutalLink href="/mi-reino/puntos" variant="dark">
            Canjear puntos
          </BrutalLink>
          {clan && identity && (
            <BrutalButton
              variant="primary"
              onClick={async () => {
                try {
                  const result = await shareClanCard({
                    clan,
                    title: identity.title,
                    rank: progress.current.name,
                    band: progress.current.band,
                    description: identity.description,
                  });
                  if (result === "downloaded") toast.success("Tarjeta descargada. ¡Súbela y etiqueta a la banda!");
                } catch {
                  toast.error("No pudimos crear tu tarjeta. Intenta de nuevo.");
                }
              }}
            >
              Compartir mi clan
            </BrutalButton>
          )}
        </div>
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
