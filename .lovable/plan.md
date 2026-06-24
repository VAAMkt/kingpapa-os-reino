
## Objetivo

Convertir `/menu` en una experiencia mobile-first tipo carta:
1. Secciones con título cuando el filtro es "Todas".
2. Barra sticky de categorías con scroll suave y resaltado por scroll.
3. `OrderRouter`: jerarquía clara — pedido directo primero, apps de terceros colapsadas.

Sin tocar carrito, `submitOrder`, integración Restaurant.pe ni lógica craving-first.

---

## CAMBIO 1 — Menú por secciones

**Archivo:** `src/routes/menu.tsx`

Reemplazar el bloque GRID actual (líneas ~162-198) por render condicional:

- Si `filtro !== "all"` → grid plano actual (sin cambios).
- Si `filtro === "all"` → render por secciones.

**Construcción de secciones** (en `useMemo`):

```ts
// Sección sintética "Más pedidos"
const masPedidos = productos.filter(p => p.destacado || p.esMasVendido);

// Secciones reales = categoriasUI menos "all", filtradas a las que tienen productos
const seccionesReales = categoriasUI
  .filter(c => c.id !== "all")
  .map(c => ({ categoria: c, productos: productos.filter(p => p.categorias.includes(c.id)) }))
  .filter(s => s.productos.length > 0);

// Orden prioritario por heurística sobre el slug/nombre de categoría
const prioridad = (slug: string, nombre: string) => {
  const s = `${slug} ${nombre}`.toLowerCase();
  if (s.includes("combo")) return 1;
  if (s.includes("uno") || s.includes("personal") || s.includes("individual")) return 2;
  if (s.includes("salchipapa")) return 3;
  if (s.includes("adicion") || s.includes("acompan")) return 4;
  if (s.includes("bebida") || s.includes("drink")) return 5;
  return 99;
};
seccionesReales.sort((a, b) =>
  prioridad(a.categoria.id, a.categoria.nombre) - prioridad(b.categoria.id, b.categoria.nombre)
);

// Sección "Más pedidos" va primero si hay productos
const secciones = [
  ...(masPedidos.length ? [{ categoria: { id: "mas-pedidos", nombre: "Más pedidos", filtro: "Más pedidos" }, productos: masPedidos }] : []),
  ...seccionesReales,
];
```

**Render por sección:**

```tsx
{secciones.map(({ categoria, productos: items }) => (
  <section
    key={categoria.id}
    id={`sec-${categoria.id}`}
    data-cat-section={categoria.id}
    className="scroll-mt-32"
  >
    <div className="flex items-end justify-between mb-3 mt-8 border-b-4 border-kp-ink pb-2">
      <h2 className="font-display text-3xl md:text-4xl uppercase leading-none">
        {categoria.nombre}
      </h2>
      <span className="text-xs font-display uppercase text-kp-ink/60">
        {items.length} {items.length === 1 ? "opción" : "opciones"}
      </span>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map(p => (
        <div key={p.id} className={p.destacado ? "sm:col-span-2" : ""}>
          <ProductCard producto={p} destacado={p.destacado} />
        </div>
      ))}
    </div>
  </section>
))}
```

**"Coronas del rey" (líneas 142-158):** se elimina ese bloque para evitar duplicar con "Más pedidos" cuando `filtro === "all"`. Ahorra confusión.

`scroll-mt-32` deja espacio bajo el header sticky al hacer anchor scroll.

---

## CAMBIO 2 — Sticky category nav

**Mismo archivo `src/routes/menu.tsx`.** Reemplazar el bloque FILTROS (líneas 128-139) por una barra sticky:

```tsx
<nav
  className="sticky top-0 z-30 bg-kp-cheese border-b-4 border-kp-ink"
  aria-label="Categorías"
>
  <div className="mx-auto max-w-7xl px-4 md:px-6">
    <div
      className="flex gap-2 overflow-x-auto py-3 scrollbar-none"
      style={{ scrollbarWidth: "none" }}
    >
      {sections para nav.map(c => (
        <button
          key={c.id}
          onClick={() => handleNavClick(c.id)}
          data-cat-nav={c.id}
          className={cn(
            "shrink-0 px-3 py-2 font-display uppercase text-xs border-2 border-kp-ink whitespace-nowrap",
            activeCat === c.id ? "bg-kp-ink text-kp-cheese" : "bg-kp-cheese"
          )}
        >
          {c.nombre}
        </button>
      ))}
    </div>
  </div>
</nav>
```

