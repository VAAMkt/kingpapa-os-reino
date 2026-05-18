import { createFileRoute } from "@tanstack/react-router";
import { BrutalCard, BrutalBadge, SectionHeading } from "@/components/ui-kp/Brutal";
import { BrutalLink } from "@/components/ui-kp/BrutalButton";
import { LeadFormFranquicia } from "@/components/kp/LeadFormFranquicia";

export const Route = createFileRoute("/franquicias")({
  head: () => ({
    meta: [
      { title: "Franquicias — KINGPAPA" },
      { name: "description", content: "Expandamos el Reino juntos. KINGPAPA no vende solo salchipapas: vende cultura, comunidad y operación escalable." },
      { property: "og:title", content: "Franquicias — KINGPAPA" },
      { property: "og:description", content: "Aplica para abrir una sede del Reino en tu ciudad." },
      { property: "og:url", content: "/franquicias" },
    ],
    links: [{ rel: "canonical", href: "/franquicias" }],
  }),
  component: FranquiciasPage,
});

function FranquiciasPage() {
  return (
    <>
      <section className="bg-kp-ink text-kp-cheese border-b-4 border-kp-ink">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-12 md:py-20">
          <BrutalBadge tone="yellow">Franquicias</BrutalBadge>
          <h1 className="font-display text-5xl md:text-8xl uppercase mt-3 leading-[0.9] text-kp-yellow">
            Expandamos el<br/>Reino juntos
          </h1>
          <p className="mt-5 max-w-2xl text-base md:text-lg">
            KINGPAPA no vende solo salchipapas. Vende cultura, comunidad, hambre brava
            y operación escalable.
          </p>
          <div className="mt-6">
            <BrutalLink href="#aplicar" variant="primary" size="lg">
              Quiero invertir en el Reino
            </BrutalLink>
          </div>
        </div>
      </section>

      {/* Lo que nadie te cuenta */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-12">
        <SectionHeading eyebrow="Lo que nadie te cuenta" title="Por qué KINGPAPA funciona" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { t: "Marca viral", d: "Tono caleño, retos virales y fandom propio. No vendes papas: vendes pertenecer al Reino." },
            { t: "Operación escalable", d: "Ficha técnica, BOH eficiente, costos controlados, prep tiempo < 8 min." },
            { t: "Productos hit", d: "Top sellers con margen > 65%. Combos diseñados para ticket alto." },
            { t: "Data-first", d: "KINGPAPA OS te entrega CRM, loyalty y panel de pedidos. No operas a ciegas." },
          ].map((c) => (
            <BrutalCard key={c.t} tone="yellow" className="p-5">
              <h3 className="font-display text-2xl uppercase">{c.t}</h3>
              <p className="text-sm mt-2">{c.d}</p>
            </BrutalCard>
          ))}
        </div>
      </section>

      {/* Futuro del Reino */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-12">
        <SectionHeading eyebrow="Futuro del Reino" title="Mapa de expansión" />
        <BrutalCard tone="cheese" className="p-5 md:p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { c: "Cali", e: "3 sedes activas", t: "lime" as const },
              { c: "Jamundí", e: "1 sede activa", t: "lime" as const },
              { c: "Bogotá", e: "1 sede + 2 en proceso", t: "yellow" as const },
              { c: "Medellín", e: "1 sede activa", t: "lime" as const },
              { c: "Pereira", e: "Buscando socio", t: "red" as const },
              { c: "Barranquilla", e: "Buscando socio", t: "red" as const },
              { c: "Bucaramanga", e: "2026", t: "purple" as const },
              { c: "Miami", e: "2027 (sueño)", t: "purple" as const },
            ].map((x) => (
              <div key={x.c} className="border-2 border-kp-ink p-3 text-center">
                <p className="font-display text-2xl uppercase">{x.c}</p>
                <BrutalBadge tone={x.t} className="mt-2">{x.e}</BrutalBadge>
              </div>
            ))}
          </div>
        </BrutalCard>
      </section>

      {/* Lead form */}
      <section id="aplicar" className="mx-auto max-w-3xl px-4 md:px-6 py-12">
        <LeadFormFranquicia />
      </section>

      {/* BIC / cultura */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-12">
        <SectionHeading eyebrow="Cultura BIC" title="Impacto del Reino" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { t: "Empleo digno", d: "Más de 80 súbditos en nómina, capacitación constante y plan carrera." },
            { t: "Proveedores locales", d: "Papa, chorizo y queso de productores del Valle y Cundinamarca." },
            { t: "Comunidad caleña", d: "Patrocinamos parches barriales, ligas amateur y festivales urbanos." },
          ].map((c) => (
            <BrutalCard key={c.t} tone="purple" className="p-5">
              <h3 className="font-display text-2xl uppercase">{c.t}</h3>
              <p className="text-sm mt-2">{c.d}</p>
            </BrutalCard>
          ))}
        </div>
      </section>
    </>
  );
}
