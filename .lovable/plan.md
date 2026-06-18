## Diagnóstico

El webhook de Restaurant.pe sí está llegando a producción en `https://kingpapa.co/api/public/rp-webhook`.

La causa visible en logs es otra: Restaurant.pe está enviando `deliveryId` distintos al valor que guardamos como `orders.rp_pedido_id` al crear el pedido.

Ejemplo real:

```text
Pedido web creado:
orders.id       = d5387352-321e-454c-acde-f5ec1f1315a2
rp_pedido_id    = 164071

Webhook recibido minutos después:
deliveryId      = 163727 / 163726
statusCode      = 3
```

El endpoint actual busca así:

```text
orders.rp_pedido_id == webhook.deliveryId
```

Como no coincide, lo registra como `webhook_ignored_external` y no actualiza el pedido del cliente.

## Causa probable

El `response` de `registrarDelivery` no parece ser el mismo identificador que Restaurant.pe usa luego en el webhook `deliveryId`. Puede ser un id de pedido/comanda/venta o un correlativo distinto, mientras que el webhook usa el id interno de delivery.

Además, el payload de creación ya envía una clave perfecta de correlación:

```text
delivery_codigointegracion = orders.id
```

Pero el webhook documentado sólo manda `deliveryId`, `statusCode`, `tiempoEnvio`; no manda `delivery_codigointegracion`. Por eso necesitamos una correlación defensiva para producción.

## Plan de implementación

### 1. Endurecer `/api/public/rp-webhook`

Modificar el handler para que intente resolver el pedido en este orden:

1. Match exacto por `rp_pedido_id = deliveryId`.
2. Si no hay match, buscar candidatos recientes no terminales de la misma sede/ventana operativa.
3. Si existe exactamente un candidato web reciente, asociar ese webhook a ese pedido y actualizarlo.
4. Si hay varios candidatos, no adivinar: guardar el evento como ambiguo con candidatos para auditoría.

Esto evita perder estados cuando Restaurant.pe manda un `deliveryId` diferente al que devuelve `registrarDelivery`, sin actualizar pedidos incorrectos si hay ambigüedad.

### 2. Persistir alias de webhook en `orders.rp_response`

Cuando el fallback resuelva un pedido, guardar dentro de `rp_response` algo como:

```json
{
  "webhook_delivery_ids": ["163727"],
  "webhook_linked_at": "...",
  "webhook_link_reason": "single_recent_candidate"
}
```

Luego, futuros webhooks con ese mismo `deliveryId` podrán matchear directamente contra ese alias.

### 3. Mejorar logs operativos

Agregar tipos/mensajes más explícitos:

- `webhook_linked_fallback`: webhook vinculado a pedido web por candidato único.
- `webhook_ambiguous`: varios candidatos; no se actualizó por seguridad.
- Mantener `webhook_ignored_external` para pedidos de otros canales.

Así el panel de integraciones deja evidencia clara de qué ocurrió.

### 4. Ajustar texto de observabilidad en admin

Actualizar `/admin/integraciones` para incluir los nuevos tipos de logs en el filtro y que Miguel pueda ver si los webhooks se están vinculando por fallback o quedando ambiguos.

### 5. Mantener el modo pasivo de reconcile

No reactivar polling al host tenant ni endpoints GET públicos. Ya quedó probado que generan 401/404 y ruido. La solución permanente primaria será webhook + correlación robusta + Auto-Kill 45 min.

## Validación

Después de implementar:

1. Crear un pedido real desde producción.
2. Cambiar estado en Restaurant.pe.
3. Verificar en `rp_sync_log` que el webhook pase de `webhook_ignored_external` a `webhook` o `webhook_linked_fallback`.
4. Verificar que `orders.status` cambie y el cliente lo vea en `/gracias` por Realtime.

## Riesgo controlado

