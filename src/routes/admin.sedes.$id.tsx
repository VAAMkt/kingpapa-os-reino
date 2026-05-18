import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BrutalBadge } from "@/components/ui-kp/Brutal";
import { SedeForm } from "@/components/admin/SedeForm";
import { getSedeById } from "@/lib/sedes";

export const Route = createFileRoute("/admin/sedes/$id")({
  component: EditarSede,
});

function EditarSede() {
  const { id } = Route.useParams();
  const { data: sede, isLoading } = useQuery({
    queryKey: ["sedes", "byId", id],
    queryFn: () => getSedeById(id),
  });

  return (
    <div className="space-y-5">
      <header>
        <BrutalBadge tone="yellow">Editar</BrutalBadge>
        <h1 className="font-display text-3xl md:text-4xl uppercase mt-2 leading-none">
          {sede?.nombre ?? "Cargando…"}
        </h1>
      </header>
      {isLoading ? (
        <p className="font-display uppercase text-sm">Cargando…</p>
      ) : !sede ? (
        <p className="text-sm">No encontrada.</p>
      ) : (
        <SedeForm initial={sede} />
      )}
    </div>
  );
}
