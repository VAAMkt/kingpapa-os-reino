import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import { deleteSede, listAllSedes, updateSede } from "@/lib/sedes";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/sedes/")({
  component: SedesList,
});

function SedesList() {
  const queryClient = useQueryClient();

  const { data: sedes = [], isLoading } = useQuery({
    queryKey: ["sedes", "all"],
    queryFn: listAllSedes,
    staleTime: 30_000,
  });

  const togglePublish = useMutation({
    mutationFn: ({ id, publicado }: { id: string; publicado: boolean }) =>
      updateSede(id, { publicado }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sedes"] });
      toast.success("Actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSede(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sedes"] });
      toast.success("Sede eliminada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <BrutalBadge tone="yellow">Sedes</BrutalBadge>
          <h1 className="font-display text-3xl md:text-4xl uppercase mt-2 leading-none">
            Sedes del Reino
          </h1>
          <p className="text-sm text-kp-ink/70 mt-1">{sedes.length} sedes en la base.</p>
        </div>
        <Link to="/admin/sedes/nuevo">
          <BrutalButton variant="primary">+ Nueva sede</BrutalButton>
        </Link>
      </header>

      <BrutalCard tone="cheese" className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 font-display uppercase text-sm">Cargando…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-kp-ink text-kp-yellow">
                <tr>
                  <th className="text-left p-3 font-display uppercase text-xs">Sede</th>
                  <th className="text-left p-3 font-display uppercase text-xs">Ciudad</th>
                  <th className="text-left p-3 font-display uppercase text-xs">Dirección</th>
                  <th className="text-left p-3 font-display uppercase text-xs">Estado</th>
                  <th className="text-right p-3 font-display uppercase text-xs">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sedes.map((s) => (
                  <tr key={s.id} className="border-t-2 border-kp-ink/10">
                    <td className="p-3">
                      <div className="font-display uppercase text-sm">{s.nombre}</div>
                      <div className="text-xs text-kp-ink/60 font-mono">{s.slug}</div>
                    </td>
                    <td className="p-3 text-xs">{s.ciudad}</td>
                    <td className="p-3 text-xs">{s.direccion}</td>
                    <td className="p-3">
                      {s.publicado ? (
                        <BrutalBadge tone="lime">publicada</BrutalBadge>
                      ) : (
                        <BrutalBadge tone="black">oculta</BrutalBadge>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-2 whitespace-nowrap">
                      <Link
                        to="/admin/sedes/$id"
                        params={{ id: s.id }}
                        className="underline text-xs"
                      >
                        Editar
                      </Link>
                      <button
                        onClick={() => togglePublish.mutate({ id: s.id, publicado: !s.publicado })}
                        className="underline text-xs"
                      >
                        {s.publicado ? "Ocultar" : "Publicar"}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar "${s.nombre}"?`)) remove.mutate(s.id);
                        }}
                        className="underline text-xs text-kp-red"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {sedes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-sm">
                      Sin sedes todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </BrutalCard>
    </div>
  );
}
