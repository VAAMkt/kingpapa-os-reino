## 1. Cabecera móvil (dirección duplicada + logo apretado)

Archivo: `src/components/kp/Layout.tsx`

- Renderizar la píldora de ubicación **una sola vez**: hoy hay dos instancias (`LocationPill` en la fila superior con `hidden sm:inline-flex` y otra en la fila móvil `sm:hidden`), y en pantallas intermedias/al recalcular ambas quedan visibles. Se deja una única instancia con colocación responsive controlada por CSS de contenedor, no por dos nodos duplicados.
- Fila superior móvil: `grid grid-cols-[auto_1fr_auto]` con logo `shrink-0` (altura fija `h-8`, sin compresión), espacio flexible y a la derecha sólo `UserMenu` + botón `Menú`.
- Píldora de dirección: fila propia debajo, ancho completo, `truncate`, ícono 📍 `shrink-0`, alto mínimo 44px, con texto secundario "Cambiar" alineado a la derecha para que se entienda que es tocable.
- El `ResizeObserver` que publica `--kp-appbar-h` se mantiene tal cual (sigue midiendo la altura real, ahora menor).

## 2. Tarjeta de producto (imagen y texto)

Archivo: `src/components/kp/ProductCard.tsx`

- En móvil la imagen pasa a un cuadro más grande y ópticamente centrado en su esquina: margen idéntico arriba / derecha / abajo (`m-3` en los tres lados, sin margen izquierdo), `w-32` (~128px) en vez de `w-28`, `aspect-square`, `self-stretch` limitado con `max-h` para que nunca desborde la tarjeta.
- La columna de texto usa el alto de la imagen como referencia: título `line-clamp-2`, descripción `line-clamp-3` en móvil (hoy 2) y tamaño `text-[13px]` para que se lea la mayor parte del texto sin cortar en una línea.
- Precio + CTA quedan en la fila inferior a ancho completo bajo el texto, para que la descripción gane espacio horizontal.
- Sin cambios de lógica de negocio ni de datos.

## 3. Upsell por producto (regresa el flujo anterior)

Problema actual: al agregar en silencio, las adiciones/bebidas del carrito ya no se asocian visualmente a un producto y el upsell de bebida por producto se perdió en productos simples.

Solución: **hoja de upsell post-agregado**, siempre atada al producto recién agregado.

- Nuevo componente `src/components/kp/PostAddUpsellSheet.tsx`:
  - Encabezado: "Sumaste **{producto}**" con miniatura y precio, para que quede claro a qué pedido se le están añadiendo cosas.
  - Cuerpo: reutiliza `useUpsellGroups` (adiciones → bebidas → postres → acompañamientos) mostrando el grupo activo, con el mismo estilo brutalista.
  - Los ítems agregados desde aquí se etiquetan con el nombre del producto padre (`nota`/etiqueta visible en el carrito: "para KING PAPA"), sin cambiar el cálculo de precios.
  - Dos CTA fijos al pie: **"Seguir en el menú"** (cierra) y **"Ir al checkout"**.
- `ProductCard.tsx`: tras agregar un producto simple, en lugar de sólo un toast se abre esta hoja.
- `ProductCustomizerSheet.tsx`: al confirmar, se cierra el personalizador y se abre la hoja de upsell del mismo producto (se mantiene además el bloque de bebidas dentro del personalizador).
- Analytics: `upsell_shown`, `upsell_added`, `upsell_skipped`, `upsell_to_checkout` con `producto_padre_id`.

## Notas técnicas

- No se toca la carga de menú, sedes, carrito ni checkout más allá de la etiqueta de producto padre en los ítems de upsell.
- Todo con tokens semánticos existentes (`kp-yellow`, `kp-ink`, `kp-cheese`) y targets ≥44px.
