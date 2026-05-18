import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BrutalCard, BrutalBadge, BrutalChip } from "@/components/ui-kp/Brutal";
import { BrutalLink } from "@/components/ui-kp/BrutalButton";
import { OrderRouter } from "@/components/kp/OrderRouter";
import { ProductCard } from "@/components/kp/ProductCard";
import { categorias, productos } from "@/data/productos";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menú del Reino — KINGPAPA" },
      { name: "description", content: "Escoge tu corona según tu hambre, tu parche y tu antojo." },
      { property: "og:title", content: "Menú del Reino — KINGPAPA" },
      { property: "og:description", content: "Salchipapas, bowls, combos imán y retos brutales." },
      { property: "og:url", content: "/menu" },
    ],
    links: [{ rel: "canonical", href: "/menu" }],
  }),
  component: MenuPage,
});

function MenuPage() {
  const [filtro, setFiltro] = useState<string>("all");

  const lista = useMemo(() => {
    if (filtro === "all") return productos;
    return productos.filter((p) => p.categorias.includes(filtro));
  }, [filtro]);

  return (
    <>
      {/* HERO */}
      <section className="bg-kp-red text-kp-cheese border-b-4 border-kp-ink">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-10 md:py-14">
          <BrutalBadge tone="yellow">Menú</BrutalBadge>
          <h1 className="font-display text-5xl md:text-7xl uppercase mt-3 leading-none">
            El Menú del Reino
          </h1>
          <p className="mt-3 max-w-2xl">
            Escoge tu corona según tu hambre, tu parche y tu antojo. Sin diplomacia.
          </p>
          <div className="mt-5">
            <BrutalLink href="#pedir" variant="primary" size="lg">
              Pedir ahora
            </BrutalLink>
          </div>
        </div>
      </section>

      <section id="pedir" className="mx-auto max-w-7xl px-4 md:px-6 py-10">
        <OrderRouter />
      </section>

      {/* FILTROS */}
      <section className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1">
          {categorias.map((c) => (
            <BrutalChip
              key={c.id}
              active={filtro === c.id}
              onClick={() => setFiltro(c.id)}
            >
              {c.filtro}
            </BrutalChip>
          ))}
        </div>
      </section>

      {/* GRID */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-8">
        {lista.length === 0 ? (
          <p className="text-center py-10 font-display uppercase text-2xl">
            No hay productos en esta categoría… aún.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lista.map((p) => (
              <ProductCard key={p.id} producto={p} />
            ))}
          </div>
        )}
      </section>

      {/* COMBO IMÁN */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-12">
        <BrutalCard tone="purple" className="p-6 md:p-8 flex flex-col md:flex-row gap-6 items-center">
          <div className="flex-1">
            <BrutalBadge tone="yellow">Solo web · Lun a Mié</BrutalBadge>
            <h2 className="font-display text-4xl md:text-5xl uppercase mt-3 leading-none">
              Combo Imán del Reino
            </h2>
            <p className="mt-3 text-sm">
              Salchipapa mediana + bebida + brownie por menos de lo que cuesta un domicilio.
              Sólo si pides desde la web, parce. No se lo cuentes a Rappi.
            </p>
            <p className="font-display text-5xl mt-3">$19.900</p>
          </div>
          <BrutalLink href="#pedir" variant="primary" size="lg">
            Reclamar combo
          </BrutalLink>
        </BrutalCard>
      </section>
    </>
  );
}
