# Plan definitivo: 4 ajustes de última milla

## 1. Cancelaciones con motivo (Admin → Cliente en vivo)

**Migración**
```sql
ALTER TABLE public.orders ADD COLUMN cancel_reason text;
ALTER TABLE public.orders ADD COLUMN cancelled_at timestamptz;
```

**Admin (`src/routes/admin.pedidos.tsx`)**
- Interceptar el `onChange` del `<select>`: si el nuevo valor es `cancelado`, abrir `Dialog` con `Textarea` "Motivo" + presets: `Fuera de zona`, `Sin stock`, `Local cerrado`, `Cliente no contesta`, `Otro`.
- Confirmar → `UPDATE orders SET status='cancelado', cancel_reason=<motivo>, cancelled_at=now()`. Cancelar el diálogo revierte el `<select>` al valor anterior (estado local controlado).
- Mostrar `cancel_reason` como pie en cards canceladas.

**Tracker (`src/components/kp/TrackerOperativo.tsx`)**
- Añadir `cancel_reason` al SELECT y al tipo `OrderRow`.
- En la rama `isError`/`cancelado`: render `Motivo: {cancel_reason ?? "no especificado"}`. Realtime ya propaga el UPDATE.

## 2. Número corto de comanda (doble llamada API)

**Hallazgo confirmado en producción:** `registrarDelivery` devuelve un ID interno escalar (ej. `159265`) distinto del número de comanda visual del POS (ej. `#158716`).

**Migración**
```sql
ALTER TABLE public.orders ADD COLUMN rp_numero_comanda text;
```

**`src/lib/restaurantpe.server.ts`**
- Añadir helper `rpObtenerPedido(pedidoId: number)` que pegue al endpoint de lectura de Restaurant.pe v2 (`obtenerPedido` / `consultarDelivery` / variante real). Como el shape exacto no está documentado en el código, primero loguear la respuesta cruda en `rp_sync_log` para inspeccionar campos. La función debe ser tolerante: devolver `null` ante 404/error y NO romper el flujo del pedido.

**`src/lib/orders.server.ts` — bloque post-`rpRegistrarDelivery`**
1. Capturar `rpPedidoId` (ya implementado).
2. Si `rpPedidoId` existe, invocar `rpObtenerPedido(rpPedidoId)` dentro de try/catch silencioso.
3. Extraer el número corto desde candidatos: `pedido_numero`, `numero_comanda`, `comanda`, `ticket`, `correlativo`, `numero`. Si la respuesta envuelve en `data`, mirar también ahí.
4. Guardar `rp_numero_comanda` en el mismo `UPDATE` que ya escribe `rp_pedido_id` / `rp_response`. Loguear ambas respuestas crudas en `rp_sync_log.payload` para auditoría.
5. Si la doble llamada falla, dejar `rp_numero_comanda = null` — NO bloquear el pedido.

**UI (`TrackerOperativo.tsx`, `admin.pedidos.tsx`, `gracias.tsx`)**
- Badge principal: `#{rp_numero_comanda ?? rp_pedido_id}`.
- ID largo (rp_pedido_id) como subtítulo pequeño o tooltip para soporte técnico.

## 3. Buscador de pedidos `/tracking`

**Server fn (`src/lib/orders.functions.ts`) → `findRecentOrder`**
- Input zod: `{ query: z.string().min(4).max(60) }`.
- Lógica con `supabaseAdmin` (ventana 24h):
  - Strip a dígitos. Si `query` matchea UUID → buscar por `id`.
  - Si todo dígitos y longitud 4–10 → buscar `rp_pedido_id = q OR rp_numero_comanda = q`.
  - Si dígitos y longitud ≥ 7 → fallback a `cliente->>'telefono' = q` (tomar últimos 10 dígitos para tolerar prefijos).
- Filtro siempre: `created_at > now() - interval '24 hours'`, `ORDER BY created_at DESC LIMIT 1`.
- Devolver solo `{ orderId }` o `{ notFound: true }` (no datos de cliente).

**Ruta `src/routes/tracking.tsx` (pública)**
- Form con un input + botón. Al éxito: `navigate({ to: "/gracias", search: { order_id } })`. Al fallo: `toast.error("No encontramos un pedido reciente con esos datos.")`.

**Navegación**
- Link "Rastrear pedido" en el header (`src/components/kp/Layout.tsx`) y en `/menu` (banner sutil).

## 4. Verificación de métodos de pago

- Confirmado en producción: `efectivo=1` → "Pago contra entrega" en POS.
- Añadir comentario-cabecera en `orders.server.ts` documentando:
  ```
  // delivery_tipopago: 1=Efectivo (contra entrega), 2=Datafono, 5=Online (pago web)
  // tarjeta_id: 1 cuando datafono. Online actualmente sin pasarela.
  // TODO(pasarela): cuando se integre, enviar también delivery_montopagado
  //   y transaccion_id en el payload de delivery.
  ```
- Sin cambios de mapeo.

## Orden de ejecución

```text
1. Migración SQL (cancel_reason, cancelled_at, rp_numero_comanda)
2. Admin: Dialog de cancelación + persistencia del motivo
3. Tracker: render del motivo
4. restaurantpe.server: helper rpObtenerPedido + log crudo
5. orders.server: doble llamada + rp_numero_comanda + UI badges
6. /tracking: server fn findRecentOrder + ruta + links header/menu
7. Doc inline de pagos
8. Build limpio + smoke test (cancelar y crear pedido)
```

## Notas técnicas

- **RLS**: `findRecentOrder` corre con `supabaseAdmin`; input estricto (4–60 chars), respuesta minimizada a `id`.
- **Realtime**: ya activo en `orders`; cubre `cancel_reason` y `rp_numero_comanda` sin cambios.
- **Tipos**: tras la migración los types se regeneran solos; sin `as never` nuevos.
- **Tolerancia a fallos en doble llamada**: el pedido NUNCA debe fallar por no obtener el número corto — solo afecta cosmética del badge.
