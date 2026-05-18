import { createFileRoute } from "@tanstack/react-router";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/mi-reino/datos")({
  component: Datos,
});

function Datos() {
  const { user } = useAuth();
  return (
    <BrutalCard tone="cheese" className="p-6 space-y-2">
      <BrutalBadge tone="lime">Mis datos</BrutalBadge>
      <h2 className="font-display text-2xl uppercase">Cuenta</h2>
      <p className="text-sm"><b>Email:</b> {user?.email}</p>
      <p className="text-sm"><b>Nombre:</b> {user?.user_metadata?.display_name || "—"}</p>
      <p className="text-xs text-kp-ink/60 mt-2">Edición de perfil próximamente.</p>
    </BrutalCard>
  );
}
