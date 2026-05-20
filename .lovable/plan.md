## 1. Pre-seleccionar "Domicilio" cuando hay cobertura

El 98% de pedidos web son a domicilio. Hoy `OrderIntentDialog` abre un modal cada vez que falta `orderType` y obliga a elegir.

Cambios:
- **`src/components/kp/OrderIntentDialog.tsx`**: cuando hay sede real y `enCobertura === true`, llamar `setOrderType("delivery")` automáticamente (sin abrir el diálogo). Se mantiene la apertura manual vía `openOrderIntent()` para el botón "Cambiar" del checkout y carrito. Solo se sigue forzando `pickup` si la sede no tiene cobertura.
- **`src/routes/checkout.tsx`**: el fallback del `tipo` ya prioriza `delivery` cuando hay cobertura — sin cambios funcionales, solo verificar tras el ajuste anterior.

Resultado: usuarios con dirección en cobertura entran directo al menú/checkout en modo Domicilio sin fricción. Pueden cambiar a "Recoger" desde el botón explícito.

## 2. Upsell rotativo, cerrable, con secuencia Adiciones → Bebidas → Postres

Hoy `UpsellSection` muestra hasta 3 productos de *cualquier* categoría complementaria mezclados, y no se puede cerrar.

Cambios en **`src/components/kp/UpsellSection.tsx`**:

- Refactor del hook `useUpsellSuggestions` para devolver **grupos** por categoría en orden de prioridad fijo: `adicion` → `bebida` → `postre` → `acompan`. Cada grupo expone `{ key, label, productos }` y filtra `excludeIds`.
- Nuevo estado local en `UpsellSection`:
  - `currentIdx` (índice del grupo activo).
  - `dismissed: Set<string>` (claves de grupos cerrados por el usuario en esta sesión del componente).
  - Se calcula `activeGroup = primer grupo no dismissed con productos`. Si no hay, no renderiza nada.
- Header del bloque:
  - Título dinámico por grupo: `"Súmale una adición"`, `"¿Lo acompañas con bebida?"`, `"Cierra con un postre 👑"`, `"Pídele un acompañamiento"`.
  - Botón "✕" en la esquina superior derecha que agrega el `key` actual a `dismissed` → al cerrar uno aparece automáticamente el siguiente grupo (bebidas tras cerrar adiciones, etc.).
- Cuando el usuario tappea "+ Agregar" en un producto:
  - Se hace el `addItem({ silent: true })` como hoy.
  - **Además** se marca el grupo actual como `dismissed` (auto-rotación al siguiente grupo). Esto cumple "cuando elija una me aparezca la de bebidas".
- Hasta 3 productos por grupo (mismo `max`), pero el `max` aplica por grupo, no global.
- Se mantiene el `addItem` silencioso (no abre drawer).

`ProductCustomizerSheet.tsx` y `CartDrawer.tsx` siguen usando `<UpsellSection />` igual; reciben el nuevo comportamiento gratis. El `excludeIds` del carrito sigue ocultando productos ya pedidos.

## 3. Integración real del checkout con Restaurant.pe

Hoy `confirmar()` en `src/routes/checkout.tsx` genera el `orderId` con `newOrderId()` (totalmente local, "KP-XXXX"), guarda en `localStorage` y redirige. Nunca llama a Restaurant.pe. Ya existe el helper server-only `rpRegistrarDelivery(payload)` en `src/lib/restaurantpe.server.ts` pero nadie lo invoca.

### 3.1 Nuevo server function `submitOrderToRp`

Archivo nuevo: **`src/lib/orders.functions.ts`**

```text
export const submitOrderToRp = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    sedeId: z.string().uuid(),
    tipo: z.enum(["delivery","pickup"]),
    pago: z.enum(["efectivo","datafono","online"]),
    cliente: { nombre, telefono, direccion?, detalles? },
    notas?: string,
    items: [{
      productoId: uuid,   // productos_master.id
      cantidad: int 1..50,
      modificadores?: [{ grupoId, opcionId }]
    }],
  }))
  .handler(async ({ data }) => { ... })
```

Lógica del handler (en `orders.functions.ts` + helper en `orders.server.ts`):

