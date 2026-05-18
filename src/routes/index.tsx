import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { BrutalCard, BrutalBadge, SectionHeading } from "@/components/ui-kp/Brutal";
import { BrutalLink } from "@/components/ui-kp/BrutalButton";
import { OrderRouter } from "@/components/kp/OrderRouter";
import { ProductCard } from "@/components/kp/ProductCard";
import { TrackerOperativo } from "@/components/kp/TrackerOperativo";
import { LoyaltyModule } from "@/components/kp/LoyaltyModule";
import { EventCard, LocationCard } from "@/components/kp/Cards";
import { Testimonios } from "@/components/kp/Testimonios";
import { listPublicSedes } from "@/lib/sedes";
import { listPublicPosts } from "@/lib/posts";
import { getMenuForSede } from "@/lib/rp.functions";
import { rpProductoToProducto, type RpCategoriaRow, type RpProductoRow } from "@/lib/menu";
import heroImg from "@/assets/hero-salchipapa.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KINGPAPA — El Reino" },
      { name: "description", content: "Los REYES de esta pendeja’. Pide, corónate y conviértete en súbdito del Reino KINGPAPA." },
      { property: "og:title", content: "KINGPAPA — El Reino" },
      { property: "og:description", content: "Salchipapas monstruosas, bowls coronados y retos para verdaderos súbditos." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: HomePage,
});

function HomePage() {
  const { data: sedesData = [] } = useQuery({ queryKey: ["sedes", "public"], queryFn: listPublicSedes, staleTime: 60_000 });
  const sedesResumen = sedesData.slice(0, 4);
  const defaultSedeSlug = sedesData[0]?.slug;

  const fetchMenu = useServerFn(getMenuForSede);
  const menuQ = useQuery({
    queryKey: ["menu", defaultSedeSlug],
    queryFn: () => fetchMenu({ data: { sedeSlug: defaultSedeSlug! } }),
    enabled: !!defaultSedeSlug,
    staleTime: 60_000,
  });

  const estrellas = useMemo(() => {
    const cats = (menuQ.data?.categorias ?? []) as RpCategoriaRow[];
    const prods = (menuQ.data?.productos ?? []) as RpProductoRow[];
    const catsById = new Map(cats.map((c) => [c.id, c]));
    return prods
      .filter((p) => p.disponible)
      .slice(0, 4)
      .map((p) => rpProductoToProducto(p, catsById));
  }, [menuQ.data]);

  const { data: posts = [] } = useQuery({ queryKey: ["posts", "public"], queryFn: listPublicPosts, staleTime: 60_000 });
  const retos = posts.filter((h) => h.categoria === "Retos" || h.categoria === "Festivales").slice(0, 3);

  return (
    <>
      {/* HERO */}
      <section className="bg-kp-yellow border-b-4 border-kp-ink relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-10 md:py-16 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="flex flex-wrap gap-2 mb-4">
              <BrutalBadge tone="black">Cali</BrutalBadge>
              <BrutalBadge tone="black">Bogotá</BrutalBadge>
              <BrutalBadge tone="black">Jamundí</BrutalBadge>
              <BrutalBadge tone="black">Medallo</BrutalBadge>
            </div>
            <h1 className="font-display text-6xl sm:text-7xl md:text-8xl uppercase leading-[0.85] text-kp-ink">
              Los REYES<br />de esta<br />pendeja’
            </h1>
            <p className="mt-5 text-base md:text-lg max-w-md border-l-4 border-kp-ink pl-3">
              Salchipapas monstruosas, bowls coronados y retos que solo un verdadero
              súbdito del Reino se atreve a probar.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <BrutalLink href="#pedir" variant="dark" size="lg">
                Pedir AHORA
              </BrutalLink>
              <BrutalLink href="#loyalty" variant="ghost" size="lg">
                Hacerme súbdito del Reino
              </BrutalLink>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -top-4 left-2 z-10">
              <BrutalBadge tone="red" className="text-base">¡TAMAÑO MONSTRUO!</BrutalBadge>
            </div>
            <div className="aspect-square bg-kp-ink border-2 border-kp-ink shadow-brutal-lg overflow-hidden">
              <img
                src={heroImg}
                alt="Salchipapa monstruosa KINGPAPA"
                width={1280}
                height={1280}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ORDER ROUTER */}
      <section id="pedir" className="mx-auto max-w-7xl px-4 md:px-6 py-12">
        <OrderRouter />
      </section>

      {/* PRODUCTOS ESTRELLA */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-10">
        <SectionHeading
          eyebrow="Coronados del Reino"
          title="Los más bravos del menú"
          description="Lo que pides cuando vas en serio. Sin filtros, sin remordimientos."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {estrellas.map((p) => (
            <ProductCard key={p.id} producto={p} />
          ))}
        </div>
        <div className="mt-6">
          <Link
            to="/menu"
            className="font-display uppercase underline underline-offset-4 decoration-4 decoration-kp-yellow"
          >
            Ver el menú completo →
          </Link>
        </div>
      </section>

      {/* TRACKER */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-10">
        <TrackerOperativo />
      </section>

      {/* RETOS / FESTIVALES */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-10">
        <SectionHeading
          eyebrow="Cultura del Reino"
          title="Retos, festivales y locuras"
          description="Lo que pasa en el Reino, queda coronado."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {retos.map((h) => (
            <EventCard key={h.id} historia={h} />
          ))}
        </div>
      </section>

      {/* LOYALTY */}
      <section id="loyalty" className="mx-auto max-w-7xl px-4 md:px-6 py-12">
        <LoyaltyModule />
      </section>

      {/* SEDES RESUMEN */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-10">
        <SectionHeading
          eyebrow="Tu Reino más cercano"
          title="Encuentra tu castillo"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {sedesResumen.map((s) => (
            <LocationCard key={s.id} sede={s} />
          ))}
        </div>
        <div className="mt-6">
          <Link
            to="/sedes"
            className="font-display uppercase underline underline-offset-4 decoration-4 decoration-kp-yellow"
          >
            Ver todas las sedes del Reino →
          </Link>
        </div>
      </section>

      {/* TESTIMONIOS */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-12">
        <Testimonios />
      </section>
    </>
  );
}
