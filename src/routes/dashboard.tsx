import { createFileRoute } from "@tanstack/react-router";
import { BrutalCard, BrutalBadge, SectionHeading } from "@/components/ui-kp/Brutal";
import { dashboardMock } from "@/data/dashboard";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "KINGPAPA OS · Dashboard" },
      { name: "description", content: "Panel interno del Reino." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const d = dashboardMock;
  const maxCanal = Math.max(...d.pedidosPorCanal.map((c) => c.valor));
  const maxSede = Math.max(...d.sedesTop.map((s) => s.pedidos));
  const maxProd = Math.max(...d.productosTop.map((p) => p.vendidos));

  return (
    <section className="mx-auto max-w-7xl px-4 md:px-6 py-10">
      <div className="flex items-center gap-3 mb-6">
        <BrutalBadge tone="yellow">Interno</BrutalBadge>
        <span className="font-display uppercase text-sm text-kp-ink/70">KINGPAPA OS</span>
      </div>
      <SectionHeading
        title="Dashboard del Reino"
        description="Panel operativo en tiempo real (mock). TODO: enchufar al backend cuando esté listo."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Pedidos hoy" value={d.pedidosHoy.toLocaleString("es-CO")} tone="yellow" />
        <KpiCard label="Súbditos nuevos" value={`+${d.subditosNuevos}`} tone="purple" />
        <KpiCard label="Súbditos totales" value={d.subditosTotal.toLocaleString("es-CO")} tone="black" />
        <KpiCard label="Sedes activas" value={String(d.sedesTop.length + 1)} tone="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BrutalCard tone="cheese" className="p-5 lg:col-span-1">
          <h3 className="font-display text-xl uppercase mb-4">Pedidos por canal</h3>
          <ul className="space-y-3">
            {d.pedidosPorCanal.map((c) => (
              <li key={c.canal}>
                <div className="flex justify-between text-xs font-display uppercase">
                  <span>{c.canal}</span>
                  <span>{c.valor}</span>
                </div>
                <div className="h-3 mt-1 bg-kp-cheese border-2 border-kp-ink overflow-hidden">
                  <div
                    className={`h-full bg-${c.color}`}
                    style={{ width: `${(c.valor / maxCanal) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </BrutalCard>

        <BrutalCard tone="cheese" className="p-5">
          <h3 className="font-display text-xl uppercase mb-4">Sedes top</h3>
          <ul className="space-y-3">
            {d.sedesTop.map((s) => (
              <li key={s.sede}>
                <div className="flex justify-between text-xs font-display uppercase">
                  <span>{s.sede}</span>
                  <span>{s.pedidos}</span>
                </div>
                <div className="h-3 mt-1 bg-kp-cheese border-2 border-kp-ink overflow-hidden">
                  <div
                    className="h-full bg-kp-yellow"
                    style={{ width: `${(s.pedidos / maxSede) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </BrutalCard>

        <BrutalCard tone="cheese" className="p-5">
          <h3 className="font-display text-xl uppercase mb-4">Productos top</h3>
          <ul className="space-y-3">
            {d.productosTop.map((p) => (
              <li key={p.producto}>
                <div className="flex justify-between text-xs font-display uppercase">
                  <span>{p.producto}</span>
                  <span>{p.vendidos}</span>
                </div>
                <div className="h-3 mt-1 bg-kp-cheese border-2 border-kp-ink overflow-hidden">
                  <div
                    className="h-full bg-kp-red"
                    style={{ width: `${(p.vendidos / maxProd) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </BrutalCard>
      </div>
    </section>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone: "yellow" | "purple" | "black" | "red" }) {
  return (
    <BrutalCard tone={tone} className="p-4">
      <p className="text-xs font-display uppercase tracking-wider opacity-80">{label}</p>
      <p className="font-display text-4xl md:text-5xl mt-1 leading-none">{value}</p>
    </BrutalCard>
  );
}
