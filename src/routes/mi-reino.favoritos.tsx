import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalButton, BrutalLink } from "@/components/ui-kp/BrutalButton";
import { listMyFavorites, toggleFavorite } from "@/lib/mi-reino.functions";
import { repeatOrderClient } from "./mi-reino.index";
import { openCart } from "@/lib/cart";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/mi-reino/favoritos")({
  component: Favoritos,
});

function Favoritos() {
  const favFn = useServerFn(listMyFavorites);
  const toggleFn = useServerFn(toggleFavorite);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["my-favorites"], queryFn: () => favFn() });
  const [editing, setEditing] = useState<string | null>(null);
  const [alias, setAlias] = useState("");

  const upd = useMutation({
    mutationFn: (v: { order_id: string; alias: string | null }) => toggleFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-favorites"] });
      setEditing(null);
    },
  });

  if (!data || data.length === 0) {
    return (
      <BrutalCard tone="cheese" className="p-6">
        <BrutalBadge tone="red">Favoritos</BrutalBadge>
        <h2 className="font-display text-2xl uppercase mt-2">Marca tus combos</h2>
        <p className="text-sm mt-1">
          Guarda tus pedidos favoritos desde "Pedidos" para repetirlos en un click.
        </p>
        <BrutalLink href="/mi-reino/pedidos" variant="primary" className="mt-4">
          Ver mis pedidos
        </BrutalLink>
      </BrutalCard>
    );
  }
  return (
    <div className="space-y-3">
      {data.map((o) => (
        <BrutalCard key={o.id} tone="cheese" className="p-4">
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <BrutalBadge tone="lime">Favorito</BrutalBadge>
              <p className="font-display text-lg uppercase mt-2">
                {o.alias || `Pedido ${new Date(o.created_at).toLocaleDateString("es-CO")}`}
              </p>
              <p className="text-sm mt-1 line-clamp-2">
                {o.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(" · ")}
              </p>
            </div>
            <span className="font-mono text-sm whitespace-nowrap">
              ${Math.round(o.total).toLocaleString("es-CO")}
            </span>
          </div>
          {editing === o.id ? (
            <div className="mt-3 flex gap-2">
              <input
                className="flex-1 border-2 border-kp-ink px-3 py-2 text-sm bg-white"
                placeholder="Ej: combo obrero"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                maxLength={60}
              />
              <BrutalButton size="sm" onClick={() => upd.mutate({ order_id: o.id, alias })}>
                Guardar
              </BrutalButton>
              <BrutalButton size="sm" variant="ghost" onClick={() => setEditing(null)}>
                Cancelar
              </BrutalButton>
            </div>
          ) : (
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
                Pedir de nuevo
              </BrutalButton>
              <BrutalButton
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(o.id);
                  setAlias(o.alias ?? "");
                }}
              >
                Editar nombre
              </BrutalButton>
              <BrutalButton
                size="sm"
                variant="ghost"
                onClick={() =>
                  toggleFn({ data: { order_id: o.id } }).then(() =>
                    qc.invalidateQueries({ queryKey: ["my-favorites"] }),
                  )
                }
              >
                Quitar
              </BrutalButton>
            </div>
          )}
        </BrutalCard>
      ))}
    </div>
  );
}
