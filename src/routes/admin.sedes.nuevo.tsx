import { createFileRoute } from "@tanstack/react-router";
import { BrutalBadge } from "@/components/ui-kp/Brutal";
import { SedeForm } from "@/components/admin/SedeForm";

export const Route = createFileRoute("/admin/sedes/nuevo")({
  component: NuevaSede,
});

function NuevaSede() {
  return (
    <div className="space-y-5">
      <header>
        <BrutalBadge tone="yellow">Nueva sede</BrutalBadge>
        <h1 className="font-display text-3xl md:text-4xl uppercase mt-2 leading-none">
          Crear sede
        </h1>
      </header>
      <SedeForm />
    </div>
  );
}
