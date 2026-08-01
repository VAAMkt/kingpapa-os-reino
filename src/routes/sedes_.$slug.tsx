import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { BrutalBadge, BrutalCard } from "@/components/ui-kp/Brutal";
import { BrutalLink } from "@/components/ui-kp/BrutalButton";
import { getSedeBySlug, type SedeRow } from "@/lib/sedes";
import { GoogleRatingBadge } from "@/components/kp/Cards";
import { SITE_URL } from "@/lib/seo-schema";

const sedeQuery = (slug: string) => ({
  queryKey: ["sedes", "public", "slug", slug],
  queryFn: async () => {
    const sede = await getSedeBySlug(slug);
    if (!sede) throw notFound();
    return sede;
  },
  staleTime: 60_000,
});

function mapsHrefFor(sede: SedeRow): string {
  return (
    sede.maps_url ||
    `https://www.google.com/maps/search/${encodeURIComponent(`${sede.direccion} ${sede.ciudad}`)}`
  );
}

function zona(sede: SedeRow): string {
  return sede.barrio || sede.mall || "";
}

/** Nombre completo sin duplicar la marca (varias sedes ya se llaman "KINGPAPA ..."). */
function nombreMarca(sede: SedeRow): string {
  return /^kingpapa/i.test(sede.nombre.trim()) ? sede.nombre.trim() : `KINGPAPA ${sede.nombre}`;
}

export const Route = createFileRoute("/sedes_/$slug")({
  loader: async ({ params, context }) => {
    const sede = await context.queryClient.ensureQueryData(sedeQuery(params.slug));
    return { sede };
  },
  head: ({ loaderData, params }) => {
    const url = `${SITE_URL}/sedes/${params.slug}`;
    const sede = loaderData?.sede;

    if (!sede) {
      return {
        meta: [
          { title: "Sede no disponible — KINGPAPA" },
          { name: "robots", content: "noindex" },
        ],
        links: [{ rel: "canonical", href: url }],
      };
    }

    const marca = nombreMarca(sede);
    const title = `${marca} — Salchipapas en ${sede.ciudad}`.slice(0, 60);
    const z = zona(sede);
    const desc = (
      `${marca}: ${sede.direccion}${z ? `, ${z}` : ""}, ${sede.ciudad}. ` +
      `Salchipapas a domicilio, para recoger y en mesa.`
    ).slice(0, 155);


    const restaurant: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Restaurant",
      "@id": `${url}#restaurant`,
      name: marca,
      url,
      address: {
        "@type": "PostalAddress",
        streetAddress: sede.direccion,
        addressLocality: sede.ciudad,
        addressRegion: sede.ciudad,
        addressCountry: "CO",
      },
      servesCuisine: ["Colombian", "Fast Food", "Salchipapa"],
      openingHours: sede.horario,
      priceRange: "$$",
      ...(sede.whatsapp ? { telephone: sede.whatsapp } : {}),
      ...(sede.lat != null && sede.lng != null
        ? { geo: { "@type": "GeoCoordinates", latitude: sede.lat, longitude: sede.lng } }
        : {}),
      ...(sede.maps_url ? { hasMap: sede.maps_url } : {}),
      ...(sede.google_rating != null && sede.google_reviews_count != null
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: Number(sede.google_rating),
              reviewCount: Number(sede.google_reviews_count),
              bestRating: 5,
              worstRating: 1,
            },
          }
        : {}),
      parentOrganization: { "@type": "Organization", name: "KINGPAPA", url: SITE_URL },
    };

    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Sedes", item: `${SITE_URL}/sedes` },
        { "@type": "ListItem", position: 3, name: sede.nombre, item: url },
      ],
    };

    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:type", content: "business.business" },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(restaurant) },
        { type: "application/ld+json", children: JSON.stringify(breadcrumb) },
      ],
    };
  },
  component: SedeDetalle,
  notFoundComponent: SedeNoEncontrada,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-4xl uppercase">Se nos quemó la papa</h1>
        <p className="mt-2">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-4 inline-block px-6 py-3 bg-kp-ink text-kp-yellow font-display uppercase border-2 border-kp-ink shadow-brutal-sm"
        >
          Reintentar
        </button>
      </div>
    );
  },
});

