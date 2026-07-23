import { createFileRoute } from "@tanstack/react-router";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalLink } from "@/components/ui-kp/BrutalButton";

export const Route = createFileRoute("/mi-reino/")({
  component: MiReinoInicio,
});

function MiReinoInicio() {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <BrutalCard tone="cheese" className="p-5">
        <BrutalBadge tone="lime">Próximo pedido</BrutalBadge>
        <h2 className="font-display text-2xl uppercase mt-2">Repite el último</h2>
        <p className="text-sm mt-1">Aún no tienes pedidos. Empieza por el menú.</p>
        <BrutalLink href="/menu" variant="primary" className="mt-4">
          Ver menú
        </BrutalLink>
      </BrutalCard>
      <BrutalCard tone="purple" className="p-5">
        <BrutalBadge tone="yellow">Puntos del Reino</BrutalBadge>
        <h2 className="font-display text-2xl uppercase mt-2">0 pts</h2>
        <p className="text-sm mt-1">Pronto verás tu saldo y canjes aquí.</p>
      </BrutalCard>
    </div>
  );
}
