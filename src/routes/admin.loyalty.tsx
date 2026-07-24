import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import {
  listLoyaltyAccounts,
  adjustPoints,
  listRewardsAdmin,
  upsertReward,
  deleteReward,
} from "@/lib/admin-stats.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/loyalty")({
  head: () => ({ meta: [{ title: "Loyalty — Admin KINGPAPA" }] }),
  component: AdminLoyalty,
});

function AdminLoyalty() {
  const [tab, setTab] = useState<"clientes" | "recompensas">("clientes");
  return (
    <div className="space-y-5">
      <header>
        <BrutalBadge tone="yellow">Loyalty</BrutalBadge>
        <h1 className="font-display text-4xl uppercase mt-2">Reino de puntos</h1>
      </header>
      <div className="flex gap-1">
        {(["clientes", "recompensas"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`font-display uppercase text-xs px-3 py-2 border-2 border-kp-ink ${
              tab === t ? "bg-kp-ink text-kp-yellow" : "bg-kp-cheese"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "clientes" ? <Clientes /> : <Recompensas />}
    </div>
  );
}

function Clientes() {
  const listFn = useServerFn(listLoyaltyAccounts);
  const adjFn = useServerFn(adjustPoints);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const { data } = useQuery({
    queryKey: ["admin-loyalty-accounts", term],
    queryFn: () => listFn({ data: { search: term || undefined } }),
  });
  const [adjUser, setAdjUser] = useState<string | null>(null);
  const [pts, setPts] = useState(0);
  const [motivo, setMotivo] = useState("");

  const adj = useMutation({
    mutationFn: () =>
      adjFn({ data: { user_id: adjUser!, puntos: pts, motivo } }),
    onSuccess: () => {
      toast.success("Puntos ajustados");
      qc.invalidateQueries({ queryKey: ["admin-loyalty-accounts"] });
      setAdjUser(null);
      setPts(0);
      setMotivo("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          className="flex-1 border-2 border-kp-ink px-3 py-2 bg-white"
          placeholder="Buscar por nombre, email o WhatsApp"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <BrutalButton onClick={() => setTerm(search)}>Buscar</BrutalButton>
      </div>
      <BrutalCard tone="cheese" className="p-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase font-display">
            <tr className="border-b-2 border-kp-ink">
              <th className="text-left py-2">Cliente</th>
              <th className="text-left py-2">Contacto</th>
              <th className="text-left py-2">Tier</th>
              <th className="text-right py-2">Balance</th>
              <th className="text-right py-2">Lifetime</th>
              <th className="text-right py-2">Acción</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.user_id} className="border-b border-kp-ink/10 align-top">
                <td className="py-2">{r.display_name ?? "—"}</td>
                <td className="py-2 text-xs">{r.email ?? "—"}{r.whatsapp ? ` · ${r.whatsapp}` : ""}</td>
                <td className="py-2 uppercase font-display text-xs">{r.tier}</td>
                <td className="py-2 text-right font-mono">{r.puntos_balance}</td>
                <td className="py-2 text-right font-mono">{r.puntos_lifetime}</td>
                <td className="py-2 text-right">
                  <button
                    className="font-display uppercase text-xs border-2 border-kp-ink bg-kp-yellow px-2 py-1"
                    onClick={() => setAdjUser(r.user_id)}
                  >
                    Ajustar
                  </button>
                </td>
              </tr>
            ))}
            {(data ?? []).length === 0 && (
              <tr><td colSpan={6} className="py-4 text-center text-kp-ink/60">Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </BrutalCard>

      {adjUser && (
        <div className="fixed inset-0 z-50 bg-kp-ink/70 flex items-center justify-center p-4" onClick={() => setAdjUser(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
            <BrutalCard tone="yellow" className="p-5 space-y-3">
              <BrutalBadge tone="black">Ajuste manual</BrutalBadge>
              <input
                type="number"
                className="w-full border-2 border-kp-ink px-3 py-2 bg-white"
                placeholder="Puntos (+ o -)"
                value={pts}
                onChange={(e) => setPts(parseInt(e.target.value || "0", 10))}
              />
              <input
                className="w-full border-2 border-kp-ink px-3 py-2 bg-white"
                placeholder="Motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                maxLength={200}
              />
              <div className="flex gap-2">
                <BrutalButton block onClick={() => adj.mutate()} disabled={!motivo || pts === 0 || adj.isPending}>
                  Aplicar
                </BrutalButton>
                <BrutalButton block variant="ghost" onClick={() => setAdjUser(null)}>Cancelar</BrutalButton>
              </div>
            </BrutalCard>
          </div>
        </div>
      )}
    </div>
  );
}

function Recompensas() {
  const listFn = useServerFn(listRewardsAdmin);
  const upsFn = useServerFn(upsertReward);
  const delFn = useServerFn(deleteReward);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-rewards"], queryFn: () => listFn() });
  const [form, setForm] = useState<null | {
    id?: string;
    nombre: string;
    descripcion: string;
    costo_puntos: number;
    tipo: "descuento_fijo" | "producto" | "envio_gratis";
    valor: number;
    activo: boolean;
    stock: number | null;
    orden: number;
  }>(null);

  const save = useMutation({
    mutationFn: () =>
      upsFn({
        data: {
          id: form?.id,
          nombre: form!.nombre,
          descripcion: form!.descripcion || null,
          costo_puntos: form!.costo_puntos,
          tipo: form!.tipo,
          valor: form!.valor,
          activo: form!.activo,
          stock: form!.stock,
          orden: form!.orden,
        },
      }),
    onSuccess: () => {
      toast.success("Recompensa guardada");
      qc.invalidateQueries({ queryKey: ["admin-rewards"] });
      setForm(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Recompensa desactivada");
      qc.invalidateQueries({ queryKey: ["admin-rewards"] });
    },
  });

  return (
    <div className="space-y-3">
      <div>
        <BrutalButton
          onClick={() =>
            setForm({
              nombre: "",
              descripcion: "",
              costo_puntos: 100,
              tipo: "descuento_fijo",
              valor: 5000,
              activo: true,
              stock: null,
              orden: 0,
            })
          }
        >
          + Nueva recompensa
        </BrutalButton>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(data ?? []).map((r) => (
          <BrutalCard key={r.id as string} tone="cheese" className="p-4">
            <div className="flex justify-between gap-2 items-start">
              <div>
                <h3 className="font-display text-lg uppercase leading-tight">{r.nombre as string}</h3>
                <p className="text-xs text-kp-ink/70">{r.descripcion as string | null}</p>
              </div>
              <BrutalBadge tone={r.activo ? "lime" : "red"}>{r.activo ? "activa" : "inactiva"}</BrutalBadge>
            </div>
            <p className="text-xs mt-2">
              {r.costo_puntos as number} pts · {r.tipo as string} · valor {r.valor as number}
              {r.stock !== null ? ` · stock ${r.stock}` : ""}
            </p>
            <div className="mt-3 flex gap-2">
              <BrutalButton
                size="sm"
                onClick={() =>
                  setForm({
                    id: r.id as string,
                    nombre: r.nombre as string,
                    descripcion: (r.descripcion as string) ?? "",
                    costo_puntos: r.costo_puntos as number,
                    tipo: r.tipo as "descuento_fijo" | "producto" | "envio_gratis",
                    valor: r.valor as number,
                    activo: r.activo as boolean,
                    stock: r.stock as number | null,
                    orden: r.orden as number,
                  })
                }
              >
                Editar
              </BrutalButton>
              <BrutalButton size="sm" variant="fire" onClick={() => del.mutate(r.id as string)}>
                Desactivar
              </BrutalButton>
            </div>
          </BrutalCard>
        ))}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 bg-kp-ink/70 flex items-center justify-center p-4" onClick={() => setForm(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
            <BrutalCard tone="yellow" className="p-5 space-y-3">
              <BrutalBadge tone="black">{form.id ? "Editar" : "Nueva"} recompensa</BrutalBadge>
              <input className="w-full border-2 border-kp-ink px-3 py-2 bg-white" placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              <textarea className="w-full border-2 border-kp-ink px-3 py-2 bg-white" placeholder="Descripción" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-display uppercase">
                  Costo pts
                  <input type="number" className="mt-1 w-full border-2 border-kp-ink px-3 py-2 bg-white" value={form.costo_puntos} onChange={(e) => setForm({ ...form, costo_puntos: parseInt(e.target.value || "0", 10) })} />
                </label>
                <label className="text-xs font-display uppercase">
                  Valor
                  <input type="number" className="mt-1 w-full border-2 border-kp-ink px-3 py-2 bg-white" value={form.valor} onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value || "0") })} />
                </label>
                <label className="text-xs font-display uppercase">
                  Tipo
                  <select className="mt-1 w-full border-2 border-kp-ink px-3 py-2 bg-white" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as typeof form.tipo })}>
                    <option value="descuento_fijo">descuento fijo</option>
                    <option value="envio_gratis">envío gratis</option>
                    <option value="producto">producto</option>
                  </select>
                </label>
                <label className="text-xs font-display uppercase">
                  Orden
                  <input type="number" className="mt-1 w-full border-2 border-kp-ink px-3 py-2 bg-white" value={form.orden} onChange={(e) => setForm({ ...form, orden: parseInt(e.target.value || "0", 10) })} />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
                Activa
              </label>
              <div className="flex gap-2">
                <BrutalButton block onClick={() => save.mutate()} disabled={!form.nombre || save.isPending}>Guardar</BrutalButton>
                <BrutalButton block variant="ghost" onClick={() => setForm(null)}>Cancelar</BrutalButton>
              </div>
            </BrutalCard>
          </div>
        </div>
      )}
    </div>
  );
}
