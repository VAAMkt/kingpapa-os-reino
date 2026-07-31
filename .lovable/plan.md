# Pixel de Meta (Facebook) en KINGPAPA

Objetivo: que Facebook sepa quién avanza en el embudo y quién termina comprando, para optimizar campañas y crear públicos (compradores, abandonos de carrito).

## Qué se instala

1. El código del pixel `1348178064148165` se carga una sola vez en toda la app (script en el `head` del layout raíz + el `noscript` de respaldo).
2. `PageView` se dispara en cada cambio de página (la app es de navegación interna, así que se envía en cada ruta, no solo al cargar).

## Eventos del embudo que se envían

Se conectan a los eventos que ya existen en la app, sin duplicar lógica:

| Momento en la app | Evento en Meta |
|---|---|
| Ver un producto / abrir personalizador | ViewContent |
| Agregar al carrito (tarjeta, personalizador o upsell) | AddToCart |
| Abrir el carrito | (interno, sin evento Meta) |
| Entrar al checkout | InitiateCheckout |
| Elegir método de pago | AddPaymentInfo |
| Pedido creado con éxito | **Purchase** (valor total en COP) |
| Enviar formulario de franquicia | Lead |

Cada evento lleva valor, moneda (COP), ids de producto y cantidad, para que Meta pueda optimizar por valor de compra.

## Quién compra y quién no

- **Purchase** se dispara solo cuando el pedido queda confirmado (en la página de gracias, usando el pedido real), con un `event_id` único por pedido para no contar dos veces si el usuario recarga.
- Con eso Meta arma automáticamente: público de compradores, público de "agregó al carrito pero no compró" y público de "inició checkout y no compró".

## Detalle técnico

- Nuevo módulo `src/lib/meta-pixel.ts`: carga del pixel, `fbq` tipado, envío seguro (no rompe si el bloqueador de anuncios lo bloquea) y mapeo evento interno -> evento estándar de Meta.
- `src/lib/analytics.ts` reenvía al pixel además de GA, para no tocar las ~30 llamadas `track(...)` que ya existen.
- El script y el `noscript` se agregan en `src/routes/__root.tsx`.
- El `Purchase` se emite desde `src/routes/gracias.tsx` con el total y la referencia del pedido (deduplicado por `order_id` en `sessionStorage`).
- No se envían datos personales (nombre, teléfono, dirección) al pixel.

## Fuera de alcance por ahora

Conversions API (envío servidor-a-servidor con hash de teléfono/email para recuperar conversiones que el navegador bloquea). Se puede hacer después como fase 2 si querés más precisión en iOS/bloqueadores.

## Verificación

Con la extensión Meta Pixel Helper: ver PageView en el home, AddToCart al agregar un producto, InitiateCheckout en el checkout y Purchase una sola vez en la página de gracias.
