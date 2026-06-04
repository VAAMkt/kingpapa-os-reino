## Objetivo

Confirmar que el problema está 100% del lado de Restaurant.pe (no en nuestro webhook) y entregarte un paquete de evidencia listo para escalar a soporte. **Cero cambios de UI. Cambios mínimos de código.**

## Hechos verificados

- Pedido 160162 creado OK desde Limonar (18:17:56 UTC, 4-jun).
- 0 `webhook_raw` para 160162 (ni aceptación, ni cancelación).
- Último `webhook_raw` en toda la base: 2-jun (pedido 159666). Más de 2 días sin tráfico de RP.
- La URL y token configurados en la sede Limonar coinciden con los que ya funcionaron antes.

## Pasos

### 1) Self-test del endpoint (sin cambios de código)

Simular un POST al webhook con el mismo formato que RP usaría:

```
POST https://kingpapa-os-reino.lovable.app/api/public/rp-webhook?t=<RP_WEBHOOK_SECRET>
Body: {"deliveryId": 160162, "statusCode": "0"}
```

- Esperado: HTTP 200, una nueva fila `webhook_raw` y otra `webhook` con `enviado → cancelado` para el pedido 160162.
- Si esto funciona (lo más probable, dado que ya recibimos webhooks reales antes), queda probado que el endpoint está vivo y el problema es 100% emisor (RP).

Esto se hace con `stack_modern--invoke-server-function`; no requiere editar archivos.

### 2) Reforzar el log para diagnóstico (1 archivo, ~15 líneas)

**Archivo:** `src/routes/api/public/rp-webhook.ts`

Pequeños ajustes para que cualquier futuro POST de RP deje una huella aún más completa, sin cambiar el comportamiento:

- Capturar también `method` y `url` (con el path completo y query) en el `payload` del `webhook_raw`.
- Capturar el `content-length` y el `host` recibido (útil para detectar si RP está llamando otro hostname/preview/published por equivocación).
- Si el body crudo viene vacío, dejarlo explícito en `mensaje`.

Esto no toca lógica de negocio ni la UI.

### 3) Actualizar el borrador de ticket para Restaurant.pe

**Archivo:** `/mnt/documents/rp-soporte-webhook-cancelacion.md` (sobreescribir versión actual).

Reestructurar el ticket con los hechos nuevos:

- **Asunto:** Webhook V2 dejó de emitirse: 0 notificaciones desde 2-jun-2026 a pesar de tener la integración configurada (dominio + sede Limonar)
- **Dominio:** 5272 — **Local:** 9 (KingPapa Limonar)
- **WebHook URI configurada (ambos niveles, dominio y local):** `https://kingpapa-os-reino.lovable.app/api/public/rp-webhook?t=***`
- **Última notificación recibida:** 2-jun-2026 02:43 UTC (delivery 159666 — secuencia 2→3→4 completa).
- **Evidencia posterior (sin webhook):**
  - 159734 cancelado desde pendientes → 0 POST.
  - 159749 cancelado desde pendientes → 0 POST.
  - 159613 cancelado desde lista de aceptados (screenshot) → 0 POST.
  - **160162** creado desde Limonar el 4-jun 18:17 UTC, aceptado y cancelado desde call center → 0 POST.
- **Auto-prueba:** confirmamos que nuestro endpoint responde 200 a un POST manual con la firma esperada (resultado del paso 1).
- **Pregunta concreta:** ¿pueden disparar un test de webhook desde su panel hacia esta URL? ¿La configuración del WebHook a nivel de sede requiere un paso adicional (re-habilitar accesos, reiniciar token, contactar soporte)? ¿Hay algún whitelist de IP de salida que debamos contemplar?

### 4) Entregable

- Confirmación en chat del resultado del self-test (200 o no, con el id del nuevo log).
- Ruta del ticket actualizado: `/mnt/documents/rp-soporte-webhook-cancelacion.md` (descargable).

## Lo que NO se toca

- UI (sin componentes nuevos, sin pantallas nuevas).
- Tablas / migraciones (`rp_sync_log` ya tiene todo lo necesario).
- Polling (sigue eliminado, confirmado en la limpieza anterior).
- `restaurantpe.server.ts`, `orders.functions.ts`, ningún flujo de checkout.
