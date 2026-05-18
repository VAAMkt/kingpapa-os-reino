import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BrutalBadge } from "@/components/ui-kp/Brutal";
import { EventCard, formatFecha } from "@/components/kp/Cards";
import { getPublicPostBySlug, listPublicPosts } from "@/lib/posts";

export const Route = createFileRoute("/historias/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Historias del Reino` },
      { property: "og:type", content: "article" },
      { property: "og:url", content: `/historias/${params.slug}` },
    ],
    links: [{ rel: "canonical", href: `/historias/${params.slug}` }],
  }),
  component: HistoriaDetalle,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-4xl uppercase">Se nos quemó la papa</h1>
        <p className="mt-2">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-4 inline-block px-6 py-3 bg-kp-ink text-kp-yellow font-display uppercase border-2 border-kp-ink shadow-brutal-sm"
        >Reintentar</button>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-5xl uppercase">Esa historia no está coronada</h1>
      <p className="mt-2 text-sm">Puede que la hayamos archivado, parce.</p>
      <Link
        to="/historias"
        className="mt-5 inline-block px-6 py-3 bg-kp-yellow text-kp-ink font-display uppercase border-2 border-kp-ink shadow-brutal-sm"
      >Ver todas las historias</Link>
    </div>
  ),
});

function HistoriaDetalle() {
  const { slug } = Route.useParams();
  const { data: historia, isLoading } = useQuery({
    queryKey: ["posts", "public", slug],
    queryFn: () => getPublicPostBySlug(slug),
  });
  const { data: todas = [] } = useQuery({
    queryKey: ["posts", "public"],
    queryFn: listPublicPosts,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="font-display uppercase text-sm">Cargando historia…</p>
      </div>
    );
  }

  if (!historia) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-5xl uppercase">Esa historia no está coronada</h1>
        <Link to="/historias" className="mt-5 inline-block px-6 py-3 bg-kp-yellow text-kp-ink font-display uppercase border-2 border-kp-ink shadow-brutal-sm">
          Ver todas las historias
        </Link>
      </div>
    );
  }

  const relacionadas = todas
    .filter((h) => h.slug !== historia.slug && h.categoria === historia.categoria)
    .slice(0, 3);

  return (
    <article>
      <header className="bg-kp-yellow border-b-4 border-kp-ink">
        <div className="mx-auto max-w-4xl px-4 md:px-6 py-8 md:py-12">
          <Link
            to="/historias"
            className="inline-block mb-4 text-sm font-display uppercase underline underline-offset-4"
          >
            ← Volver a Historias
          </Link>
          <div className="flex items-center gap-3 mb-3">
            <BrutalBadge tone="black">{historia.categoria}</BrutalBadge>
            <span className="text-xs font-display uppercase">{formatFecha(historia.fecha)}</span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl uppercase leading-none">
            {historia.titulo}
          </h1>
          <p className="mt-4 text-base md:text-lg max-w-2xl">{historia.extracto}</p>
        </div>
      </header>

      {historia.imagen && (
        <div className="mx-auto max-w-4xl px-4 md:px-6 -mt-2 md:-mt-4">
          <div className="border-2 border-kp-ink shadow-brutal overflow-hidden bg-kp-ink">
            <img
              src={historia.imagen}
              alt={historia.titulo}
              className="w-full h-auto object-cover"
            />
          </div>
        </div>
      )}

      <section className="mx-auto max-w-3xl px-4 md:px-6 py-10 md:py-14">
        {historia.contenidoHtml ? (
          <div
            className="kp-prose"
            dangerouslySetInnerHTML={{ __html: historia.contenidoHtml }}
          />
        ) : (
          <p>{historia.extracto}</p>
        )}

        {historia.link && (
          <p className="mt-10 text-xs text-kp-ink/60">
            Publicado originalmente en{" "}
            <a href={historia.link} target="_blank" rel="noopener noreferrer" className="underline">
              kingpapacali.com
            </a>
          </p>
        )}
      </section>

      {relacionadas.length > 0 && (
        <section className="bg-kp-cheese border-t-4 border-kp-ink">
          <div className="mx-auto max-w-7xl px-4 md:px-6 py-10 md:py-14">
            <h2 className="font-display text-3xl md:text-4xl uppercase mb-6">Más del Reino</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {relacionadas.map((h) => <EventCard key={h.id} historia={h} />)}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
