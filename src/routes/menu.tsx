import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BrutalCard, BrutalBadge, BrutalChip } from "@/components/ui-kp/Brutal";
import { BrutalLink } from "@/components/ui-kp/BrutalButton";
import { OrderRouter } from "@/components/kp/OrderRouter";
import { ProductCard } from "@/components/kp/ProductCard";
import { OrderIntentDialog } from "@/components/kp/OrderIntentDialog";
import { getMenuForSede } from "@/lib/rp.functions";
import { listPublicSedes } from "@/lib/sedes";
import { rpProductoToProducto, buildCategorias, type RpCategoriaRow, type RpProductoRow } from "@/lib/menu";
import { useActiveSede, setExploringSede } from "@/lib/active-sede";

export const Route = createFileRoute("/menu")({
  validateSearch: (search: Record<string, unknown>) => ({
    sede: typeof search.sede === "string" ? search.sede : undefined,
  }),
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
  const { sede: sedeParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [filtro, setFiltro] = useState<string>("all");

  const sedesQ = useQuery({ queryKey: ["sedes", "public"], queryFn: listPublicSedes, staleTime: 60_000 });
  const sedes = sedesQ.data ?? [];
  const activeSede = useActiveSede();

  // CRAVING FIRST: si no hay sede activa, auto-seleccionamos "vitrina" para
  // que el menú renderice sin pedir ubicación. El gate solo se abre al pedir.
  useEffect(() => {
    if (!activeSede && sedes.length > 0) {
      setExploringSede(sedes[0]);
    }
  }, [activeSede, sedes]);

  const sedeSlug = sedeParam ?? activeSede?.slug ?? sedes[0]?.slug;

  const fetchMenu = useServerFn(getMenuForSede);
  const menuQ = useQuery({
    queryKey: ["menu", sedeSlug],
    queryFn: () => fetchMenu({ data: { sedeSlug: sedeSlug! } }),
    enabled: !!sedeSlug,
    staleTime: 30_000,
  });

  const categoriasRp = (menuQ.data?.categorias ?? []) as RpCategoriaRow[];
  const productosRp = (menuQ.data?.productos ?? []) as RpProductoRow[];
  const categoriasUI = useMemo(() => buildCategorias(categoriasRp), [categoriasRp]);

  const catsById = useMemo(() => {
    const m = new Map<string, RpCategoriaRow>();
    for (const c of categoriasRp) m.set(c.id, c);
    return m;
  }, [categoriasRp]);

  const productos = useMemo(
    () => productosRp.filter((p) => p.disponible).map((p) => rpProductoToProducto(p, catsById)),
    [productosRp, catsById],
  );

  const lista = useMemo(() => {
    if (filtro === "all") return productos;
    return productos.filter((p) => p.categorias.includes(filtro));
  }, [filtro, productos]);

  // "Coronas del rey": destacados + más vendidos del catálogo entero (no filtrados).
  const coronas = useMemo(
    () => productos.filter((p) => p.destacado || p.esMasVendido).slice(0, 4),
    [productos],
  );


  return (
    <>
      <OrderIntentDialog />
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

      {/* SELECTOR DE SEDE — el pill de ubicación vive en el header */}
      {sedes.length > 1 && (
        <section className="mx-auto max-w-7xl px-4 md:px-6 flex items-center gap-3 flex-wrap">
          <select
            value={sedeSlug ?? ""}
            onChange={(e) => navigate({ search: { sede: e.target.value } })}
            className="border-2 border-kp-ink bg-kp-cheese shadow-brutal-sm px-3 py-2 font-display uppercase text-xs"
          >
            {sedes.map((s) => (
              <option key={s.id} value={s.slug}>
                {s.nombre} · {s.ciudad}
              </option>
            ))}
          </select>
        </section>
      )}

      {/* FILTROS */}
      {categoriasUI.length > 1 && (
        <section className="mx-auto max-w-7xl px-4 md:px-6 mt-4">
          <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1">
            {categoriasUI.map((c) => (
              <BrutalChip key={c.id} active={filtro === c.id} onClick={() => setFiltro(c.id)}>
                {c.filtro}
              </BrutalChip>
            ))}
          </div>
        </section>
      )}

      {/* CORONAS DEL REY — destacados + más vendidos. Solo si NO hay filtro activo. */}
      {filtro === "all" && coronas.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 md:px-6 pt-6">
          <div className="flex items-end justify-between mb-3">
            <h2 className="font-display text-3xl uppercase leading-none">
              ★ Coronas del rey
            </h2>
            <span className="text-xs font-display uppercase text-kp-ink/60">
              Las imperdibles
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {coronas.map((p) => (
              <ProductCard key={p.id} producto={p} compact />
            ))}
          </div>
        </section>
      )}



      {/* GRID */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-8">
        {menuQ.isLoading && (
          <p className="text-center py-10 font-display uppercase text-xl">Cargando menú…</p>
        )}
        {menuQ.error && (
          <p className="text-center py-10 font-display uppercase text-xl text-kp-red">
            No se pudo cargar el menú: {(menuQ.error as Error).message}
          </p>
        )}
        {!menuQ.isLoading && !menuQ.error && lista.length === 0 && (
          <div className="text-center py-10 space-y-3">
            <p className="font-display uppercase text-2xl">
              {productos.length === 0
                ? "Esta sede aún no tiene menú sincronizado."
                : "No hay productos en esta categoría… aún."}
            </p>
            {productos.length === 0 && (
              <Link
                to="/admin/sincronizacion"
                className="font-display uppercase underline underline-offset-4 decoration-4 decoration-kp-yellow"
              >
                Ir a sincronización →
              </Link>
            )}
          </div>
        )}
        {lista.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lista.map((p) => (
              <div key={p.id} className={p.destacado ? "sm:col-span-2" : ""}>
                <ProductCard producto={p} destacado={p.destacado} />
              </div>
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
