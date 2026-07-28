import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import { getMyOrders, toggleFavorite } from "@/lib/mi-reino.functions";
import { repeatOrderClient } from "./mi-reino.index";
import { openCart } from "@/lib/cart";
import { toast } from "sonner";

export const Route = createFileRoute("/mi-reino/pedidos")({
  component: Pedidos,
});

const STATUS_LABEL: Record<
  string,
  { label: string; tone: "yellow" | "lime" | "red" | "purple" | "black" }
> = {
  enviado: { label: "Enviado", tone: "yellow" },
  recibido: { label: "Recibido", tone: "yellow" },
  en_preparacion: { label: "En cocina", tone: "purple" },
  en_camino: { label: "En camino", tone: "lime" },
  entregado: { label: "Entregado", tone: "black" },
  cancelado: { label: "Cancelado", tone: "red" },
  error: { label: "Error", tone: "red" },
};

function Pedidos() {
  const ordersFn = useServerFn(getMyOrders);
  const toggleFn = useServerFn(toggleFavorite);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["my-orders"], queryFn: () => ordersFn() });

  const fav = useMutation({
    mutationFn: (order_id: string) => toggleFn({ data: { order_id, alias: null } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-orders"] }),
  });

  if (isLoading) return <p className="font-display uppercase text-sm">Cargando pedidos…</p>;
  if (!data || data.length === 0) {
    return (
      <BrutalCard tone="cheese" className="p-6">
        <BrutalBadge tone="yellow">Pedidos</BrutalBadge>
        <h2 className="font-display text-2xl uppercase mt-2">Aún no le clavaste el diente</h2>
        <p className="text-sm mt-1">
          Cuando hagas tu primer pedido, aquí lo verás con su tracker y podrás repetirlo en un
          click.
        </p>
      </BrutalCard>
    );
  }
  return (
    <div className="space-y-3">
      {data.map((o) => {
        const st = STATUS_LABEL[o.status] ?? { label: o.status, tone: "yellow" as const };
        return (
          <BrutalCard key={o.id} tone="cheese" className="p-4">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <BrutalBadge tone={st.tone}>{st.label}</BrutalBadge>
                  <BrutalBadge tone="yellow">
                    {o.tipo === "delivery" ? "Domicilio" : "Pickup"}
                  </BrutalBadge>
                  {o.rp_numero_comanda && (
                    <span className="text-xs font-mono">#{o.rp_numero_comanda}</span>
                  )}
                  {o.is_favorite && <span title="Favorito">⭐</span>}
                </div>
                <p className="text-xs text-kp-ink/60 mt-1">
                  {new Date(o.created_at).toLocaleString("es-CO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
                <p className="text-sm mt-1 line-clamp-2">
                  {o.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(" · ")}
                </p>
              </div>
              <span className="font-mono text-sm whitespace-nowrap">
                ${Math.round(o.total).toLocaleString("es-CO")}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <BrutalButton
                size="sm"
                variant="primary"
                onClick={() => {
                  repeatOrderClient(o);
                  toast.success("Carrito listo, parce.");
                  navigate({ to: "/menu" });
                  setTimeout(openCart, 100);
                }}
              >
                Repetir
              </BrutalButton>
              <Link
                to="/gracias"
                search={{ order: o.id, q: undefined }}
                className="font-display uppercase text-xs px-3 py-2 border-2 border-kp-ink bg-kp-cheese"
              >
                Ver tracking
              </Link>
              <BrutalButton
                size="sm"
                variant={o.is_favorite ? "dark" : "ghost"}
                onClick={() => fav.mutate(o.id)}
              >
                {o.is_favorite ? "★ Quitar favorito" : "☆ Favorito"}
              </BrutalButton>
            </div>
          </BrutalCard>
        );
      })}
    </div>
  );
}
