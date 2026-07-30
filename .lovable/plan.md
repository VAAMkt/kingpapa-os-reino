## Objetivo

Rediseñar la experiencia de `/menu` (y los componentes de tarjeta, personalizador y carrito que usa) para que en 390×844 px el usuario vea productos reales casi de inmediato y pueda agregar en un toque, conservando toda la lógica de datos, precios, pedidos y Restaurant.pe intacta.

## Qué se conserva (verificado en el código)

- `getMenuForSede` + Supabase, orden de categorías del admin (`menu.tsx` respeta el orden servido), scrollspy con IntersectionObserver, secciones editoriales "Más pedidos" y "Combos solo web".
- `ProductCustomizerSheet` con reglas min/max, precio vivo y upsell de bebida.
- `cart.ts` (localStorage, modificadores, `silent`), `LocationGate` + `pending-intent` (pedir ubicación cuando `sede.source === "exploring"`).
- Checkout, cotización de domicilio, tracking, webhooks: sin tocar.

## Cambios por fase

### A — Cabecera compacta (`src/routes/menu.tsx`)

- Reemplazar el hero rojo (título 5xl + 2 párrafos + CTA `#pedir`) por una barra transaccional: "Menú del Reino", modalidad (Domicilio/Recoger según `activeSede.enCobertura`), nombre de sede, dirección resumida (`direccionTexto`) y "40–60 min" solo en domicilio, más un botón "Cambiar" que abre `openLocationGate()`.
- Quitar el bloque `<OrderRouter />` de `/menu` (el componente sigue existiendo y se usa en `/`).
- Eliminar el `<select>` duplicado de sede: el cambio de sede/modalidad queda en el único control "Cambiar". El search param `?sede=` se sigue respetando para enlaces existentes.
- Eliminar la sección final "Combo Imán del Reino" con precio hardcodeado $19.900 (dato inventado, contradice la regla de no hardcodear promociones).

### B — Búsqueda y barra sticky

- Botón de lupa junto a los chips; abre un input compacto. Filtrado en cliente sobre `productos` ya cargados, normalizando mayúsculas y tildes, sobre nombre y descripción. Estado vacío "No encontramos esa corona", botón limpiar, Escape cierra.
- Barra sticky: `top` calculado bajo la TopAppBar real (usa `sticky top-0` hoy y se solapa con el header `z-40`); se corrige con offset y `z` inferior al header. Chips con `min-h-11`, `aria-current` en la activa, `scroll-padding` y respeto a `prefers-reduced-motion` en `scrollIntoView`.

### C — Tarjetas (`ProductCard.tsx`)

- Nueva variante lista para móvil: texto izquierda, imagen 112 px derecha con `aspect-square`, nombre 18 px, descripción 14 px en 2 líneas, precio visible y botón "+"/"Agregar" de 48 px. En `sm:` y superior se conserva la grilla de tarjetas verticales actual.
- Máximo 2 badges por tarjeta con prioridad: Más vendido → Nuevo → etiqueta custom (web only) → Compartir. Solo atributos que ya existen en `Producto`.
- **Agregar deja de abrir el carrito**: `addItem({ ..., silent: true })` + toast + pulso breve en la barra del carrito. El drawer solo se abre con "Ver pedido". Se mantiene el gate de ubicación previo.
- Estados `focus-visible` y `active` explícitos; nada dependiente de hover.

### D — Personalizador (`ProductCustomizerSheet.tsx`)

- Imagen superior de `h-[42vh] min-h-[260px]` a `h-[min(30vh,220px)]` con aspecto reservado, para que el primer grupo se vea sin desplazar.
- Filas de opción a 48 px mínimo, precio a la derecha, sin preselecciones inventadas.
- CTA inválido explica qué falta (ya lo hace) y además hace scroll/foco al primer grupo incompleto.
- Se mantiene footer sticky, stepper, upsell de bebida y `track("add_to_cart")`.

### E — Carrito (`CartPill.tsx`, `CartDrawer.tsx`)

- `CartPill` en móvil pasa a barra inferior ancha: "Ver pedido", cantidad, subtotal, alto 56 px, `padding-bottom: env(safe-area-inset-bottom)`. En desktop queda flotante compacta.
- Se oculta en `/checkout` (ya hay un CTA sticky inferior en `checkout.tsx:758`) para evitar superposición.
- Drawer: targets de 44 px en −/+/eliminar, modificadores listados bajo cada ítem, "Vaciar" con confirmación si hay más de un ítem.
- **Se elimina el bloque de envío gratis** y la constante `FREE_SHIPPING_THRESHOLD = 40000`, sin reemplazo.

### F — Carga e imágenes

- Skeletons con la geometría exacta de las tarjetas en lugar de "Cargando menú…".
- Primera imagen visible: `loading="eager"` + `fetchPriority="high"`; el resto `lazy`. `width`/`height` y `aspect-ratio` en todas las imágenes; fallback de marca cuando no hay `imagen_url`. Sin nuevas dependencias.

### G/H — Microcopy y accesibilidad

