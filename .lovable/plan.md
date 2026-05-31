# Plan: Checkout 1-click "Pedir a Domicilio"

Objetivo: reducir fricción al máximo. Domicilio siempre por defecto cuando hay cobertura, todo en una sola pantalla, un único botón grande de conversión, y un envío de pedido limpio y validado.

## 1. Domicilio por defecto (de verdad)

**Archivos:** `src/lib/cart.ts`, `src/routes/checkout.tsx`, `src/components/kp/OrderIntentDialog.tsx`

- Cambiar la inicialización del `orderType` en `cart.ts` para que arranque en `"delivery"` en vez de `null`/`"pickup"`.
- En `checkout.tsx`, al montar: si `sede.enCobertura` y `orderType !== "pickup"` explícitamente elegido por el usuario, forzar `"delivery"`. Solo respetar `"pickup"` cuando la sede está fuera de cobertura o el usuario lo eligió activamente en esta sesión.
- Limpiar cualquier valor previo de `localStorage` (`kp.orderType`) que pueda venir de sesiones viejas con `"pickup"` si la sede actual sí tiene cobertura — migración suave en la carga inicial.
- Verificar que `OrderIntentDialog` también preseleccione `delivery` (ya se hizo, pero revalidar que no se sobrescriba después).

## 2. Checkout en una sola pantalla, sin pasos extra

**Archivo:** `src/routes/checkout.tsx`

- Mantener la grilla actual (formulario + resumen lado a lado) pero:
  - Quitar el bloque grande de "Tipo de pedido" con 3 botones; reemplazar por un **pill discreto** arriba ("🛵 Domicilio a {dirección} · cambiar") que solo abre `OrderIntentDialog` si el usuario quiere cambiar.
  - Quitar el campo "Notas para la cocina" del flujo principal; moverlo a un `<details>` colapsado ("Agregar nota para la cocina").
  - Método de pago: mantener pero compactar a una fila horizontal de chips en vez de 3 botones grandes.
  - CTA final: un único botón gigante **"Pedir a Domicilio · $XX.XXX"** (variant `fire`, full width, sticky en mobile).
- En mobile, el resumen colapsa a un acordeón "Ver pedido (3 items · $XX.XXX)" arriba del formulario; el CTA queda fijo abajo.
- Eliminar el `<aside>` lateral en mobile (ya lo hace `lg:`), pero garantizar que el botón de confirmar sea sticky en pantallas chicas.

## 3. Validación amigable + payload consolidado

**Archivos:** `src/routes/checkout.tsx`, (server ya hecho en `src/lib/orders.functions.ts`)

- Refactor de `validar()` para devolver un objeto `{ field, message }` y marcar el input con borde rojo + mensaje inline (no solo toast). Validar:
  - nombre no vacío
  - teléfono ≥ 7 dígitos
  - dirección obligatoria si `tipo === "delivery"`
- Consolidar la construcción del payload en una función pura `buildOrderPayload()` dentro del componente — un solo objeto, fácil de leer, listo para `submitCheckoutOrder`.
- Mantener el server function actual (ya valida con Zod y arma el envío a Restaurant.pe) — no se toca el backend.

## Lo que NO se toca

- Integración Restaurant.pe (`orders.server.ts`) — ya funciona y está validada server-side.
- Tabla `orders` y RLS.
- Lógica de cobertura / geocoding.

## Resultado esperado

Usuario entra a `/checkout` → ve su dirección, sus datos, su pedido y un botón rojo enorme "Pedir a Domicilio". Un solo click, sin elegir tipo de entrega, sin modales, sin pasos. Si algo falta, el campo se marca en rojo sin romper el flujo.

### Lo que NO se toca

Establecer límites estrictos sobre la base de datos (RLS) y la integración del backend ([Restaurant.pe](http://Restaurant.pe)) es vital cuando se trabaja con IA para evitar que por arreglar el frontend, rompa la conexión con tu orquestador. Esta sección del plan está perfecta.