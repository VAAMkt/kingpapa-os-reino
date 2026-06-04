## Objetivo

Confirmar empíricamente, después de publicar la versión log-first del webhook, si Restaurant.pe emite POST cuando cancelas el pedido 160162 desde call center. **Cero cambios de código.**

## Pre-requisito

La versión log-first ya debe estar publicada (último deploy con `src/routes/api/public/rp-webhook.ts` que guarda `webhook_raw` antes de validar token). Sin publish, el endpoint productivo sigue validando antes de loggear y no veremos huella si RP llama con token incorrecto.

## Pasos

1. **Marca de tiempo de inicio**: anoto el `now()` antes de tu acción para filtrar limpio en `rp_sync_log`.

2. **Tú cancelas 160162 desde call center** (o creas un pedido nuevo desde Limonar y lo cancelas — lo que prefieras).

3. **Espero ~30s** y consulto `rp_sync_log` filtrando por `created_at > marca` y `tipo IN ('webhook_raw','webhook')`.

4. **Tres escenarios posibles:**

   - **A) Llega `webhook_raw` con `query_token_match=true` y body parseable** → el endpoint funciona, RP emite. Cierro caso (no hay ticket que enviar).
   - **B) Llega `webhook_raw` con `query_token_match=false`, o body vacío, o headers raros** → tenemos evidencia exacta del problema (token mal copiado, content-type, etc.). Adjunto el `payload` crudo al ticket para RP.
   - **C) No llega nada** → RP no está emitiendo. Ticket queda confirmado y listo para enviar tal cual está en `/mnt/documents/rp-soporte-webhook-cancelacion.md`. Te paso el resumen ejecutivo + ruta del archivo.

## Lo que NO se toca

- Ningún archivo de código.
- Ninguna migración, tabla, UI, ni flujo de checkout.
- Ningún cambio en `restaurantpe.server.ts` ni `orders.functions.ts`.

## Entregable

- Resultado del escenario (A/B/C) con los IDs de `rp_sync_log` correspondientes.
- Si B o C: confirmación de que el ticket en `/mnt/documents/rp-soporte-webhook-cancelacion.md` está listo (o actualización mínima con el nuevo `payload` capturado).
