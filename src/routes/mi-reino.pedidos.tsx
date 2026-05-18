import { createFileRoute } from "@tanstack/react-router";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";

export const Route = createFileRoute("/mi-reino/pedidos")({
  component: Pedidos,
});

function Pedidos() {
  return (
    <BrutalCard tone="cheese" className="p-6">
      <BrutalBadge tone="yellow">Pedidos</BrutalBadge>
      <h2 className="font-display text-2xl uppercase mt-2">Aún no tienes pedidos</h2>
      <p className="text-sm mt-1">Cuando hagas tu primer pedido, lo verás aquí con su tracker.</p>
    </BrutalCard>
  );
}
