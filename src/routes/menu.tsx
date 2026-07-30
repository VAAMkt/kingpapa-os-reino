import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ProductCard } from "@/components/kp/ProductCard";
import { OrderIntentDialog } from "@/components/kp/OrderIntentDialog";
import { openLocationGate } from "@/components/kp/LocationGate";
import { getMenuForSede } from "@/lib/rp.functions";
import { listPublicSedes } from "@/lib/sedes";
import {
  rpProductoToProducto,
  buildCategorias,
  type RpCategoriaRow,
  type RpProductoRow,
} from "@/lib/menu";
import { useActiveSede, setActiveSede, setExploringSede } from "@/lib/active-sede";
import { useCart, setOrderType } from "@/lib/cart";
import { cn, prefersReducedMotion } from "@/lib/utils";
import { track } from "@/lib/analytics";
import type { Producto, Categoria } from "@/types/kp";

export const Route = createFileRoute("/menu")({
  validateSearch: (search: Record<string, unknown>) => ({
    sede: typeof search.sede === "string" ? search.sede : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Menú del Reino — KINGPAPA" },
      {
        name: "description",
        content:
          "Escogé tu corona: personal pa’ uno, X2 pa’ dos, Legendaria pa’ tres o Kingpapa pa’ toda la banda (hasta 7). Sin diplomacia.",
      },
      { property: "og:title", content: "Menú del Reino — KINGPAPA" },
      {
        property: "og:description",
        content:
          "Salchipapas monstruosas, bowls coronados, combos solo web y retos brutales pa’ toda la banda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "/menu" },
    ],
    links: [{ rel: "canonical", href: "/menu" }],
  }),
  component: MenuPage,
});

type Seccion = { categoria: Categoria; productos: Producto[] };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const STICKY_OFFSET = "calc(var(--kp-appbar-h, 64px))";
const SCROLL_MARGIN = "calc(var(--kp-appbar-h, 64px) + 72px)";

