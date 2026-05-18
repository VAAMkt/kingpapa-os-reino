import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BrutalCard, BrutalBadge, BrutalChip, BrutalInput, SectionHeading } from "@/components/ui-kp/Brutal";
import { BrutalLink } from "@/components/ui-kp/BrutalButton";
import { LocationCard } from "@/components/kp/Cards";
import { listPublicSedes } from "@/lib/sedes";

export const Route = createFileRoute("/sedes")({
  head: () => ({
    meta: [
      { title: "Sedes del Reino — KINGPAPA" },
      { name: "description", content: "15 sedes y creciendo. Encuentra tu KINGPAPA en Cali, Jamundí y Bogotá. Pide directo en la web o cae con el parche." },
      { property: "og:title", content: "Sedes del Reino — KINGPAPA" },
      { property: "og:description", content: "15 sedes en Cali, Jamundí y Bogotá. Encuentra tu castillo más cercano." },
      { property: "og:url", content: "/sedes" },
    ],
    links: [{ rel: "canonical", href: "/sedes" }],
  }),
  component: SedesPage,
});

function SedesPage() {
  const { data: sedes = [], isLoading } = useQuery({
    queryKey: ["sedes", "public"],
    queryFn: listPublicSedes,
    staleTime: 60_000,
  });

  const [q, setQ] = useState("");
  const [ciudad, setCiudad] = useState<string>("todas");
  const [abierto, setAbierto] = useState(false);
  const [pickup, setPickup] = useState(false);
  const [qrMesa, setQrMesa] = useState(false);

  const ciudades = useMemo(
    () => Array.from(new Set(sedes.map((s) => s.ciudad))).sort(),
    [sedes],
  );

  const lista = useMemo(() => {
    return sedes.filter((s) => {
      if (ciudad !== "todas" && s.ciudad !== ciudad) return false;
      if (abierto && !s.abierta_ahora) return false;
      if (pickup && !s.pickup) return false;
      if (qrMesa && !s.qr_mesa) return false;
      if (q) {
        const t = q.toLowerCase();
        if (
          !s.nombre.toLowerCase().includes(t) &&
          !s.direccion.toLowerCase().includes(t) &&
          !(s.barrio || "").toLowerCase().includes(t) &&
          !(s.mall || "").toLowerCase().includes(t) &&
          !s.ciudad.toLowerCase().includes(t)
        )
          return false;
      }
      return true;
    });
  }, [sedes, q, ciudad, abierto, pickup, qrMesa]);

  const totalSedes = sedes.length;
  const totalCiudades = ciudades.length;

  return (
    <>
      <section className="bg-kp-purple text-kp-cheese border-b-4 border-kp-ink">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-10 md:py-14">
          <BrutalBadge tone="yellow">Sedes</BrutalBadge>
          <h1 className="font-display text-5xl md:text-7xl uppercase mt-3 leading-none">
            Encuentra tu Reino más cercano
          </h1>
          <p className="mt-3 max-w-2xl">
            {totalSedes} sedes activas en {totalCiudades} {totalCiudades === 1 ? "ciudad" : "ciudades"}. Pide directo, recoge o cae con el parche.
          </p>
        </div>
      </section>

      {/* STATS DEL REINO */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BrutalCard tone="yellow" className="p-5">
            <div className="font-display text-5xl md:text-6xl leading-none">{totalSedes}</div>
            <div className="font-display uppercase text-xs mt-2">Sedes activas</div>
          </BrutalCard>
          <BrutalCard tone="cheese" className="p-5">
            <div className="font-display text-5xl md:text-6xl leading-none">{totalCiudades}</div>
            <div className="font-display uppercase text-xs mt-2">Ciudades del Reino</div>
          </BrutalCard>
          <BrutalCard tone="red" className="p-5">
            <div className="font-display text-5xl md:text-6xl leading-none">50</div>
            <div className="font-display uppercase text-xs mt-2">Meta 2030 · expansión</div>
          </BrutalCard>
        </div>
      </section>

      {/* FILTROS */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-4">
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
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <BrutalChip active={abierto} onClick={() => setAbierto(!abierto)}>Abierto ahora</BrutalChip>
          <BrutalChip active={pickup} onClick={() => setPickup(!pickup)}>Pick-up</BrutalChip>
          <BrutalChip active={qrMesa} onClick={() => setQrMesa(!qrMesa)}>QR en mesa</BrutalChip>
        </div>
      </section>

      {/* LISTADO */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 pb-10">
        {isLoading ? (
          <p className="text-center py-10 font-display uppercase text-xl">Cargando sedes…</p>
        ) : lista.length === 0 ? (
          <p className="text-center py-10 font-display uppercase text-2xl">
            No hay sedes que matchen. Cambia el filtro, papi.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lista.map((s) => (
              <LocationCard key={s.id} sede={s} />
            ))}
          </div>
        )}
      </section>

      {/* CÓMO PEDIR */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-10">
        <SectionHeading eyebrow="¿Nuevo en el Reino?" title="Cómo pedir en KINGPAPA" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { t: "Delivery", d: "Por nuestra web o por Rappi y DiDi. La corona llega a tu puerta." },
            { t: "Pick-up", d: "Pide, paga y recoges en sede sin filas. Express y sin esperar mesa." },
            { t: "QR en mesa", d: "En sedes con QR escaneás, pedís y pagás desde el celular." },
          ].map((c) => (
            <BrutalCard key={c.t} tone="cheese" className="p-5">
              <h3 className="font-display text-2xl uppercase">{c.t}</h3>
              <p className="text-sm mt-2">{c.d}</p>
            </BrutalCard>
          ))}
        </div>
      </section>

      {/* CTA FRANQUICIAS */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-12">
        <BrutalCard tone="purple" className="p-6 md:p-10">
          <div className="grid md:grid-cols-[2fr_1fr] gap-6 items-center">
            <div>
              <BrutalBadge tone="yellow">Franquicias</BrutalBadge>
              <h2 className="font-display text-4xl md:text-6xl uppercase mt-3 leading-none">
                ¿Falta una corona en tu ciudad?
              </h2>
              <p className="mt-4 text-kp-cheese/90 max-w-xl">
                El Reino va por <strong>50 sedes en 2030</strong>. Si quieres traer KINGPAPA a tu zona, sé pionero: condiciones especiales, marca con +3M de comunidad y operación probada.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                to="/franquicias"
                className="inline-flex items-center justify-center font-display uppercase tracking-wide border-2 border-kp-ink shadow-brutal-sm bg-kp-yellow text-kp-ink px-6 py-4 text-base transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:-translate-y-[1px]"
              >
                Quiero ser parte del Reino →
              </Link>
              <BrutalLink href="/franquicias" variant="ghost" size="md">
                Ver propuesta de franquicia
              </BrutalLink>
            </div>
          </div>
        </BrutalCard>
      </section>
    </>
  );
}