- Dentro del flujo transaccional: "Agregar", "Personalizar", "Elige 1", "Hasta N", "Opcional", "Ver pedido", "Cambiar ubicación". La voz del Reino queda en títulos de sección, badges, toasts y estados vacíos.
- Tap targets ≥44 px, foco visible, `aria-current` en categoría activa, Escape en sheet (Radix ya lo cubre), textos ≥14 px en descripciones.

### I — Analytics (`lib/analytics.ts` sigue igual, solo nuevas llamadas)

Se añaden sin PII: `menu_search_started`, `menu_search_result_selected`, `cart_opened`, `simple_product_added`, `customizer_opened`, `customizer_completed`. Se preservan `menu_view`, `category_clicked`, `product_view`, `add_to_cart`.

## Fuera de alcance

Favoritos, "Pedir de nuevo", historial, pagos, promociones nuevas, envío gratis, cambios de esquema, tracking y Restaurant.pe. Favoritos y "Pedir de nuevo" quedan documentados como fase posterior por requerir historial y modificadores confiables.

## Notas técnicas

- Archivos a modificar: `src/routes/menu.tsx`, `src/components/kp/ProductCard.tsx`, `src/components/kp/ProductCustomizerSheet.tsx`, `src/components/kp/CartPill.tsx`, `src/components/kp/CartDrawer.tsx`. Sin migraciones ni cambios en `rp.functions.ts`, `orders.server.ts` ni `checkout.tsx` (salvo, si hace falta, nada: la ocultación del pill se resuelve dentro de `CartPill` leyendo la ruta).
- `addItem` ya soporta `silent`; no requiere cambios en `cart.ts`.
- Verificación: build + lint + capturas Playwright a 360, 390 y 430 px y en desktop.

## Riesgo conocido

El offset de la barra sticky depende de la altura real de la TopAppBar, que en móvil tiene dos filas (logo + pill de ubicación). Se resolverá midiendo el header en runtime o con una variable CSS de altura, y se validará con capturas en los tres anchos.

La propuesta queda aprobada con los siguientes ajustes obligatorios antes de implementar:

1. La modalidad no puede inferirse desde `activeSede.enCobertura`. Usa `useCart().orderType` como fuente de verdad para mostrar Domicilio o Recoger. `enCobertura` solamente representa cobertura geográfica.
2. Unifica la sede activa. El parámetro `?sede=`, el menú consultado, la cabecera y `activeSede` nunca pueden representar sedes diferentes. Define una sede canónica y sincroniza el estado sin loops ni recargas innecesarias.
3. El botón “Cambiar” debe permitir:
  - cambiar entre domicilio y recoger;
  - cambiar dirección;
  - elegir manualmente sede de recogida.

Reutiliza `OrderIntentDialog` y los flujos existentes. No abras exclusivamente `LocationGate`, porque no resuelve correctamente la modalidad pickup.

4. Al agregar un producto simple o confirmar el personalizador, usa `silent: true`. No abras automáticamente `CartDrawer`. Actualiza toast, analytics y barra del carrito.
5. Para productos simples emite ambos eventos:
  - `add_to_cart`
  - `simple_product_added`
6. Prioriza solamente una o máximo dos imágenes reales above-the-fold con `loading="eager"` y `fetchPriority="high"`. No marques como eager la primera imagen de cada categoría. Todas las demás deben permanecer lazy.
7. `CartPill` debe mostrarse únicamente en rutas comerciales donde tenga sentido. Debe ocultarse como mínimo en:
  - `/checkout`
  - `/gracias`
  - `/admin/*`

No uses acceso directo inseguro a `window.location`; utiliza las APIs de TanStack Router de forma compatible con SSR.

8. Para el offset sticky utiliza una variable CSS estable asociada a la altura real de `TopAppBar` o un `ResizeObserver` con cleanup. No midas el header continuamente durante scroll.
9. Elimina la ruta de filtro plano si queda inaccesible o duplicada. Mantén una sola navegación mental:
  - scroll vertical por secciones;
  - chips para saltar;
  - búsqueda para filtrar.
10. No añadas nuevas consultas de domicilio únicamente para pintar la cabecera del menú. Si el costo ya está disponible o cacheado, muéstralo; de lo contrario utiliza información honesta sin inventar valores.
11. Conserva este presupuesto de interacción:

- Cliente con ubicación guardada + producto simple: 1 toque para agregar.
- Cliente nuevo: puede explorar libremente; ubicación se solicita solamente al primer intento de agregar.
- Producto con modificadores: abrir, completar únicamente lo necesario y agregar.
- Carrito: siempre accesible con un toque.
- Ningún upsell puede bloquear el flujo principal.

12. Mantén como criterios principales:

- Primer producto accionable visible en el primer pantallazo o tras un scroll mínimo.
- Uso cómodo con una sola mano en 360, 390 y 430 px.
- Ninguna interacción crítica dependiente de hover.
- Ningún precio, promoción, categoría, envío gratis o atributo inventado.
- No modificar pedidos, checkout, pagos, tracking, webhooks, Supabase ni [Restaurant.pe](http://Restaurant.pe).

Con estos ajustes, ejecuta directamente el rediseño funcional, realiza build, lint y capturas responsive, y entrega una PR lista para revisión.