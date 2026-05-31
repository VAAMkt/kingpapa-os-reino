# Cirugía al payload de `rpRegistrarDelivery`

Objetivo: que la cocina vea los modificadores en el ticket, que el POS identifique los pedidos como Web, que la caja cuadre cuando el pago ya está hecho online/tarjeta, y que el motorizado tenga referencia + geo.

Todo el cambio vive en `src/lib/orders.server.ts` dentro de `submitOrder` (construcción del `payload` y mapeo de `listaPedidos`). No se toca `resolveOrder`, ni `restaurantpe.server.ts`, ni la UI, ni la DB.

## Cambios exactos

### 1. Modificadores → `pedido_observacion` (crítico cocina)

En el `map` de `listaPedidos`, en vez de `pedido_observacion: ""`, concatenar los modificadores que el cliente eligió para esa línea + nota general como prefijo del primer ítem si aplica.

```text
formato: "(Nx) Nombre opción, (Nx) Nombre opción"
ejemplo: "(1) Fuze Tea, (1) Sin cebolla"
```

- Fuente: `d.modificadores[]` (ya viene resuelto con `nombre` en `DetallePedido`).
- Si no hay modificadores, queda `""` (comportamiento actual).
- Cada modificador cuenta como cantidad 1 (el POS de Restaurant.pe no soporta cantidades de modificador a nivel línea en este endpoint).

### 2. Identidad Web y origen

Agregar dentro de `payload.delivery`:

- `delivery_numero`: marcador visual para el POS. Como el `localId` (uuid) se conoce **después** del insert, vamos a:
  - Generar el uuid del pedido **antes** del insert con `crypto.randomUUID()`, pasarlo explícito al `.insert({ id, ... })`, y derivar `"#WEB-" + id.slice(0,6).toUpperCase()`.
  - Esto NO pisa el flujo de `rp_numero_comanda` (que sigue siendo el número corto real del POS, escrito por el polling). Es solo el marcador que ve el cajero en la cabecera del POS hasta que Restaurant.pe le asigna su propio correlativo.
- `delivery_origentipo: 3` (API/Web).

### 3. Trazabilidad de pagos (cuadre de caja)

Reescribir el bloque de pago dentro de `payload.delivery`:


| pago     | delivery_pagocon | delivery_montopagado | delivery_pago_pendiente | delivery_tipopago | tarjeta_id |
| -------- | ---------------- | -------------------- | ----------------------- | ----------------- | ---------- |
| efectivo | total            | 0                    | total                   | 1                 | null       |
| datafono | 0                | total                | 0                       | 2                 | 1          |
| online   | 0                | total                | 0                       | 5                 | null       |


Nota: hoy "online" todavía no tiene pasarela integrada, pero marcarlo como ya pagado evita que la caja lo deje pendiente. Cuando entre la pasarela real, se añade `transaccion_id` (TODO existente en el header del archivo).

### 4. Referencias de dirección

Ya cumple: `delivery_referencia: input.cliente.detalles ?? ""`. Solo se añade un comentario aclarando que las indicaciones (Apto/Torre/portería) viajan **exclusivamente** ahí, y `delivery_direccionenvio` queda con la dirección base limpia (sin concatenar detalles). Verificar que ningún caller esté metiendo "Apto X" dentro de `cliente.direccion`.

### 5. Coordenadas

Agregar `delivery_lat` y `delivery_lng` en `payload.delivery`.

Hoy el schema de `cliente` (en `src/lib/orders.functions.ts`) **no acepta lat/lng**. Para no romper el contrato:

- Extender `checkoutSchema.cliente` con `lat?: number | null` y `lng?: number | null` opcionales.
- Extender el tipo `CheckoutInput.cliente` en `orders.server.ts` igual.
- En el payload: `delivery_lat: input.cliente.lat ?? null`, `delivery_lng: input.cliente.lng ?? null`.
- El frontend (`PlacesAutocomplete` → `CartDrawer` → `submitCheckoutOrder`) puede empezar a enviarlas cuando esté listo; mientras tanto viajan `null` y no rompe nada.

## Detalle técnico (sección dev)

Orden de operaciones nuevo en `submitOrder`:

```text
1. resolveOrder(input)               // igual
2. localId = crypto.randomUUID()     // NUEVO: id determinístico
3. buildObservacion(d)               // NUEVO: helper para línea de pedido
4. payload = { delivery: {...}, cliente: {...}, listaPedidos: [...] }
                                     // con los 5 campos nuevos
5. supabaseAdmin.from('orders').insert({ id: localId, ... })
6. rpRegistrarDelivery(payload)      // igual
7. polling de comanda + update       // igual
```

Helper local:

```ts
function buildPedidoObservacion(d: DetallePedido): string {
  const mods = d.modificadores.map(m => `(1) ${m.nombre}`);
  return mods.join(", ");
}
```

Snippet del bloque pago (reemplaza las 3 líneas actuales `delivery_pagocon` + `delivery_tipopago` + `tarjeta_id`):

```ts
const esEfectivo = input.pago === "efectivo";
const tipoPago = esEfectivo ? 1 : input.pago === "datafono" ? 2 : 5;
// ...
delivery_pagocon: esEfectivo ? total : 0,
delivery_montopagado: esEfectivo ? 0 : total,
delivery_pago_pendiente: esEfectivo ? total : 0,
delivery_tipopago: tipoPago,
tarjeta_id: input.pago === "datafono" ? 1 : null,
delivery_numero: `#WEB-${localId.slice(0, 6).toUpperCase()}`,
delivery_origentipo: 3,
delivery_lat: input.cliente.lat ?? null,
delivery_lng: input.cliente.lng ?? null,
```

## Validación post-cambio

1. Hacer un pedido de prueba con un producto que tenga modificadores + nota general + pago datáfono.
2. Revisar en el POS de Restaurant.pe:
  - Cabecera muestra `#WEB-XXXXXX`.
  - Ticket de cocina lista los modificadores debajo de la línea.
  - El pedido aparece como ya pagado (no pendiente).
3. Revisar `rp_sync_log` para ver el `payload.request` enviado.
4. Probar pago efectivo: caja debe mostrarlo como pendiente de cobro (motorizado cobra).

## Fuera de alcance

- Integración real de pasarela online (Mercado Pago / PSE) y `transaccion_id`.
- Cambiar el shape del polling / `rp_numero_comanda` (sigue siendo la fuente de verdad del número corto real).
- UI de captura de lat/lng en el checkout (el campo queda opcional para activarlo después).

**Consideraciones para la ejecución:**

1. Modifica `orders.server.ts` y asegúrate de inyectar correctamente la función auxiliar `buildPedidoObservacion`.
2. Modifica `orders.functions.ts` extendiendo el esquema de Zod (`checkoutSchema`) de forma segura (`lat?: number | null`, `lng?: number | null`) para no romper el frontend actual.
3. Al finalizar, corre un chequeo de tipos (TypeScript) para asegurar que la inyección del `id` autogenerado en `.insert({ id: localId, ... })` coincide con el esquema de Supabase.