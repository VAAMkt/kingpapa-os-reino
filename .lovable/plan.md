
## Problema

En `/gracias` mostramos en grande `159282`, que es el `rp_pedido_id` (ID interno de la base de datos de Restaurant.pe, equivalente al `delivery_id`). El POS y el cliente final ven `#158733`, que es el `delivery_numero` (correlativo de comanda). Hoy ya guardamos ese valor en `orders.rp_numero_comanda` cuando el polling funciona, pero la UI nunca lo usa como identificador visual principal.

## Cambios (solo UI/presentación)

### 1. `src/routes/gracias.tsx` — mostrar la comanda real del POS

- Suscribirse a la fila `orders` (por el `resolvedId` UUID) vía Supabase realtime + fetch inicial, exponiendo `rp_numero_comanda` y `rp_pedido_id`.
- En la tarjeta amarilla "Guarda este código":
  - Si `rp_numero_comanda` existe → mostrarlo en grande como `#158733` (con `#` prefijado solo si el valor no lo trae).
  - Mientras no exista todavía → mostrar un placeholder discreto ("Asignando comanda…") en vez del ID interno.
  - Debajo, en texto pequeño tipo "ref interna: 159282", mantener `rp_pedido_id` para soporte.
- El `order_id` de la URL (ya saneado de comillas) se sigue usando solo para resolver el UUID; deja de ser lo que el cliente ve grande.

### 2. `src/components/kp/TrackerOperativo.tsx` — badge consistente

- Quitar el fallback `<BrutalBadge>Comanda #{idLargo}</BrutalBadge>` cuando `rp_numero_comanda` aún no llegó. Mostrar "conectando…" hasta que el polling escriba la comanda real.
- Mantener `ref: <rp_pedido_id>` debajo en monoespaciada para soporte interno.
- Sin cambios en lógica de polling/realtime: ya escucha UPDATE de la fila y `pollOrderFromRp` ya escribe `rp_numero_comanda` cuando `rpObtenerDelivery` responde.

### 3. Sin cambios de backend / DB

- `pollOrderFromRp`, `rpObtenerDelivery` y `extractComandaNumber` ya hacen el trabajo correcto (`delivery.delivery_numero` con fallback `venta_seriedoc-venta_numdoc`).
- No tocamos esquema ni RLS.

## Validación

1. Abrir `/gracias?order_id=159282`. Inicialmente el bloque grande muestra "Asignando comanda…" y debajo "ref interna: 159282".
2. En ≤ 20 s (tick de polling) la tarjeta cambia a `#158733` (o el `delivery_numero` que devuelva el POS) y el badge del tracker también.
3. Si el endpoint público V2 sigue caído, el bloque grande nunca cambia pero ya no se confunde al cliente con el ID interno; el `rp_pedido_id` queda visible solo como referencia técnica.

## Fuera de alcance

- Reparar la disponibilidad del endpoint `obtenerDelivery` público (es lo que ya intentamos en `restaurantpe.server.ts`; si el dominio público sigue cerrado, el plan B sigue siendo el botón manual "Actualizar POS" en `/admin/pedidos`, que ya existe en el plan previo).
- Cambiar mapeo de estados, motorizado o motivo de cancelación.
