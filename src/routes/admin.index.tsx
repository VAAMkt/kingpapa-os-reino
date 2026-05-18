import { createFileRoute } from "@tanstack/react-router";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { dashboardMock } from "@/data/dashboard";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  return (
    <div className="space-y-6">
      <header>
        <BrutalBadge tone="yellow">Dashboard</BrutalBadge>
        <h1 className="font-display text-4xl uppercase mt-2 leading-none">Resumen del Reino</h1>
        <p className="text-sm text-kp-ink/70 mt-1">
          Datos simulados. TODO: conectar a pedidos reales en fase 3.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BrutalCard tone="yellow" className="p-4">
          <p className="text-xs font-display uppercase">Pedidos hoy</p>
          <p className="font-display text-3xl">{dashboardMock.pedidosHoy}</p>
        </BrutalCard>
        <BrutalCard tone="cheese" className="p-4">
          <p className="text-xs font-display uppercase">Súbditos nuevos</p>
          <p className="font-display text-3xl">{dashboardMock.subditosNuevos}</p>
        </BrutalCard>
        <BrutalCard tone="purple" className="p-4">
          <p className="text-xs font-display uppercase">Súbditos totales</p>
          <p className="font-display text-3xl">{dashboardMock.subditosTotal}</p>
        </BrutalCard>
        <BrutalCard tone="red" className="p-4">
          <p className="text-xs font-display uppercase">Sedes activas</p>
          <p className="font-display text-3xl">{dashboardMock.sedesTop.length}</p>
        </BrutalCard>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <BrutalCard tone="cheese" className="p-5">
          <h2 className="font-display text-xl uppercase mb-3">Pedidos por canal</h2>
          <ul className="space-y-2">
            {dashboardMock.pedidosPorCanal.map((c) => (
              <li key={c.canal} className="flex items-center gap-2 text-sm">
                <span className={`inline-block w-3 h-3 border-2 border-kp-ink ${c.color}`} />
                <span className="flex-1 font-display uppercase">{c.canal}</span>
                <span className="font-mono">{c.valor}</span>
              </li>
            ))}
          </ul>
        </BrutalCard>
        <BrutalCard tone="cheese" className="p-5">
          <h2 className="font-display text-xl uppercase mb-3">Sedes top</h2>
          <ul className="space-y-1 text-sm">
            {dashboardMock.sedesTop.map((s) => (
              <li key={s.sede} className="flex justify-between">
                <span className="font-display uppercase">{s.sede}</span>
                <span className="font-mono">{s.pedidos}</span>
              </li>
            ))}
          </ul>
        </BrutalCard>
      </div>
    </div>
  );
}