1. **Resolver sede** vía `supabaseAdmin`: `sedes.select("id, nombre, rp_local_id, almacen_id?, ...").eq("id", sedeId)`. Si no tiene `rp_local_id` → error claro.
2. **Resolver productos**: `productos_master.select("id, rp_id, precio, almacen_id, nombre").in("id", productIds)`. Construir mapa por id.
3. **Calcular precios server-side** (no confiar en el cliente): para cada item usar `precio_override` si existe en `sede_producto_overrides`, si no `productos_master.precio`. Sumar modificadores buscando precio en `productos_master.modificadores`.
4. **Armar payload Restaurant.pe** con el shape esperado por `registrarDelivery` (basado en el patrón v2 que ya usamos en `obtenerCartaPorLocal`/`getStockProducto`):
   - `local_id`, `tipo_entrega` (1=delivery, 2=recojo), método de pago.
   - `cliente`: `{ nombres, telefono, direccion, referencia }`.
   - `detalle`: array de `{ producto_id (rp_id), almacen_id, cantidad, precio_unitario, modificadores: [{ grupo_id, modificador_id, precio }], comentario }`.
   - `monto_total`, `observaciones` (notas cocina).
5. **Llamar** `rpRegistrarDelivery(payload)`. Restaurant.pe responde con un id/comanda real (campo típico `pedido_id` o `comanda`). Extraer ese id.
6. **Persistir copia local** en una tabla `orders` (ver 3.2) con `rp_pedido_id`, status, snapshot.
7. **Devolver** `{ orderId: <rp_pedido_id>, total, items }`.

Si Restaurant.pe falla:
- Registrar en `rp_sync_log` con `tipo: "order"`, `ok: false`, `mensaje: <error>` y el payload.
- Lanzar error al cliente con mensaje legible ("No pudimos enviar tu pedido al sistema de la sede, intenta de nuevo o llámanos al WhatsApp").

> Nota: el shape exacto de `registrarDelivery` depende del swagger v2 de Restaurant.pe. Si al implementar la primera llamada el endpoint devuelve `tipo != "1"`, ajustamos los nombres de campos según el mensaje de error que devuelva la API y dejamos la respuesta cruda en `rp_sync_log` para depurar.

### 3.2 Migración Supabase — tabla `orders`

```text
public.orders (
  id uuid PK default gen_random_uuid(),
  user_id uuid null,          -- si está logueado
  sede_id uuid not null FK sedes(id),
  rp_pedido_id text null,     -- id devuelto por Restaurant.pe
  rp_payload jsonb not null,  -- payload enviado
  rp_response jsonb null,     -- respuesta cruda
  status text not null default 'enviado',  -- enviado | rechazado | error
  tipo text not null,         -- delivery | pickup
  pago text not null,
  cliente jsonb not null,
  items jsonb not null,
  subtotal numeric not null,
  total numeric not null,
  notas text null,
  created_at timestamptz default now()
)
```

RLS:
- `select`: el dueño (`auth.uid() = user_id`) o admins (`has_role(auth.uid(),'admin')`).
- `insert`: solo desde el server (service role bypassa); políticas de cliente bloqueadas.
- Sin `update`/`delete` para clientes.

### 3.3 Cambios en `src/routes/checkout.tsx`

- Eliminar `newOrderId()`.
- `confirmar()` pasa a ser `async`, llama a `useServerFn(submitOrderToRp)` con sede/items/cliente.
- Mientras está en vuelo: mantener `enviando=true`, deshabilitar botón.
- Con éxito: `clearCart()`, `localStorage.setItem("kp.lastOrder", ...)` con el `rp_pedido_id` real, redirigir a `/gracias?order_id=<rp_pedido_id>`.
- Con error: `toast.error(err.message)`, reactivar formulario, **no** limpiar carrito.

### 3.4 `src/routes/gracias.tsx`

Ya consume `localStorage.getItem("kp.lastOrder")`. Como el `orderId` ahora es el real, basta que el `order_id` mostrado al usuario y el guardado en localStorage sean el `rp_pedido_id`. Verificar el texto del header ("Tu comanda en cocina: #XXX").

## Archivos tocados

- `src/components/kp/OrderIntentDialog.tsx` — auto-pick delivery en cobertura.
- `src/components/kp/UpsellSection.tsx` — grupos rotativos + cerrar + auto-avance.
- `src/lib/orders.functions.ts` (nuevo) — `submitOrderToRp`.
- `src/lib/orders.server.ts` (nuevo) — armado de payload y llamada a `rpRegistrarDelivery`.
- `src/routes/checkout.tsx` — `confirmar` async contra el server function.
- Migración: tabla `orders` + RLS.

## Fuera de alcance

- Pasarela de pago online real (sigue siendo "próximamente"; el flow pasa el método elegido a Restaurant.pe pero el cobro online no se procesa).
- Tracker en vivo del pedido vía Restaurant.pe (consultaríamos su endpoint de estado en otro ciclo).
- Cambios al mapa, geocodificación, auth o sistema de puntos.
