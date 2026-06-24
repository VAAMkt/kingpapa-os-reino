Tres cambios localizados en `src/components/kp/ProductCustomizerSheet.tsx`. La lógica de modificadores (min/max, `extra`, `mods`, `valido`, `faltantes`, `addItem`) se mantiene íntegra.

---

### CAMBIO 1 — Visual del sheet

Reestructurar `CustomizerBody` como columna flex de altura completa para que el footer sea **siempre visible**, no solo sticky-en-scroll:

- `SheetContent`: cambiar a `max-h-[92vh] p-0 flex flex-col` (quitar `overflow-y-auto` global).
- `CustomizerBody`: contenedor `flex flex-col h-full min-h-0`.
  - **Hero** (`flex-shrink-0`): foto con `h-[42vh] min-h-[260px]` y `object-cover` (≥40% de altura visible en mobile). Fallback: bloque `bg-kp-ink` mismo alto.
  - **Scroll area** (`flex-1 overflow-y-auto p-5 space-y-4`): nombre + descripción + grupos + upsell.
    - Nombre: `font-display text-3xl uppercase font-bold`.
    - Descripción: `text-sm opacity-80`.
    - Precio base: igual.
  - **Footer sticky** (`flex-shrink-0 border-t-2 bg-kp-cheese p-4 space-y-3`): selector cantidad + CTA full-width siempre visible.

Modificador groups:
- Badge "Obligatorio" / "Opcional" con `BrutalBadge` (rojo suave si obligatorio sin selección, ink si opcional).
- Borde rojo suave cuando `g.min > 0 && (sel[g.id]?.size ?? 0) < g.min`: clase `border-kp-red/70` en lugar de `border-kp-ink`.
- Subtítulo "Elige 1" / "Hasta N" se mantiene.

CTA: `Agregar · ${cop(total)}` cuando válido (con punto medio "·"). Disabled state ya existente.

### CAMBIO 2 — Upsell de bebida contextual

Reemplazar el `<UpsellSection excludeIds={[producto.id]} />` actual (genérico, cicla entre grupos) por un bloque **dedicado a bebidas** justo antes del footer:

- Detectar si el producto **ya incluye bebida**:
  - `incluyeBebida = grupos.some(g => /bebida/i.test(g.nombre))`
  - `esBebida = producto.categorias?.some(c => /bebida/i.test(c))`
  - Si `incluyeBebida || esBebida` → no renderizar el bloque.
- Usar el hook existente `useUpsellGroups({ excludeIds: [producto.id], maxPerGroup: 3 })` y tomar **solo** el grupo `key === "bebida"`.
- Si no hay bebidas en la sede → no renderizar.
- Render inline (no usar `<UpsellSection>` para no heredar su lógica de "siguiente grupo"):
  - Título: "¿Le sumás una bebida?" (`font-display uppercase text-lg`).
  - Subtítulo corto: "Una fría siempre cae bien 👑".
  - Grid horizontal scroll en mobile (`flex gap-2 overflow-x-auto snap-x` con cards `min-w-[140px]`): foto cuadrada pequeña, nombre truncate, precio, botón `+` (BrutalButton sm) que llama `addItem({ ..., silent: true })` y muestra `toast.success`.
  - Al agregar, la bebida queda en el carrito junto al producto principal cuando el usuario presione "Agregar al carrito" del producto.
  - Bloque omisible: no bloquea CTA; el usuario simplemente no toca nada.

### CAMBIO 3 — Copy vendedor (mapeo local de nombres)

En el módulo (top-level constante):

```ts
const GROUP_NAME_MAP: Record<string, string> = {
  "salsas": "Elige tu salsa",
  "salsa": "Elige tu salsa",
  "extras": "Agrégale más pecado",
  "adiciones": "Agrégale más pecado",
  "adición": "Agrégale más pecado",
  "bebidas": "Combínalo con bebida",
  "bebida": "Combínalo con bebida",
  "complementos": "Combínalo con bebida",
  "acompañamientos": "Pídele un acompañamiento",
  "acompañamiento": "Pídele un acompañamiento",
  "postres": "Cierra con un postre",
  "postre": "Cierra con un postre",
};
function prettyGroupName(raw: string): string {
  const key = raw.trim().toLowerCase();
  return GROUP_NAME_MAP[key] ?? raw;
}
```

Aplicar `prettyGroupName(g.nombre)` en el `<h3>` del grupo y en `faltantes.push(...)`. El valor original (`g.nombre`) sigue usándose como key/fuente para la detección de "incluyeBebida" en el CAMBIO 2 (regex contra el nombre crudo, no mapeado).

---

### Criterios verificados

- `min/max` se valida igual (`valido`, `faltantes`).
- `extra`, `unit`, `total`, `addItem` sin cambios.
- Upsell de bebida es opt-in, no bloquea CTA, omitible (basta con no tocar).
- Mobile-first: hero 42vh, footer siempre visible vía flex layout, cards horizontales con snap.

### Archivos

- `src/components/kp/ProductCustomizerSheet.tsx` (único archivo modificado).