function SedeNoEncontrada() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-4xl uppercase">Esta sede no está en el mapa</h1>
      <p className="mt-2">Puede que haya cambiado de nombre o que aún no esté publicada.</p>
      <Link
        to="/sedes"
        className="mt-6 inline-block px-6 py-3 bg-kp-yellow text-kp-ink font-display uppercase border-2 border-kp-ink shadow-brutal-sm"
      >
        Ver todas las sedes
      </Link>
    </div>
  );
}

function SedeDetalle() {
  const { slug } = Route.useParams();
  const { data: sede } = useSuspenseQuery(sedeQuery(slug));

  const servicios = [
    sede.delivery && "Delivery",
    sede.pickup && "Pick-up",
    sede.qr_mesa && "QR mesa",
  ].filter(Boolean) as string[];

  const z = zona(sede);

  return (
    <>
      <section className="bg-kp-purple text-kp-cheese border-b-4 border-kp-ink">
        <div className="mx-auto max-w-5xl px-4 md:px-6 py-8 md:py-12">
          <nav aria-label="Ruta de navegación" className="text-xs font-display uppercase">
            <ol className="flex flex-wrap items-center gap-1">
              <li>
                <Link to="/" className="underline underline-offset-2">
                  Inicio
                </Link>
              </li>
              <li aria-hidden="true">›</li>
              <li>
                <Link to="/sedes" className="underline underline-offset-2">
                  Sedes
                </Link>
              </li>
              <li aria-hidden="true">›</li>
              <li aria-current="page">{sede.nombre}</li>
            </ol>
          </nav>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <BrutalBadge tone={sede.abierta_ahora ? "lime" : "black"}>
              {sede.abierta_ahora ? "Abierto ahora" : "Cerrado"}
            </BrutalBadge>
            <BrutalBadge tone="yellow">{sede.ciudad}</BrutalBadge>
            <GoogleRatingBadge
              rating={sede.google_rating}
              reviews={sede.google_reviews_count}
            />
          </div>

          <h1 className="font-display text-4xl md:text-6xl uppercase mt-3 leading-none">
            {nombreMarca(sede)}
          </h1>
          <p className="mt-3 max-w-2xl">
            {sede.direccion}
            {z ? ` · ${z}` : ""} · {sede.ciudad}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 md:px-6 py-8 grid gap-4 md:grid-cols-2">
        <BrutalCard tone="cheese" className="p-5">
          <h2 className="font-display text-2xl uppercase leading-none">Horario</h2>
          <p className="mt-2 font-display uppercase text-sm">{sede.horario}</p>

          <h2 className="font-display text-2xl uppercase leading-none mt-6">Servicios</h2>
          <div className="mt-2 flex flex-wrap gap-1">
            {servicios.length === 0 ? (
              <span className="text-sm">Consulta disponibilidad en la sede.</span>
            ) : (
              servicios.map((s) => (
                <span
                  key={s}
                  className="text-[11px] font-display uppercase bg-kp-ink text-kp-cheese px-2 py-1"
                >
                  {s}
                </span>
              ))
            )}
          </div>

          {sede.whatsapp ? (
            <p className="mt-6 text-sm">
              WhatsApp:{" "}
              <a
                className="underline underline-offset-2 font-display"
                href={`https://wa.me/${sede.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {sede.whatsapp}
              </a>
            </p>
          ) : null}
        </BrutalCard>

        <BrutalCard tone="yellow" className="p-5 flex flex-col justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl uppercase leading-none">Pedí en esta sede</h2>
            <p className="mt-2 text-sm">
              Armá tu corona en el menú de {sede.nombre} y te la mandamos calientica.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Link
              to="/menu"
              search={{ sede: sede.slug }}
              className="inline-flex items-center justify-center gap-2 font-display tracking-wide uppercase border-2 border-kp-ink shadow-brutal-sm bg-kp-ink text-kp-yellow px-4 py-3 text-sm transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:-translate-y-[1px]"
            >
              Pedir aquí
            </Link>
            <BrutalLink href={mapsHrefFor(sede)} external size="sm" variant="ghost">
              Cómo llegar
            </BrutalLink>
          </div>
        </BrutalCard>
      </section>

      <section className="mx-auto max-w-5xl px-4 md:px-6 pb-14">
        <Link to="/sedes" className="font-display uppercase text-sm underline underline-offset-4">
          ← Ver todas las sedes del Reino
        </Link>
      </section>
    </>
  );
}
