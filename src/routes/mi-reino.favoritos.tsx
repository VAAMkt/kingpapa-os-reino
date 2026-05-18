import { createFileRoute } from "@tanstack/react-router";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";

export const Route = createFileRoute("/mi-reino/favoritos")({
  component: Favoritos,
});

function Favoritos() {
  return (
    <BrutalCard tone="cheese" className="p-6">
      <BrutalBadge tone="red">Favoritos</BrutalBadge>
      <h2 className="font-display text-2xl uppercase mt-2">Marca tus combos</h2>
      <p className="text-sm mt-1">Pronto podrás guardar tus pedidos favoritos para repetirlos en un click.</p>
    </BrutalCard>
  );
}
