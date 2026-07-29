import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { getAdminDashboard } from "@/lib/admin-stats.functions";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

const RANGES = [
  { key: "24h" as const, label: "24h" },
  { key: "7d" as const, label: "7 días" },
  { key: "30d" as const, label: "30 días" },
];

function AdminDashboard() {
  const dashFn = useServerFn(getAdminDashboard);
  const [range, setRange] = useState<"24h" | "7d" | "30d">("7d");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard", range],
    queryFn: () => dashFn({ data: { range } }),
  });

  const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <BrutalBadge tone="yellow">Dashboard</BrutalBadge>
          <h1 className="font-display text-4xl uppercase mt-2 leading-none">Resumen del Reino</h1>
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`font-display uppercase text-xs px-3 py-2 border-2 border-kp-ink ${
                range === r.key ? "bg-kp-ink text-kp-yellow" : "bg-kp-cheese"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {isLoading || !data ? (
        <p className="font-display uppercase text-sm">Cargando datos reales…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi tone="yellow" label="Pedidos entregados" value={data.kpis.pedidos.toString()} />
            <Kpi tone="cheese" label="Ventas entregadas" value={fmt(data.kpis.ingresos)} />
            <Kpi tone="purple" label="Ticket prom." value={fmt(data.kpis.ticketPromedio)} />
            <Kpi tone="yellow" label="Finalización" value={`${data.kpis.finalizacionPct}%`} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi tone="red" label="Cancelación" value={`${data.kpis.cancelacionPct}%`} />
            <Kpi tone="cheese" label="Pedidos activos" value={data.kpis.activos.toString()} />
            <Kpi tone="red" label="Errores / descartados" value={data.kpis.errores.toString()} />
            <Kpi tone="cheese" label="Pruebas excluidas" value={data.kpis.pruebasExcluidas.toString()} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi tone="yellow" label="Ingresos domicilio" value={fmt(data.kpis.ingresosDomicilio)} />
            <Kpi tone="cheese" label="Tarifa domicilio prom." value={fmt(data.kpis.tarifaDomicilioPromedio)} />
            <Kpi tone="purple" label="Distancia prom." value={`${data.kpis.distanciaPromedioKm.toLocaleString("es-CO")} km`} />
            <Kpi tone="cheese" label="Sedes con venta" value={data.porSede.length.toString()} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi
              tone="cheese"
              label="Súbditos nuevos"
              value={data.kpis.subditosNuevos.toString()}
            />
            <Kpi
              tone="cheese"
              label="Súbditos totales"
              value={data.kpis.subditosTotal.toString()}
            />

          </div>

          <p className="text-xs text-kp-ink/65">
            Ventas, ticket, canales, sedes y productos incluyen únicamente pedidos entregados.
            Errores, pruebas y exclusiones analíticas no suman ingresos.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <BrutalCard tone="cheese" className="p-5">
              <h2 className="font-display text-xl uppercase mb-3">Pedidos por canal</h2>
              <BarList
                data={data.porCanal.map((c) => ({
                  label: c.tipo,
                  value: c.pedidos,
                  meta: fmt(c.ingresos),
                }))}
              />
            </BrutalCard>
            <BrutalCard tone="cheese" className="p-5">
              <h2 className="font-display text-xl uppercase mb-3">Sedes top</h2>
              <BarList
                data={data.porSede.map((s) => ({
                  label: s.sede_nombre,
                  value: s.pedidos,
                  meta: fmt(s.ingresos),
                }))}
              />
            </BrutalCard>
            <BrutalCard tone="cheese" className="p-5">
              <h2 className="font-display text-xl uppercase mb-3">Productos top</h2>
              <BarList
                data={data.productosTop.map((p) => ({
                  label: p.nombre,
                  value: p.cantidad,
                  meta: `${p.cantidad} u`,
                }))}
              />
            </BrutalCard>
            <BrutalCard tone="cheese" className="p-5">
              <h2 className="font-display text-xl uppercase mb-3">Por estado</h2>
              <BarList
                data={data.porEstado.map((e) => ({
                  label: e.status,
                  value: e.count,
                  meta: `${e.count}`,
                }))}
              />
            </BrutalCard>
          </div>

          <BrutalCard tone="cheese" className="p-5">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-display text-xl uppercase">Últimos pedidos</h2>
              <Link
                to="/admin/pedidos"
                className="font-display uppercase text-xs border-2 border-kp-ink bg-kp-yellow px-3 py-2"
              >
                Ver todos
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase font-display">
                  <tr className="border-b-2 border-kp-ink">
                    <th className="text-left py-2">Fecha</th>
                    <th className="text-left py-2">Cliente</th>
                    <th className="text-left py-2">#</th>
                    <th className="text-left py-2">Estado</th>
                    <th className="text-right py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ultimos.map((o) => (
                    <tr key={o.id} className="border-b border-kp-ink/10">
                      <td className="py-2">
                        {new Date(o.created_at).toLocaleString("es-CO", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="py-2">{o.cliente_nombre}</td>
                      <td className="py-2 font-mono">{o.rp_numero_comanda ?? "—"}</td>
                      <td className="py-2 uppercase text-xs">{o.status}</td>
                      <td className="py-2 text-right font-mono">{fmt(o.total)}</td>
                    </tr>
                  ))}
                  {data.ultimos.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-3 text-center text-kp-ink/60">
                        Sin pedidos en el rango.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </BrutalCard>
        </>
      )}
    </div>
  );
}

function Kpi({
  tone,
  label,
  value,
}: {
  tone: "yellow" | "cheese" | "purple" | "red";
  label: string;
  value: string;
}) {
  return (
    <BrutalCard tone={tone} className="p-4">
      <p className="text-xs font-display uppercase">{label}</p>
      <p className="font-display text-3xl mt-1 leading-none">{value}</p>
    </BrutalCard>
  );
}

function BarList({ data }: { data: { label: string; value: number; meta?: string }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <p className="text-sm text-kp-ink/60">Sin datos.</p>;
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.label} className="text-sm">
          <div className="flex justify-between mb-1">
            <span className="font-display uppercase truncate mr-2">{d.label}</span>
            <span className="font-mono text-xs">{d.meta ?? d.value}</span>
          </div>
          <div className="h-2 border-2 border-kp-ink bg-white overflow-hidden">
            <div className="h-full bg-kp-yellow" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
