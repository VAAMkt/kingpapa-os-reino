import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BrutalBadge, BrutalChip } from "@/components/ui-kp/Brutal";
import { EventCard } from "@/components/kp/Cards";
import { listPublicPosts } from "@/lib/posts";
import type { CategoriaHistoria } from "@/types/kp";

const cats: ("Todas" | CategoriaHistoria)[] = [
  "Todas", "Retos", "Festivales", "Cultura interna", "Fans", "Sostenibilidad", "Franquicias", "Nuevas sedes",
];

export const Route = createFileRoute("/historias")({
  head: () => ({
    meta: [
      { title: "Historias del Reino — KINGPAPA" },
      { name: "description", content: "Retos, festivales, fans, cultura caleña y locuras que merecen quedar coronadas." },
      { property: "og:title", content: "Historias del Reino — KINGPAPA" },
      { property: "og:description", content: "Lo que pasa en el Reino, queda coronado." },
      { property: "og:url", content: "/historias" },
    ],
    links: [{ rel: "canonical", href: "/historias" }],
  }),
  component: HistoriasPage,
});

function HistoriasPage() {
  const [cat, setCat] = useState<"Todas" | CategoriaHistoria>("Todas");
  const { data: historias = [], isLoading, error } = useQuery({
    queryKey: ["posts", "public"],
    queryFn: listPublicPosts,
  });

  const lista = useMemo(
    () => (cat === "Todas" ? historias : historias.filter((h) => h.categoria === cat)),
    [cat, historias],
  );

  return (
    <>
      <section className="bg-kp-yellow border-b-4 border-kp-ink">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-10 md:py-14">
          <BrutalBadge tone="black">Archivo oficial</BrutalBadge>
          <h1 className="font-display text-5xl md:text-7xl uppercase mt-3 leading-none">
            Historias del Reino
          </h1>
          <p className="mt-3 max-w-2xl">
            Retos, festivales, fans, cultura caleña y locuras que merecen quedar coronadas.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-6 py-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {cats.map((c) => (
            <BrutalChip key={c} active={cat === c} onClick={() => setCat(c)}>
              {c}
            </BrutalChip>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-6 pb-12">
        {isLoading ? (
          <p className="font-display uppercase text-sm">Cargando historias…</p>
        ) : error ? (
          <p className="text-sm text-kp-red">No pudimos cargar las historias.</p>
        ) : lista.length === 0 ? (
          <p className="text-sm">Aún no hay historias en esta categoría.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lista.map((h) => <EventCard key={h.id} historia={h} />)}
          </div>
        )}
      </section>
    </>
  );
}
