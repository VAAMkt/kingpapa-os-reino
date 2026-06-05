## Diagnóstico (con datos de la base)

Miré los últimos 15 POST que Restaurant.pe envió al webhook (`rp_sync_log` tipo `webhook_raw`):

- Los **bodies llegan bien** (`{ "deliveryId": "160161", "statusCode": "2", ... }`).
- Las cancelaciones **sí se envían** (`statusCode: "3"` aparece varias veces — ej. 160070-160075).
- **TODOS los recientes tienen `query_token_match: false`** → el webhook responde 401 y nunca actualiza el pedido.

La única vez reciente que funcionó (`enviado → cancelado` el 04-jun 18:42) fue cuando `token_ok: true`.

### Por qué falla el token

La URL que copiaste/pegaste en Restaurant.pe es:

```
https://project--340d46a4-b783-4a2a-a2a1-295d9ea3dcbc.lovable.app/api/public/rp-webhook?t=<e80c1ecaebafdaf22e40c5b98e453907>
```

Los `<` y `>` son **literales** en la URL. Restaurant.pe los manda URL-encoded como `%3C...%3E`, así que el servidor recibe `t=%3Ce80c...%3E` que **no** coincide con `RP_WEBHOOK_SECRET`. Por eso devuelve 401 y los pedidos cancelados nunca se actualizan en tu pantalla.

El dominio (`project--...lovable.app` vs `kingpapa.co`) **no es el problema** — ambos resuelven al mismo backend. La instrucción mostraba `<TOKEN>` como placeholder y se quedaron los corchetes.

## Solución

### Paso 1 — Corregir la URL en Restaurant.pe (tú, 30 segundos)

En **Menú → Mi Restaurant → Integraciones → URI de actualización de deliverys**, reemplaza por:

```
https://kingpapa.co/api/public/rp-webhook?t=e80c1ecaebafdaf22e40c5b98e453907
```

**Sin** los `<` ni `>`. Guarda y dispara una cancelación de prueba desde el POS.

(Usar `kingpapa.co` también es válido y más estable que el subdominio interno; cualquiera de los dos funcionará una vez quitados los corchetes.)

### Paso 2 — Verificar (yo, tras confirmación)

Consulto `rp_sync_log` y confirmo que los próximos POST traen `query_token_match: true` y producen un log `webhook` con `enviado → cancelado` (u otra transición). Si pasa, listo.

### Paso 3 — Endurecer el webhook (yo, opcional pero recomendado)

Para que no vuelva a pasar silenciosamente:

1. En `src/routes/api/public/rp-webhook.ts`: cuando el token no coincide, además del 401 hacer trim de `<` `>` y, si **eso** coincide, loguear en `rp_sync_log` un mensaje explícito `"token con corchetes — corregir URL en RP"`. Sirve solo como avisador, no autoriza el request.
2. En `/admin/pedidos`, agregar un badge "Webhook KO últimas 24h" si hay logs `webhook_raw` con `query_token_match: false`, para detectarlo en futuro.

Este paso 3 es solo defensa en profundidad, no es necesario si confirmas que ya editaste la URL.

## Sobre el tracking en pantalla

El tracking en `/gracias` ya está suscrito por Realtime a `orders` filtrando por id, y `TrackerOperativo` también. En cuanto el webhook actualice `status = "cancelado"`, el cambio aparecerá en vivo sin recargar. No hay nada que arreglar ahí — el bloqueador es exclusivamente el token.

## Confírmame

¿Edito el webhook con el paso 3 (badge + log de aviso), o lo dejamos solo con el fix de URL en Restaurant.pe?