function MenuPage() {
  const { sede: sedeParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const sedesQ = useQuery({
    queryKey: ["sedes", "public"],
    queryFn: listPublicSedes,
    staleTime: 60_000,
  });
  const sedes = sedesQ.data ?? [];
  const activeSede = useActiveSede();
  const { orderType } = useCart();
  const modo = orderType === "pickup" ? "pickup" : "delivery";

  // Sede canónica: SIEMPRE `activeSede`. El search param `?sede=` sólo siembra
  // el estado cuando aún no hay sede real, y luego se limpia de la URL para que
  // cabecera, menú y carrito nunca apunten a sedes distintas.
  useEffect(() => {
    if (sedes.length === 0) return;
    const fromParam = sedeParam ? sedes.find((s) => s.slug === sedeParam) : undefined;
    const esReal = !!activeSede && activeSede.source !== "exploring";
    if (fromParam && !esReal && activeSede?.slug !== fromParam.slug) {
      setExploringSede(fromParam);
      return;
    }
    if (sedeParam) {
      navigate({ search: { sede: undefined }, replace: true });
      return;
    }
    if (!activeSede) setExploringSede(sedes[0]);
  }, [sedeParam, sedes, activeSede, navigate]);

  const sedeSlug = activeSede?.slug ?? sedes[0]?.slug;

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
    const combosWeb = productos.filter(
      (p) =>
        p.etiqueta_custom === "combo-web" ||
        p.etiqueta_custom?.toLowerCase().includes("combo") ||
        p.clasificacion_me === "star",
    );
    const combosWebIds = new Set(combosWeb.map((p) => p.id));
    const restantes = productos.filter((p) => !combosWebIds.has(p.id));
    const masPedidos = restantes.filter((p) => p.destacado || p.esMasVendido);

    // El orden de categorías viene del admin (categorias_master.orden). No re-sortear.
    const reales = categoriasUI
      .filter((c) => c.id !== "all")
      .map<Seccion>((c) => ({
        categoria: c,
        productos: restantes.filter((p) => p.categorias.includes(c.id)),
      }))
      .filter((s) => s.productos.length > 0);

    return [
      ...(masPedidos.length
        ? [
            {
              categoria: { id: "mas-pedidos", nombre: "Más pedidos", filtro: "Más pedidos" } as Categoria,
              productos: masPedidos,
            },
          ]
        : []),
      ...(combosWeb.length
        ? [
            {
              categoria: {
                id: "combos-solo-web",
                nombre: "Combos solo web",
                filtro: "Combos solo web",
              } as Categoria,
              productos: combosWeb,
            },
          ]
        : []),
      ...reales,
    ];
  }, [productos, categoriasUI]);

  // Búsqueda 100% en cliente sobre el menú ya cargado (sin llamadas al servidor).
  const buscando = query.trim().length > 0;
  const resultados = useMemo(() => {
    if (!buscando) return [];
    const q = norm(query.trim());
    return productos.filter(
      (p) => norm(p.nombre).includes(q) || norm(p.descripcion ?? "").includes(q),
    );
  }, [buscando, query, productos]);

  // Scrollspy
  useEffect(() => {
    if (buscando) return;
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
      { rootMargin: "-160px 0px -60% 0px", threshold: 0 },
    );
    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, [buscando, secciones.length]);

  // Auto-scroll de la pill activa
  useEffect(() => {
    if (!activeCat) return;
    const pill = document.querySelector<HTMLElement>(`[data-cat-nav="${activeCat}"]`);
    pill?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [activeCat]);

  const handleNavClick = (id: string) => {
    const nombre = secciones.find((s) => s.categoria.id === id)?.categoria.nombre ?? id;
    track("category_clicked", { categoria_id: id, categoria_nombre: nombre });
    if (buscando) setQuery("");
    requestAnimationFrame(() => {
      document.getElementById(`sec-${id}`)?.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
    });
  };

  useEffect(() => {
    if (!activeSede?.sedeId) return;
    track("menu_view", { sede_id: activeSede.sedeId, sede_nombre: activeSede.label });
  }, [activeSede?.sedeId, activeSede?.label]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const sedeActual = sedes.find((s) => s.slug === sedeSlug);
  const direccionCorta = activeSede?.direccionTexto?.split(",")[0];
  const sedeNombre = sedeActual?.nombre ?? activeSede?.label ?? "Elegí tu sede";
  const loadingMenu = sedesQ.isLoading || menuQ.isLoading;
  const menuError = sedesQ.error ?? menuQ.error;

  const confirmarSedePickup = (slug: string | undefined) => {
    const s = sedes.find((item) => item.slug === slug) ?? sedes[0];
    if (!s) return;
    setActiveSede({
      sedeId: s.id,
      slug: s.slug,
      label: `Recoger en ${s.nombre}`,
      source: "manual",
      enCobertura: false,
      ts: Date.now(),
    });
  };

  // Índice global para priorizar sólo las 2 primeras imágenes (above the fold).
  let imgIndex = 0;
  const nextPriority = () => imgIndex++ < 2;

  return (
    <>
      <OrderIntentDialog />

      {/* CABECERA TRANSACCIONAL COMPACTA */}
      <section className="bg-kp-red text-kp-cheese border-b-4 border-kp-ink">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-3 md:py-5">
          <h1 className="font-display text-2xl md:text-4xl uppercase leading-none">
            Menú del Reino
          </h1>

          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0 text-sm leading-tight">
              <p className="truncate">
                <strong>{modo === "pickup" ? "Recoger" : "Domicilio"}</strong> · {sedeNombre}
              </p>
              <p className="truncate text-kp-cheese/80 text-[13px]">
                {modo === "pickup"
                  ? sedeActual?.direccion || "Sede seleccionada"
                  : direccionCorta || "Sin dirección aún"}
                {modo === "delivery" ? " · 40–60 min" : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (modo === "pickup") {
                  document.getElementById("sede-pickup")?.focus();
                } else {
                  openLocationGate();
                }
              }}
              className="shrink-0 min-h-11 px-4 bg-kp-yellow text-kp-ink border-2 border-kp-ink shadow-brutal-sm font-display uppercase text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kp-cheese"
            >
              Cambiar
            </button>
          </div>

          {/* Modalidad + sede de recogida: único control, sin duplicados */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="inline-flex border-2 border-kp-ink" role="group" aria-label="Modalidad">
              {(["delivery", "pickup"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={modo === t}
                  onClick={() => {
                    setOrderType(t);
                    if (
                      t === "pickup" &&
                      (!activeSede || activeSede.source === "exploring")
                    ) {
                      confirmarSedePickup(sedeSlug);
                    }
                  }}
                  className={cn(
                    "min-h-11 px-3 font-display uppercase text-xs",
                    modo === t ? "bg-kp-ink text-kp-yellow" : "bg-kp-cheese text-kp-ink",
                  )}
                >
                  {t === "delivery" ? "Domicilio" : "Recoger"}
                </button>
              ))}
            </div>

            {modo === "pickup" && sedes.length > 0 && (
              <>
                <label htmlFor="sede-pickup" className="sr-only">
                  Sede donde vas a recoger
                </label>
                <select
                  id="sede-pickup"
                  value={sedeSlug ?? ""}
                  onChange={(e) => {
                    confirmarSedePickup(e.target.value);
                  }}
                  className="min-h-11 border-2 border-kp-ink bg-kp-cheese text-kp-ink px-3 font-display uppercase text-xs"
                >
                  {sedes.map((s) => (
                    <option key={s.id} value={s.slug}>
                      {s.nombre} · {s.ciudad}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>
      </section>

      {/* BARRA STICKY: BÚSQUEDA + CATEGORÍAS */}
      {(secciones.length > 0 || buscando) && (
        <nav
          className="sticky z-30 bg-kp-cheese border-b-4 border-kp-ink"
          style={{ top: STICKY_OFFSET }}
          aria-label="Categorías del menú"
        >
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="flex items-center gap-2 py-2">
              <button
                type="button"
                aria-label={searchOpen ? "Cerrar búsqueda" : "Buscar en el menú"}
                aria-expanded={searchOpen}
                onClick={() => {
                  const next = !searchOpen;
                  setSearchOpen(next);
                  if (next) track("menu_search_started");
                  else setQuery("");
                }}
                className="shrink-0 min-w-11 min-h-11 grid place-items-center border-2 border-kp-ink bg-kp-yellow shadow-brutal-sm text-lg"
              >
                🔎
              </button>

              {searchOpen ? (
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        if (query) setQuery("");
                        else setSearchOpen(false);
                      }
                    }}
                    placeholder="Buscar en el menú"
                    aria-label="Buscar productos del menú"
                    className="flex-1 min-w-0 min-h-11 px-3 border-2 border-kp-ink bg-kp-cheese text-sm"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="shrink-0 min-h-11 px-3 border-2 border-kp-ink bg-kp-cheese font-display uppercase text-xs"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex gap-2 overflow-x-auto scrollbar-none pr-6">
                  {secciones.map((s) => {
                    const isActive = activeCat === s.categoria.id;
                    return (
                      <button
                        key={s.categoria.id}
                        type="button"
                        onClick={() => handleNavClick(s.categoria.id)}
                        data-cat-nav={s.categoria.id}
                        aria-current={isActive ? "true" : undefined}
                        className={cn(
                          "shrink-0 min-h-11 px-4 font-display uppercase text-xs border-2 border-kp-ink whitespace-nowrap shadow-brutal-sm transition-transform motion-reduce:transition-none active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kp-ink",
                          isActive
                            ? "bg-kp-ink text-kp-yellow"
                            : "bg-kp-cheese text-kp-ink hover:bg-kp-yellow",
                        )}
                      >
                        {s.categoria.nombre}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </nav>
      )}

      {/* CONTENIDO */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-5 pb-28">
        {loadingMenu && <MenuSkeleton />}

        {menuError && (
          <p className="text-center py-10 font-display uppercase text-xl text-kp-red">
            No se pudo cargar el menú: {(menuError as Error).message}
          </p>
        )}

        {!loadingMenu && !menuError && productos.length === 0 && (
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

        {/* Resultados de búsqueda */}
        {!loadingMenu && !menuError && buscando && (
          <div>
            <p className="font-display uppercase text-sm mb-3">
              {resultados.length} resultado{resultados.length === 1 ? "" : "s"} para “{query}”
            </p>
            {resultados.length === 0 ? (
              <div className="border-2 border-dashed border-kp-ink p-6 text-center">
                <p className="font-display uppercase text-2xl">No encontramos esa corona</p>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="mt-3 min-h-11 px-4 border-2 border-kp-ink bg-kp-yellow font-display uppercase text-xs shadow-brutal-sm"
                >
                  Limpiar búsqueda
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {resultados.map((p) => (
                  <div
                    key={p.id}
                    onClickCapture={() =>
                      track("menu_search_result_selected", { producto_id: p.id })
                    }
                  >
                    <ProductCard producto={p} priority={nextPriority()} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Secciones */}
        {!loadingMenu && !menuError && !buscando && secciones.length > 0 && (
          <div>
            {secciones.map(({ categoria, productos: items }) => (
              <section
                key={categoria.id}
                id={`sec-${categoria.id}`}
                data-cat-section={categoria.id}
                style={{ scrollMarginTop: SCROLL_MARGIN }}
                className="mb-8"
              >
                <div className="flex items-end justify-between mb-3 mt-2 border-b-4 border-kp-ink pb-2">
                  <h2 className="font-display text-2xl md:text-4xl uppercase leading-none">
                    {categoria.nombre}
                  </h2>
                  <span className="text-xs font-display uppercase text-kp-ink/60">
                    {items.length} {items.length === 1 ? "opción" : "opciones"}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {items.map((p) => (
                    <ProductCard key={p.id} producto={p} priority={nextPriority()} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function MenuSkeleton() {
  return (
    <div aria-hidden className="space-y-6">
      <div className="h-8 w-48 bg-kp-ink/10 border-2 border-kp-ink/20" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="border-2 border-kp-ink/20 bg-kp-cheese flex flex-row sm:flex-col h-full"
          >
            <div className="order-2 sm:order-none w-28 aspect-square m-3 sm:m-0 sm:w-full bg-kp-ink/10 shrink-0" />
            <div className="order-1 sm:order-none p-3 sm:p-4 flex-1 space-y-2">
              <div className="h-5 w-3/4 bg-kp-ink/10" />
              <div className="h-4 w-full bg-kp-ink/10" />
              <div className="h-4 w-2/3 bg-kp-ink/10" />
              <div className="h-10 w-full bg-kp-ink/10 mt-4" />
            </div>
          </div>
        ))}
      </div>
      <p className="sr-only">Cargando menú…</p>
    </div>
  );
}
