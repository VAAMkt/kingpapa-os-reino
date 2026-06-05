## Objetivo

Liberar el 92% del tráfico legítimo de Restaurant.pe que se está rechazando con 401 porque su cliente HTTP (RestSharp) recorta el `?t=...` del URI.

## Cambio único — `src/routes/api/public/rp-webhook.ts`

### 1. POST: eliminar validación de token

Quitar todo el bloque de validación del query param `t`:
- Borrar la lectura de `url.searchParams.get("t")` y `process.env.RP_WEBHOOK_SECRET` en el POST.
- Borrar el bloque de detección de corchetes `<...>` y su log defensivo.
- Borrar el `return new Response("unauthorized", { status: 401 })`.

El endpoint queda 100% público. Se conserva:
- Log crudo inmediato (`tipo: 'webhook_raw'`) con IP, headers, body, URL.
- Parseo Zod (sigue siendo fallo suave → 200).
- Mapeo `mapWebhookStatusCode`.
- Lookup por `rp_pedido_id`, update de `status` + ETA en `rp_response`, logs enriquecidos con candidatos.

En el log crudo, simplificar el `payload`: quitar `query_token_present` y `query_token_match` (ya no aplican).

### 2. Zod schema — sin cambios

El schema actual ya cumple:
```ts
deliveryId: z.union([z.number(), z.string()]).transform(v => String(v).trim())
statusCode: z.union([z.number(), z.string()]).transform(v => String(v).trim())
tiempoEnvio: z.union([z.number(), z.string(), z.null()]).optional()
  .transform(v => { ... número finito > 0 o null })
```
Se mantiene tal cual.

### 3. GET healthcheck

Mantener la validación de token en el GET — es el único uso "humano" del endpoint (probar desde navegador/curl) y no afecta a Restaurant.pe que sólo hace POST. Sirve como mínimo control de acceso para no exponer públicamente el hint del payload.

## Modelo de riesgo aceptado

- Endpoint POST público acepta cualquier body que matchee el schema.
- Atacante necesitaría adivinar un `deliveryId` válido (ID interno de RP, no expuesto en frontend) Y enviar un `statusCode` válido para mover un pedido existente entre estados.
- Impacto máximo: cambiar el `status` de un pedido (p.ej. marcar como `entregado` o `cancelado` prematuramente). No hay escritura de PII, no hay creación de filas, no hay borrado.
- Mitigación: todo POST queda registrado en `rp_sync_log` con IP y headers → auditable.
- Prioridad: estabilidad operativa > superficie mínima de ataque.

## Lo que NO toco

- `mapWebhookStatusCode` (mapeo oficial OAS3 ya correcto).
- Lógica de update, ETA, candidatos, fallo suave.
- GET healthcheck (mantiene token).
- Secret `RP_WEBHOOK_SECRET` en Lovable Cloud (se conserva por si se reactiva validación en el futuro).
- Frontend, polling (ya eliminado), tracker, DB schema.

## Verificación post-deploy

1. POST sin `?t=` con `{deliveryId:160328, statusCode:0}` → 200, pedido pasa a `cancelado`, log `enviado → cancelado`.
2. POST con `sc=2` → `recibido`. POST con `sc=3` + `tiempoEnvio:30` → `en_camino` + ETA en `rp_response`.
3. POST con `deliveryId` inexistente → 200 + log con `candidatos`.
4. GET sin token → 401 (sin cambios). GET con token correcto → JSON ok.
5. Revisar `rp_sync_log` 30 min después del deploy: ratio de webhooks aceptados debe subir de ~8% a ~100%.
