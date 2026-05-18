import { createFileRoute } from "@tanstack/react-router";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";

export const Route = createFileRoute("/mi-reino/puntos")({
  component: Puntos,
});

function Puntos() {
  return (
    <BrutalCard tone="purple" className="p-6">
      <BrutalBadge tone="yellow">Puntos del Reino</BrutalBadge>
      <h2 className="font-display text-3xl uppercase mt-2">0 pts</h2>
      <p className="text-sm mt-1">MVP de puntos en camino. Pronto sumarás con cada pedido.</p>
    </BrutalCard>
  );
}
