import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BrutalCard, BrutalBadge, BrutalChip, BrutalInput, SectionHeading } from "@/components/ui-kp/Brutal";
import { LocationCard } from "@/components/kp/Cards";
import { sedes, ciudades } from "@/data/sedes";

export const Route = createFileRoute("/sedes")({
  head: () => ({
    meta: [
      { title: "Sedes del Reino — KINGPAPA" },
      { name: "description", content: "Encuentra tu KINGPAPA más cercano. Cali, Bogotá, Jamundí, Medellín." },
      { property: "og:title", content: "Sedes del Reino — KINGPAPA" },
      { property: "og:description", content: "Pide, recoge o cae con el parche." },
      { property: "og:url", content: "/sedes" },
    ],
    links: [{ rel: "canonical", href: "/sedes" }],
  }),
  component: SedesPage,
});

function SedesPage() {
  const [q, setQ] = useState("");
  const [ciudad, setCiudad] = useState<string>("todas");
  const [abierto, setAbierto] = useState(false);
  const [pickup, setPickup] = useState(false);
  const [qrMesa, setQrMesa] = useState(false);

  const lista = useMemo(() => {
    return sedes.filter((s) => {
      if (ciudad !== "todas" && s.ciudad !== ciudad) return false;
      if (abierto && !s.abiertaAhora) return false;
      if (pickup && !s.pickup) return false;
      if (qrMesa && !s.qrMesa) return false;
      if (q) {
        const t = q.toLowerCase();
        if (
          !s.nombre.toLowerCase().includes(t) &&
          !s.direccion.toLowerCase().includes(t) &&
          !(s.barrio || "").toLowerCase().includes(t) &&
          !(s.mall || "").toLowerCase().includes(t)
        ) return false;
      }
      return true;
    });
  }, [q, ciudad, abierto, pickup, qrMesa]);

  return (
    <>
      <section className="bg-kp-purple text-kp-cheese border-b-4 border-kp-ink">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-10 md:py-14">
          <BrutalBadge tone="yellow">Sedes</BrutalBadge>
          <h1 className="font-display text-5xl md:text-7xl uppercase mt-3 leading-none">
            Encuentra tu Reino más cercano
          </h1>
          <p className="mt-3 max-w-2xl">Pide, recoge o cae con el parche.</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-6 py-8">
        <div className="grid md:grid-cols-[1fr_auto] gap-3 items-start">
          <BrutalInput
            placeholder="Busca por ciudad, barrio o centro comercial"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            value={ciudad}
            onChange={(e) => setCiudad(e.target.value)}
            className="px-4 py-3 bg-kp-cheese border-2 border-kp-ink shadow-brutal-sm font-body"
          >
            <option value="todas">Todas las ciudades</option>
            {ciudades.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <BrutalChip active={abierto} onClick={() => setAbierto(!abierto)}>Abierto ahora</BrutalChip>
          <BrutalChip active={pickup} onClick={() => setPickup(!pickup)}>Pick-up</BrutalChip>
          <BrutalChip active={qrMesa} onClick={() => setQrMesa(!qrMesa)}>QR en mesa</BrutalChip>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-6 pb-10">
        {lista.length === 0 ? (
          <p className="text-center py-10 font-display uppercase text-2xl">
            No hay sedes que matchen. Cambia el filtro, papi.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lista.map((s) => <LocationCard key={s.id} sede={s} />)}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-6 py-10">
        <SectionHeading eyebrow="¿Nuevo en el Reino?" title="Cómo pedir en KINGPAPA" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { t: "Delivery", d: "Por la app o por nuestra web. Rappi y DiDi también te llevan la corona." },
            { t: "Pick-up", d: "Pide, paga y recoges en sede sin filas. Express." },
            { t: "QR en mesa", d: "En sedes con QR escaneás, pedís y pagás desde el celular." },
          ].map((c) => (
            <BrutalCard key={c.t} tone="cheese" className="p-5">
              <h3 className="font-display text-2xl uppercase">{c.t}</h3>
              <p className="text-sm mt-2">{c.d}</p>
            </BrutalCard>
          ))}
        </div>
      </section>
    </>
  );
}
