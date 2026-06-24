import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalLink } from "@/components/ui-kp/BrutalButton";
import { OrderRouter } from "@/components/kp/OrderRouter";
import { ProductCard } from "@/components/kp/ProductCard";
import { OrderIntentDialog } from "@/components/kp/OrderIntentDialog";
import { getMenuForSede } from "@/lib/rp.functions";
import { listPublicSedes } from "@/lib/sedes";
import { rpProductoToProducto, buildCategorias, type RpCategoriaRow, type RpProductoRow } from "@/lib/menu";
import { useActiveSede, setExploringSede } from "@/lib/active-sede";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import type { Producto, Categoria } from "@/types/kp";

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

type Seccion = { categoria: Categoria; productos: Producto[] };

function prioridad(slug: string, nombre: string): number {
  const s = `${slug} ${nombre}`.toLowerCase();
  if (s.includes("combo")) return 1;
  if (s.includes("uno") || s.includes("personal") || s.includes("individual")) return 2;
  if (s.includes("salchipapa")) return 3;
  if (s.includes("adicion") || s.includes("acompan")) return 4;
  if (s.includes("bebida") || s.includes("drink")) return 5;
  return 99;
}

function MenuPage() {
  const { sede: sedeParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [filtro, setFiltro] = useState<string>("all");
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const sedesQ = useQuery({ queryKey: ["sedes", "public"], queryFn: listPublicSedes, staleTime: 60_000 });
  const sedes = sedesQ.data ?? [];
  const activeSede = useActiveSede();

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

  const secciones = useMemo<Seccion[]>(() => {
    const masPedidos = productos.filter((p) => p.destacado || p.esMasVendido);
    const reales = categoriasUI
      .filter((c) => c.id !== "all")
      .map<Seccion>((c) => ({
        categoria: c,
        productos: productos.filter((p) => p.categorias.includes(c.id)),
      }))
      .filter((s) => s.productos.length > 0);
    reales.sort(
      (a, b) =>
        prioridad(a.categoria.id, a.categoria.nombre) -
        prioridad(b.categoria.id, b.categoria.nombre),
    );
    return [
      ...(masPedidos.length
        ? [
            {
              categoria: { id: "mas-pedidos", nombre: "Más pedidos", filtro: "Más pedidos" } as Categoria,
              productos: masPedidos,
            },
          ]
        : []),
      ...reales,
    ];
  }, [productos, categoriasUI]);

  const listaFiltrada = useMemo(() => {
    if (filtro === "all") return productos;
    return productos.filter((p) => p.categorias.includes(filtro));
  }, [filtro, productos]);

  // Scrollspy
  useEffect(() => {
    if (filtro !== "all") return;
    const nodes = document.querySelectorAll<HTMLElement>("[data-cat-section]");
    if (!nodes.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) {
          const id = visible.target.getAttribute("data-cat-section");
          if (id) setActiveCat(id);
        }
      },
      { rootMargin: "-140px 0px -60% 0px", threshold: 0 },
    );
    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, [filtro, secciones.length]);

  // Auto-scroll pill activa
  useEffect(() => {
    if (!activeCat) return;
    const pill = document.querySelector<HTMLElement>(`[data-cat-nav="${activeCat}"]`);
    pill?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeCat]);

  const handleNavClick = (id: string) => {
    if (filtro !== "all") setFiltro("all");
    const nombre =
      id === "all"
        ? "Todas"
        : secciones.find((s) => s.categoria.id === id)?.categoria.nombre ?? id;
    track("category_clicked", { categoria_id: id, categoria_nombre: nombre });
    requestAnimationFrame(() => {
      document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  // Evento menu_view cuando la sede activa está disponible
  useEffect(() => {
    if (!activeSede?.sedeId) return;
    track("menu_view", { sede_id: activeSede.sedeId, sede_nombre: activeSede.label });
  }, [activeSede?.sedeId, activeSede?.label]);


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

      {/* SELECTOR DE SEDE */}
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

      {/* STICKY CATEGORY NAV */}
      {secciones.length > 0 && (
        <nav
          className="sticky top-0 z-30 bg-kp-cheese border-y-4 border-kp-ink mt-4"
          aria-label="Categorías"
        >
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="flex gap-2 overflow-x-auto py-3 scrollbar-none">
              {secciones.map((s) => {
                const isActive = filtro === "all" ? activeCat === s.categoria.id : filtro === s.categoria.id;
                return (
                  <button
                    key={s.categoria.id}
                    type="button"
                    onClick={() => handleNavClick(s.categoria.id)}
                    data-cat-nav={s.categoria.id}
                    className={cn(
                      "shrink-0 px-3 py-2 font-display uppercase text-xs border-2 border-kp-ink whitespace-nowrap shadow-brutal-sm transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
                      isActive ? "bg-kp-ink text-kp-cheese" : "bg-kp-cheese text-kp-ink",
                    )}
                  >
                    {s.categoria.nombre}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      )}

      {/* CONTENIDO */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-8">
        {menuQ.isLoading && (
          <p className="text-center py-10 font-display uppercase text-xl">Cargando menú…</p>
        )}
        {menuQ.error && (
          <p className="text-center py-10 font-display uppercase text-xl text-kp-red">
            No se pudo cargar el menú: {(menuQ.error as Error).message}
          </p>
        )}
        {!menuQ.isLoading && !menuQ.error && productos.length === 0 && (
          <div className="text-center py-10 space-y-3">
            <p className="font-display uppercase text-2xl">
              Esta sede aún no tiene menú sincronizado.
            </p>
            <Link
              to="/admin/sincronizacion"
              className="font-display uppercase underline underline-offset-4 decoration-4 decoration-kp-yellow"
            >
              Ir a sincronización →
            </Link>
          </div>
        )}

        {/* Modo "Todas": por secciones */}
        {!menuQ.isLoading && !menuQ.error && filtro === "all" && secciones.length > 0 && (
          <div>
            {secciones.map(({ categoria, productos: items }) => (
              <section
                key={categoria.id}
                id={`sec-${categoria.id}`}
                data-cat-section={categoria.id}
                className="scroll-mt-32 mb-10"
              >
                <div className="flex items-end justify-between mb-3 mt-2 border-b-4 border-kp-ink pb-2">
                  <h2 className="font-display text-3xl md:text-4xl uppercase leading-none">
                    {categoria.nombre}
                  </h2>
                  <span className="text-xs font-display uppercase text-kp-ink/60">
                    {items.length} {items.length === 1 ? "opción" : "opciones"}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((p) => (
                    <div key={p.id} className={p.destacado ? "sm:col-span-2" : ""}>
                      <ProductCard producto={p} destacado={p.destacado} />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Modo filtro específico: grid plano */}
        {!menuQ.isLoading && !menuQ.error && filtro !== "all" && (
          <>
            {listaFiltrada.length === 0 ? (
              <p className="text-center py-10 font-display uppercase text-2xl">
                No hay productos en esta categoría… aún.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {listaFiltrada.map((p) => (
                  <div key={p.id} className={p.destacado ? "sm:col-span-2" : ""}>
                    <ProductCard producto={p} destacado={p.destacado} />
                  </div>
                ))}
              </div>
            )}
          </>
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
