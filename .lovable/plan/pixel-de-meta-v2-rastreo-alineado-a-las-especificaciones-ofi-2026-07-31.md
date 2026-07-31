# Pixel de Meta v2 — rastreo alineado a las especificaciones oficiales

La guía que compartiste ("Specifications for Meta Pixel standard events") define los eventos estándar y, sobre todo, **los parámetros que cada evento debe llevar**. Hoy el pixel ya dispara los eventos correctos, pero manda menos parámetros de los que Meta espera y en un par de casos con IDs inconsistentes. Eso baja la calidad de coincidencia y limita la optimización por valor.

## Problemas detectados hoy

1. **IDs de producto inconsistentes**: `AddToCart` envía el id del catálogo, pero `Purchase` envía la *clave de carrito* (`item.key`, que incluye personalizaciones). Meta ve dos catálogos distintos y no puede cerrar el círculo carrito → compra.
2. **Falta el arreglo `contents`**: Meta recomienda `contents: [{ id, quantity, item_price }]` además de `content_ids`. Sin cantidad ni precio por ítem no se puede optimizar bien por valor.
3. **Eventos estándar sin usar** que la app ya tiene instrumentados internamente:
   - búsqueda en el menú → `Search`
   - clic en categoría → `ViewCategory`
4. **Parámetros faltantes**: `AddToCart` sin cantidad, `InitiateCheckout` sin `contents` ni `content_ids`, `AddPaymentInfo` sin valor del pedido, `Lead` sin `content_name`.
5. **Sin `eventID` en la mayoría de eventos**: solo `Purchase` lo tiene. Sin él no se podrá deduplicar si más adelante activamos Conversions API.

## Qué se va a hacer

### 1. Un único ID de producto en todo el embudo
Se normaliza a `producto_id` del catálogo (sin sufijos de personalización) en ViewContent, AddToCart, InitiateCheckout y Purchase. Purchase pasa a leer el id de catálogo de cada línea del pedido, no la clave del carrito.

### 2. Parámetros completos por evento (según la spec)

| Evento | Parámetros que quedarán |
|---|---|
| ViewContent | content_type, content_ids, content_name, content_category, value, currency |
| Search | search_string, content_category |
| ViewCategory | content_category, content_ids |
| AddToCart | content_type, content_ids, contents[{id,quantity,item_price}], content_name, value, currency |
| InitiateCheckout | content_ids, contents, num_items, value, currency |
| AddPaymentInfo | content_category (método), value, currency |
| Purchase | content_ids, contents, num_items, value, currency, + eventID por pedido |
| Lead | content_name ("franquicia"), content_category |

Todo en COP.

### 3. `eventID` en todos los eventos
Cada evento llevará un id único (o determinista, como en Purchase). No cambia nada hoy, pero deja el terreno listo para Conversions API sin doble conteo.

### 4. Advanced Matching (mejora grande de calidad de coincidencia)
En el checkout ya tenemos teléfono y nombre del cliente. El pixel de Meta permite pasarlos en `fbq('init', ...)` **hasheados en el navegador** (SHA-256, nunca en claro). Esto sube fuerte el "Event Match Quality" y hace que Meta reconozca a más compradores.

Se enviarán solo: teléfono (formato E.164 con 57), nombre y apellido si están, ciudad y país. No se envía dirección, ni notas, ni nada más. Si prefieres no activar esto, lo dejamos fuera y el resto del plan sigue igual.

### 5. Verificación
Con Meta Pixel Helper / Test Events: recorrer home → menú (búsqueda y categoría) → agregar producto → checkout → método de pago → pedido, y confirmar que cada evento aparece una sola vez y con los parámetros de la tabla.

## Detalle técnico

- `src/lib/meta-pixel.ts`: reescribir `mapEvent` con la tabla anterior, agregar helpers `contents()`/`eventId()`, exportar `pixelAdvancedMatch(user)` que hashea con `crypto.subtle` antes de reenviar a `fbq('init', ID, {ph, fn, ln, ct, country})`.
- `src/lib/analytics.ts`: sin cambios de API; sigue reenviando cada `track(...)`.
- Emisores que necesitan enriquecer su payload (solo agregar campos, sin tocar lógica de negocio):
  - `src/routes/menu.tsx` — `menu_search_started` pasa a incluir el término; `category_clicked` ya trae nombre.
  - `src/components/kp/ProductCard.tsx` y `ProductCustomizerSheet.tsx` — incluir `cantidad` y `categoria`.
  - `src/routes/checkout.tsx` — `checkout_started` con líneas del carrito; `payment_method_selected` con total.
  - `src/routes/gracias.tsx` — Purchase con `contents` e ids de catálogo (se guarda el `producto_id` en `kp.lastOrder`).
- Nada de esto toca el backend, los pedidos ni la integración con Restaurant.pe.

## Fuera de alcance

Conversions API (servidor a servidor). Es el siguiente paso natural para recuperar conversiones que bloquean iOS y los ad-blockers; con los `eventID` de este plan queda listo para hacerse después sin duplicar eventos.
