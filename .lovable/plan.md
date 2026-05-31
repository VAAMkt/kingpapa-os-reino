## Objetivo
Cerrar el ciclo del tracker hoy mismo, sin depender del POS interno de Restaurant.pe. La fuente de verdad pasa a ser Supabase: el operador mueve estados desde `/admin/pedidos` y el cliente los ve en vivo vía Realtime.

## Cambios

### 1. Bug UUID en `/gracias` y Tracker
Hoy la URL es `?order_id=159269` (numérico = `rp_pedido_id`) y el código consulta `orders.id = eq.159269`, lo que rompe con `ZodError: Invalid uuid` y un 400 en la red.

- `src/components/kp/TrackerOperativo.tsx`: detectar si `orderId` es UUID (regex) o numérico.
  - UUID → consultar y suscribir Realtime por `id=eq.<uuid>`.
  - Numérico → consultar por `rp_pedido_id=eq.<num>`, leer el `id` UUID resultante y suscribir Realtime usando ese UUID (Realtime filter exige el id real).
- `src/routes/gracias.tsx`: `validateSearch` acepta tanto string numérico como UUID (ya lo hace). Sin cambios funcionales más allá del copy (ver punto 2).

### 2. Copy / UX: "Código de Remisión Web"
En `/gracias` y en el Tracker, renombrar el número largo para que deje de leerse como "comanda equivocada".

- `src/routes/gracias.tsx`:
  - Cambiar "Guarda este código por si tu motorizado pregunta" por **"Tu Código de Remisión Web"**.
  - Añadir nota pequeña: *"El código interno en el ticket del local puede variar, pero este es tu comprobante oficial."*
- `src/components/kp/TrackerOperativo.tsx`:
  - Reemplazar el badge `Comanda #...` por `Remisión #<rp_pedido_id>`.
  - Eliminar la línea `ref: ...` y la lógica que prioriza `rp_numero_comanda` (ya no la perseguimos).

### 3. Desactivar polling al POS
- `src/components/kp/TrackerOperativo.tsx`: eliminar el `setInterval` con `pollFn`, el `useServerFn(pollOrderFromRp)` y el import. El tracker queda 100% Realtime + fetch inicial.
- `src/lib/orders.poll.functions.ts` y `src/lib/restaurantpe-normalize.ts`: dejar el código en disco pero no referenciarlo desde el cliente (lo reactivaremos cuando Restaurant.pe entregue endpoint oficial). No tocar `orders.server.ts` (la llamada post-registro en submit es server-side y se completa rápido; si falla es silenciosa).
- `src/routes/admin.pedidos.tsx`: quitar el botón "Actualizar desde POS" para no inducir errores en el operador.

### 4. Fase C — Cancelaciones por Realtime
Verificar (sin código nuevo) que el flujo end-to-end funciona:
- Operador en `/admin/pedidos` cambia status a `cancelado` y escribe `cancel_reason`.
- RLS ya permite UPDATE a editores/super_admin.
- La publicación `supabase_realtime` debe incluir `public.orders`. Si no está, agregarla por migración:
  ```sql
  alter publication supabase_realtime add table public.orders;
  alter table public.orders replica identity full;
  ```
  (Se ejecuta solo si `supabase--read_query` confirma que la tabla no está ya en la publicación.)
- El Tracker ya muestra bloque rojo con motivo cuando `status='cancelado'` y dispara `toast.error`.

## Verificación
- Build limpio.
- Recargar `/gracias?order_id=159269` → sin `ZodError`, badge "Remisión #159269", tracker en "Recibimos tu pedido".
- Desde `/admin/pedidos` cambiar a `en_preparacion` → en la otra pestaña el cliente avanza solo.
- Cambiar a `cancelado` con motivo → bloque rojo + toast inmediato.

## Fuera de alcance
- Reintegración con endpoint oficial de Restaurant.pe (Opción 1) — pendiente de soporte.
- Eliminar archivos `orders.poll.functions.ts` / `restaurantpe-normalize.ts` (se conservan para la Fase 2).