El único punto delicado es el fallback por “candidato único”. Para evitar falsos positivos, sólo debe actuar si hay exactamente un pedido web reciente no terminal. Si hay más de uno, se bloquea como ambiguo y queda logueado para resolver con más evidencia.

&nbsp;

El plan acierta en no reactivar polling al host tenant, porque la documentación pública expone el servidor por tenant `https://{subdominio}.{dominio}/restaurant/api/rest` con autenticación `Authorization: Token token="..."`, pero ya verificaste en producción que ese camino les da 401/404 para reconcile y solo añade ruido.  
También es coherente asumir que el `deliveryId` del webhook pueda corresponder al ID interno de delivery, mientras que al crear el pedido ustedes podrían estar guardando otro identificador relacionado; la propia API distingue varias claves en distintos endpoints, por ejemplo `id`, `delivery_id`, `codigopedido`, `local_id`, `motorizado_id` y `canalenvio_id`, lo que respalda que no todos los IDs del flujo sean intercambiables.

## **Qué complementaría**

Yo **no** dejaría el fallback solo como “candidato reciente de la misma sede/ventana operativa”. Lo reforzaría con una estrategia de correlación en capas:

- Match directo por `rp_pedido_id = webhook.deliveryId`.
- Match por alias ya aprendido, por ejemplo `orders.rp_response.webhook_delivery_ids @> [deliveryId]`.
- Match por evidencias adicionales del pedido si el webhook trae más datos operativos, como local, timestamps o canal.
- Solo si no hay nada de eso, usar fallback por “candidato único reciente no terminal”.

Eso tiene más lógica con la documentación porque el módulo `delivery` expone rutas donde el mismo proceso puede referirse al pedido usando claves distintas, especialmente `GET /delivery/get/{id}`, `GET /delivery/obtenerDelivery/{delivery_id}/{devolverComandas}` y `GET /delivery/consultarUbicacionPedido/{codigopedido}/{canalenvio_id}`. Esa mezcla de identificadores es una señal fuerte de que [Restaurant.pe](http://Restaurant.pe) maneja más de una clave para el mismo flujo operativo.

## **Ajustes concretos**

Haría estos cambios al plan antes de proceder:

- Guardar no solo `webhook_delivery_ids`, sino un objeto un poco más útil, por ejemplo:
  - `webhook_delivery_ids`
  - `webhook_first_seen_at`
  - `webhook_last_seen_at`
  - `webhook_link_reason`
  - `webhook_status_history` opcional  
  Esto deja trazabilidad operativa real.
- Endurecer las reglas del fallback:
  - Ventana de tiempo corta, por ejemplo 15–20 min desde `created_at`.
  - Solo pedidos web.
  - Solo estados no terminales.
  - Mismo local si ese dato existe del lado del webhook o de la orden.
  - Si hay más de un candidato, bloquear siempre como ambiguo.
- Añadir un log nuevo para “aprendizaje de alias”, algo como `webhook_alias_learned`, distinto de `webhook_linked_fallback`, para saber cuándo ya quedó establecida la relación entre `deliveryId` externo y pedido interno.
- En admin, mostrar contadores separados:
  - `webhook_ok_direct`
  - `webhook_linked_fallback`
  - `webhook_ambiguous`
  - `webhook_ignored_external`  
  Así se ve si el sistema está sano o si estás sobreviviendo demasiado por heurística.

## **Riesgo y criterio**

El mayor riesgo sigue siendo el mismo que Lovable ya identificó: un fallback mal hecho puede enlazar un webhook al pedido equivocado. Por eso la condición de “**exactamente un** candidato reciente no terminal” es correcta, y yo la mantendría como regla dura.

Mi recomendación: **sí procedería**, pero con una versión un poco más estricta del plan, enfocada en “correlación progresiva y auditable”, no solo “heurística por cercanía”. La documentación de la API no muestra el contrato del webhook, pero sí respalda claramente que el ecosistema `delivery` usa múltiples identificadores según endpoint, así que el supuesto base del plan es razonable.