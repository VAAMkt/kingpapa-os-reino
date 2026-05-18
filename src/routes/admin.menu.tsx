import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { listAllSedes } from "@/lib/sedes";
import {
  listAdminMenu,
  updateAdminCategoria,
  updateAdminProducto,
} from "@/lib/rp.functions";

export const Route = createFileRoute("/admin/menu")({
  head: () => ({ meta: [{ title: "Menú — Admin" }] }),
  component: AdminMenuPage,
});

type Cat = {
  id: string;
  rp_id: number;
  nombre: string;
  orden: number;
  activo: boolean;
};
type Prod = {
  id: string;
  rp_id: number;
  categoria_id: string | null;
  nombre: string;
  precio: number;
  imagen_url: string | null;
  disponible: boolean;
  orden: number;
};

function AdminMenuPage() {
  const queryClient = useQueryClient();
  const sedesQ = useQuery({ queryKey: ["sedes", "all"], queryFn: listAllSedes });
  const [sedeId, setSedeId] = useState<string>("");

  const effectiveSedeId =
    sedeId || sedesQ.data?.find((s) => s.rp_local_id)?.id || "";

  const fetchMenu = useServerFn(listAdminMenu);
  const menuQ = useQuery({
    queryKey: ["admin-menu", effectiveSedeId],
    queryFn: () => fetchMenu({ data: { sedeId: effectiveSedeId } }),
    enabled: !!effectiveSedeId,
  });

  const updateCat = useServerFn(updateAdminCategoria);
  const updateProd = useServerFn(updateAdminProducto);

  const catMut = useMutation({
    mutationFn: (v: { id: string; orden?: number; activo?: boolean }) =>
      updateCat({ data: v }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-menu", effectiveSedeId] });
      queryClient.invalidateQueries({ queryKey: ["menu"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const prodMut = useMutation({
    mutationFn: (v: { id: string; orden?: number; disponible?: boolean }) =>
      updateProd({ data: v }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-menu", effectiveSedeId] });
      queryClient.invalidateQueries({ queryKey: ["menu"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const categorias = (menuQ.data?.categorias ?? []) as Cat[];
  const productos = (menuQ.data?.productos ?? []) as Prod[];

  const prodsByCat = useMemo(() => {
    const m = new Map<string, Prod[]>();
    for (const p of productos) {
      const k = p.categoria_id ?? "_sin";
      const arr = m.get(k) ?? [];
      arr.push(p);
      m.set(k, arr);
    }
    return m;
  }, [productos]);

  return (
    <div className="space-y-6">
      <header>
        <BrutalBadge tone="yellow">Menú</BrutalBadge>
        <h1 className="font-display text-3xl uppercase mt-2 leading-none">
          Gestor del menú
        </h1>
        <p className="text-sm text-kp-ink/70 mt-1">
          Reordena categorías y productos. Activa/desactiva lo que ve el cliente.
        </p>
      </header>

      <BrutalCard tone="cheese" className="p-4">
        <label className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="font-display uppercase text-sm">Sede:</span>
          <select
            value={effectiveSedeId}
            onChange={(e) => setSedeId(e.target.value)}
            className="border-2 border-kp-ink bg-kp-cheese shadow-brutal-sm px-3 py-2 font-display uppercase text-sm"
          >
            {sedesQ.data?.map((s) => (
              <option key={s.id} value={s.id} disabled={!s.rp_local_id}>
                {s.nombre} · {s.ciudad}
                {!s.rp_local_id ? " (sin rp_local_id)" : ""}
              </option>
            ))}
          </select>
        </label>
      </BrutalCard>

      {menuQ.isLoading && <p className="text-sm">Cargando menú…</p>}

      {menuQ.data && (
        <BrutalCard tone="cheese" className="p-4 space-y-3">
          <h2 className="font-display uppercase text-lg">Categorías</h2>
          <div className="grid gap-2">
            <div className="grid grid-cols-[1fr_80px_80px] gap-2 text-xs font-display uppercase text-kp-ink/60 px-2">
              <span>Nombre</span>
              <span>Orden</span>
              <span>Activa</span>
            </div>
            {categorias.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-[1fr_80px_80px] gap-2 items-center border-2 border-kp-ink bg-kp-cheese p-2 shadow-brutal-sm"
              >
                <span className="font-display uppercase text-sm truncate">
                  {c.nombre}
                </span>
                <Input
                  type="number"
                  defaultValue={c.orden}
                  className="h-9"
                  onBlur={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!Number.isNaN(v) && v !== c.orden) {
                      catMut.mutate({ id: c.id, orden: v });
                    }
                  }}
                />
                <Switch
                  checked={c.activo}
                  onCheckedChange={(v) => catMut.mutate({ id: c.id, activo: v })}
                />
              </div>
            ))}
          </div>
        </BrutalCard>
      )}

      {menuQ.data &&
        categorias.map((c) => {
          const list = prodsByCat.get(c.id) ?? [];
          if (list.length === 0) return null;
          return (
            <BrutalCard key={c.id} tone="cheese" className="p-4 space-y-3">
              <h3 className="font-display uppercase text-base">
                {c.nombre}{" "}
                <span className="text-kp-ink/50 text-xs">({list.length})</span>
              </h3>
              <div className="grid gap-2">
                {list.map((p) => (
                  <div
                    key={p.id}
                    className="grid grid-cols-[48px_1fr_90px_80px_80px] gap-2 items-center border-2 border-kp-ink bg-kp-cheese p-2 shadow-brutal-sm"
                  >
                    <div className="w-12 h-12 border-2 border-kp-ink bg-kp-yellow overflow-hidden">
                      {p.imagen_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imagen_url}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="font-display uppercase text-sm truncate">
                        {p.nombre}
                      </p>
                      <p className="text-xs text-kp-ink/60">
                        ${p.precio.toLocaleString("es-CO")}
                      </p>
                    </div>
                    <span className="text-xs text-kp-ink/60 truncate">
                      rp_id {p.rp_id}
                    </span>
                    <Input
                      type="number"
                      defaultValue={p.orden}
                      className="h-9"
                      onBlur={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isNaN(v) && v !== p.orden) {
                          prodMut.mutate({ id: p.id, orden: v });
                        }
                      }}
                    />
                    <Switch
                      checked={p.disponible}
                      onCheckedChange={(v) =>
                        prodMut.mutate({ id: p.id, disponible: v })
                      }
                    />
                  </div>
                ))}
              </div>
            </BrutalCard>
          );
        })}

      {menuQ.data && categorias.length === 0 && (
        <p className="text-sm">
          Esta sede aún no tiene menú sincronizado. Ve a Sincronización.
        </p>
      )}
    </div>
  );
}