Donde `sections para nav` = mismas `secciones` calculadas arriba (incluye "Más pedidos"). Cuando `filtro !== "all"`, ocultar barra (modo filtrado clásico) o seguir mostrando sin scrollspy — decisión: mantener visible siempre; tap en una pill resetea `filtro="all"` y hace scroll a esa sección.

**Scrollspy con IntersectionObserver:**

```ts
const [activeCat, setActiveCat] = useState<string | null>(null);
useEffect(() => {
  const nodes = document.querySelectorAll<HTMLElement>("[data-cat-section]");
  if (!nodes.length) return;
  const obs = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActiveCat(visible.target.getAttribute("data-cat-section"));
    },
    { rootMargin: "-140px 0px -60% 0px", threshold: 0 }
  );
  nodes.forEach(n => obs.observe(n));
  return () => obs.disconnect();
}, [secciones.length, filtro]);

const handleNavClick = (id: string) => {
  if (filtro !== "all") setFiltro("all");
  requestAnimationFrame(() => {
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
};
```

**Hide scrollbar mobile:** añadir clase utilitaria `.scrollbar-none { scrollbar-width: none; } .scrollbar-none::-webkit-scrollbar { display: none; }` en `src/styles.css`.

Auto-scroll horizontal de la pill activa: cuando `activeCat` cambie, `document.querySelector('[data-cat-nav="X"]')?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" })`.

---

## CAMBIO 3 — OrderRouter: pedido directo primero

**Archivo:** `src/components/kp/OrderRouter.tsx`

Nueva jerarquía dentro del `BrutalCard`:

```tsx
{/* CTA primario */}
<BrutalLink href="/checkout" variant="primary" size="lg" block>
  Pedir directo al Reino
</BrutalLink>

{/* CTA secundario */}
<BrutalLink href={`/checkout?modo=recoger&sede=${sede?.slug ?? ""}`} variant="ghost" size="md" block className="mt-3">
  Recoger en sede
</BrutalLink>

{/* Dropdown colapsado al fondo */}
<details className="mt-5 border-t-2 border-kp-ink/20 pt-3">
  <summary className="cursor-pointer font-display uppercase text-xs tracking-wider text-kp-ink/70 list-none flex items-center justify-between">
    También estamos en apps
    <span aria-hidden>▾</span>
  </summary>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
    <BrutalLink href={rappiUrl} external variant="ghost" size="sm" block>Rappi</BrutalLink>
    <BrutalLink href={didiUrl} external variant="ghost" size="sm" block>DiDi</BrutalLink>
    <BrutalLink href={waUrl} external variant="ghost" size="sm" block>WhatsApp</BrutalLink>
  </div>
</details>
```

El selector de ciudad/sede permanece arriba (necesario para construir `waUrl` y para preseleccionar sede en checkout). El destino real del CTA "Pedir directo" será `/checkout` (ya existe). Si la sede no está confirmada, el flujo existente de `OrderIntentDialog` / location gate ya intercepta al primer add-to-cart.

Rappi/DiDi conservan los enlaces actuales pero degradados visualmente, sin colores `fire/neon` que compitan.

---

## Detalles técnicos

- `cn` helper: ya existe en `src/lib/utils.ts`.
- `BrutalLink block` y `size="sm"`: verificar variantes disponibles en `src/components/ui-kp/BrutalButton.tsx`; si no existen `sm` o `block`, usar las más cercanas (`md` y `w-full`).
- IntersectionObserver es safe en SSR si se llama dentro de `useEffect` (solo cliente).
- `scroll-mt-32` (Tailwind) ya disponible en v4.
- No se tocan: `submitOrder`, `restaurantpe.server.ts`, `cart.ts`, `OrderIntentDialog`, integración RP webhook.

---

## Archivos a modificar

1. `src/routes/menu.tsx` — secciones + sticky nav + scrollspy + quitar "Coronas".
2. `src/components/kp/OrderRouter.tsx` — reordenar CTAs.
3. `src/styles.css` — utilidad `.scrollbar-none`.
4. Si falta variante: `src/components/ui-kp/BrutalButton.tsx` (verificación mínima, no rediseño).

## Fuera de alcance

- Cambios en `ProductCard`, carrito, checkout, RP, auth.
- Reordenar categorías desde admin (la prioridad va por heurística de slug; si después quieren orden manual, sería otro plan).
