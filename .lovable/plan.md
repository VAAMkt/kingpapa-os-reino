## Diagnóstico

Pedido #163581 aparece en Restaurant.pe web como **CONFIRMADO**, pero con badge rojo "ENVIANDO" y tooltip "Aún no ha llegado a Quipu". El POS del local (QuipuPOS de escritorio) no está recibiendo el pedido vía socket.

**Causa en código** (`src/lib/orders.server.ts`, payload de `rpRegistrarDelivery`):

```ts
delivery: {
  ...
  emitSocket: false,
}
```

RP utiliza `emitSocket` para empujar el delivery al Quipu instalado en el PC del local en tiempo real. Con `false` el pedido queda visible en web pero no se notifica al desktop POS, exactamente el síntoma del tooltip.

## Cambio quirúrgico (única edición)

### `src/lib/orders.server.ts`

1. Calcular antes del payload:
  ```ts
   const emitSocket = process.env.RP_EMIT_SOCKET === "true";
  ```
2. Reemplazar `emitSocket: false` por `emitSocket,` en el objeto `delivery`.
3. Incluir `emitSocket` en el `payload` que se guarda en `rp_sync_log` (tipo `order`) para dejar evidencia de cada envío.

Nada más. No tocar:

- `delivery_origen` (no comprobado en docs, no se añade).
- `delivery_estado` (semántica ambigua, no se añade).
- Webhook, tracker, reconciliación, RLS, migraciones, cliente Supabase.
- `delivery_codigointegracion = localId` (se mantiene).

## Configuración en producción

Crear/actualizar la variable de entorno del servidor:

```
RP_EMIT_SOCKET=true
```

Con eso queda activo. Para rollback inmediato sin redeploy: cambiar a `false`.

Como `RP_EMIT_SOCKET` es un secret del runtime, antes de mergear el cambio te voy a pedir agregarlo con el formulario seguro (no se escribe en el repo).

## Validación en sede tras desplegar con `RP_EMIT_SOCKET=true`

1. Crear un pedido real en producción.
2. Verificar que aparece en Restaurant.pe web (call-center).
3. Cronometrar: el badge "ENVIANDO / Aún no ha llegado a Quipu" debe desaparecer en <30 s.
4. Confirmar que el Quipu desktop del local lo muestra sin refrescar manualmente.
5. Confirmar que se imprime comanda / aparece en cocina.
6. Mover el estado desde Quipu y verificar que el webhook + tracker se mueven.
7. En `/admin/integraciones` revisar el log `order` y confirmar que aparece `"emitSocket": true`.

## Si tras el cambio el badge sigue rojo

Deja de ser problema de código. Causas operativas a verificar con Restaurant.pe o con la sede:

- Quipu cerrado o sin internet en el PC del local.
- Usuario de Quipu logueado en otro local.
- `rp_local_id` mapeado a una sede distinta a la que opera el Quipu.
- Socket/push no habilitado por RP para ese dominio/local.
- Firewall del local bloqueando la conexión persistente.

En ese caso, mensaje sugerido a Restaurant.pe:

> El pedido se registra correctamente vía `registrarDelivery`, pero queda en web con badge "ENVIANDO" y tooltip "Aún no ha llegado a Quipu". Estamos enviando `emitSocket: true`. Necesitamos confirmar si el dominio/local tiene habilitado el push socket hacia QuipuPOS y si el `local_id` usado corresponde al Quipu instalado en la sede.

## Fuera de alcance

- Cualquier campo nuevo en el payload de `registrarDelivery` sin validación previa.
- Reactivación de polling contra RP.
- Cambios en webhook, tracker, esquema o RLS.

# Único ajuste que haría al plan

La frase:

> “Para rollback inmediato sin redeploy: cambiar a false.”

La corregiría así:

```

```

```
Para rollback sin cambio de código: cambiar RP_EMIT_SOCKET=false.
Según el proveedor de hosting, puede requerir reiniciar el runtime o redeploy para que tome la nueva variable.
```

Muchas plataformas no refrescan variables de entorno en caliente. No es un problema del plan, pero conviene no prometer rollback “sin redeploy” si el runtime no lo permite.

---

# Logging: pequeño detalle

El plan dice “incluir `emitSocket` en el payload que se guarda en `rp_sync_log`”.

Hoy el log ya guarda:

```

```

```
payload: {
  request: payload,
  response: rpResponse,
  cabecera: rpCabecera,
  order_id: localId,
}
```

Entonces, si `emitSocket` queda dentro de `payload.delivery`, ya quedará registrado dentro de `request.delivery.emitSocket`.

Pero para auditar más fácil, yo agregaría también un campo top-level en el log:

```

```

```
payload: {
  request: payload,
  response: rpResponse,
  cabecera: rpCabecera,
  order_id: localId,
  emitSocket,
}
```

No cambia comportamiento, solo mejora trazabilidad.

---

# Consulta útil para validar en Supabase

Después de probar un pedido:

```

```

```
select
  created_at,
  ok,
  mensaje,
  payload->>'order_id' as order_id,
  payload->>'emitSocket' as emit_socket_top_level,
  payload->'request'->'delivery'->>'emitSocket' as emit_socket_request,
  payload->'request'->'delivery'->>'local_id' as rp_local_id
from rp_sync_log
where tipo = 'order'
order by created_at desc
limit 20;
```

Lo esperado:

```

```

```
emit_socket_top_level = true
emit_socket_request = true
rp_local_id = local correcto de la sede
```

---

# Decisión final

**Ejecutaría este plan.**

Versión aprobada:

```

```

```
1. Agregar `const emitSocket = process.env.RP_EMIT_SOCKET === "true";`
2. Reemplazar `emitSocket: false` por `emitSocket,`
3. Agregar `emitSocket` al log `rp_sync_log` tipo `order`
4. Configurar `RP_EMIT_SOCKET=true` en producción
5. Probar pedido real en sede
6. Confirmar que desaparece “ENVIANDO / Aún no ha llegado a Quipu”
```