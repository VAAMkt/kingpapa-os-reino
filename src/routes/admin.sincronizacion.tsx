import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import { listAllSedes } from "@/lib/sedes";
import {
  syncBranches,
  syncMenuForSede,
  syncAllMenus,
  listSyncLog,
} from "@/lib/rp.functions";

export const Route = createFileRoute("/admin/sincronizacion")({
  head: () => ({ meta: [{ title: "Sincronización Restaurant.pe — Admin" }] }),
  component: SyncPage,
});

function SyncPage() {
  const queryClient = useQueryClient();

  const sedesQ = useQuery({ queryKey: ["sedes", "all"], queryFn: listAllSedes });
  const fetchLog = useServerFn(listSyncLog);
  const logQ = useQuery({ queryKey: ["rp_sync_log"], queryFn: () => fetchLog() });

  const syncBranchesFn = useServerFn(syncBranches);
  const syncMenuFn = useServerFn(syncMenuForSede);
  const syncAllMenusFn = useServerFn(syncAllMenus);

  const branchesMut = useMutation({
    mutationFn: () => syncBranchesFn(),
    onSuccess: (res) => {
      toast.success(
        `Sedes sincronizadas: ${res.matched} OK. ${res.missingLocalIds.length} sin mapear.`,
      );
      queryClient.invalidateQueries({ queryKey: ["sedes"] });
      queryClient.invalidateQueries({ queryKey: ["rp_sync_log"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const menuMut = useMutation({
    mutationFn: (sedeId: string) => syncMenuFn({ data: { sedeId } }),
    onSuccess: (res) => {
      toast.success(`Menú: ${res.categorias} categorías, ${res.productos} productos.`);
      queryClient.invalidateQueries({ queryKey: ["menu"] });
      queryClient.invalidateQueries({ queryKey: ["rp_sync_log"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allMenusMut = useMutation({
    mutationFn: () => syncAllMenusFn(),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(
          `Menús sincronizados en ${res.sedes} sedes: ${res.categorias} categorías y ${res.productos} productos cada una.`,
        );
      } else {
        toast.error(
          `Sincronizado con errores (${res.errores.length}): ${res.errores.slice(0, 2).join(" · ")}`,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["menu"] });
      queryClient.invalidateQueries({ queryKey: ["rp_sync_log"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <header>
        <BrutalBadge tone="yellow">Sincronización</BrutalBadge>
        <h1 className="font-display text-3xl uppercase mt-2 leading-none">
          Restaurant.pe ↔ KINGPAPA
        </h1>
        <p className="text-sm text-kp-ink/70 mt-1">
          Trae sedes y menús reales desde Restaurant.pe a la base de datos.
        </p>
      </header>

      <BrutalCard tone="cheese" className="p-5 space-y-3">
        <h2 className="font-display uppercase text-lg">1. Sedes (locales)</h2>
        <p className="text-sm">
          Obtiene los locales del dominio y actualiza coordenadas y servicios para sedes con
          <code className="px-1 bg-kp-yellow border border-kp-ink">rp_local_id</code> ya
          configurado. Las sedes nuevas hay que crearlas manualmente.
        </p>
        <BrutalButton
          variant="primary"
          onClick={() => branchesMut.mutate()}
          disabled={branchesMut.isPending}
        >
          {branchesMut.isPending ? "Sincronizando…" : "Sincronizar sedes"}
        </BrutalButton>
      </BrutalCard>

      <BrutalCard tone="cheese" className="p-5 space-y-4">
        <h2 className="font-display uppercase text-lg">2. Menú por sede</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <BrutalButton
            variant="primary"
            onClick={() => allMenusMut.mutate()}
            disabled={allMenusMut.isPending}
          >
            {allMenusMut.isPending ? "Sincronizando todos…" : "Sincronizar TODOS los menús"}
          </BrutalButton>
          <span className="text-xs text-kp-ink/70">
            Trae el catálogo del dominio una vez y lo aplica a cada sede con rp_local_id.
          </span>
        </div>
        {sedesQ.isLoading && <p className="text-sm">Cargando sedes…</p>}
        {sedesQ.data && sedesQ.data.length === 0 && (
          <p className="text-sm">No hay sedes registradas.</p>
        )}
        <div className="grid md:grid-cols-2 gap-3">
          {sedesQ.data?.map((s) => (
            <div
              key={s.id}
              className="border-2 border-kp-ink bg-kp-cheese p-3 shadow-brutal-sm flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-display uppercase text-sm truncate">{s.nombre}</p>
                <p className="text-xs text-kp-ink/70">
                  {s.ciudad} ·{" "}
                  {s.rp_local_id ? (
                    <span>local_id {s.rp_local_id}</span>
                  ) : (
                    <span className="text-kp-red font-bold">sin rp_local_id</span>
                  )}
                </p>
              </div>
              <BrutalButton
                size="sm"
                variant="primary"
                disabled={!s.rp_local_id || (menuMut.isPending && menuMut.variables === s.id)}
                onClick={() => menuMut.mutate(s.id)}
              >
                {menuMut.isPending && menuMut.variables === s.id
                  ? "Sync…"
                  : "Sync menú"}
              </BrutalButton>
            </div>
          ))}
        </div>
      </BrutalCard>

      <BrutalCard tone="cheese" className="p-5 space-y-3">
        <h2 className="font-display uppercase text-lg">Últimas sincronizaciones</h2>
        {logQ.isLoading && <p className="text-sm">Cargando log…</p>}
        <ul className="space-y-2 text-xs">
          {logQ.data?.map((row) => (
            <li
              key={row.id}
              className="border-2 border-kp-ink bg-kp-cheese p-2 flex items-start justify-between gap-3"
            >
              <div>
                <p>
                  <span className="font-display uppercase">{row.tipo}</span> ·{" "}
                  {new Date(row.created_at).toLocaleString("es-CO")}
                </p>
                <p className="text-kp-ink/70">{row.mensaje}</p>
              </div>
              {row.ok ? (
                <BrutalBadge tone="lime">ok</BrutalBadge>
              ) : (
                <BrutalBadge tone="red">error</BrutalBadge>
              )}
            </li>
          ))}
          {logQ.data && logQ.data.length === 0 && <li>Sin sincronizaciones aún.</li>}
        </ul>
      </BrutalCard>
    </div>
  );
}
