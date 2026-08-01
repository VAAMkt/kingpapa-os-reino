# Subir la cobertura de la API de Conversiones (AddPaymentInfo)

Meta pide que un porcentaje alto de los eventos del navegador tengan su gemelo de servidor y que ambos compartan buenas claves de deduplicación. Hoy el espejo de servidor ya existe y usa el mismo `event_id`, pero en `AddPaymentInfo` sale casi sin claves de identidad, que es lo que baja la cobertura reportada.

## Qué está pasando hoy (verificado en el código)

- `AddPaymentInfo` se dispara al elegir método de pago en el checkout (`track("payment_method_selected")`).
- Los datos de contacto (nombre, teléfono, ciudad) solo se registran al **enviar** el pedido, es decir *después* de ese evento. Por eso el espejo de servidor de `AddPaymentInfo` viaja sin `ph`/`fn`/`ct`.
- No se envía `external_id` en ningún evento: es la clave de identidad más fuerte y estable para emparejar navegador y servidor.
- `_fbc` solo se lee de la cookie; si Meta no la creó (por ejemplo, primera visita con `fbclid` y bloqueo de cookies de terceros), el evento pierde esa clave.
- El espejo es "dispara y olvida": si el usuario navega justo después, la petición puede cancelarse y ese evento queda solo en navegador.

## Cambios propuestos

1. **Identidad temprana en el checkout.** Registrar nombre, teléfono y ciudad para el emparejamiento en cuanto el usuario termina de escribirlos (al salir del campo), no al enviar el pedido. Así `AddPaymentInfo` —y cualquier evento posterior— ya lleva los datos hasheados.
2. **`external_id` estable.** Generar un identificador anónimo propio, guardado en el navegador, y enviarlo en todos los eventos del pixel y en todos los envíos de servidor (incluida la compra desde el backend). Es la clave de deduplicación que Meta recomienda reforzar.
3. **Rescate de `fbc`.** Si llega `fbclid` en la URL y la cookie `_fbc` no existe, construirla en el formato que espera Meta y persistirla para usarla en navegador y servidor.
4. **Espejo más confiable.** Enviar el evento de servidor de forma que sobreviva a una navegación inmediata (petición con `keepalive`), para no perder envíos en el paso de pago.
5. **Compra desde el backend.** Incluir también `external_id` (y el correo/ciudad ya disponibles del pedido) en el `Purchase` de servidor, con la misma clave `kp-order-<id>` que ya se usa.

## Detalles técnicos

- `src/lib/meta-pixel.ts`: nueva función para fijar el usuario emparejado sin re-inicializar el pixel en cada tecla; `getOrCreateExternalId()` en `localStorage`; captura de `fbclid` → `_fbc`; incluir `external_id` en `fbq('init', ...)` y en cada llamada a `mirror()`.
- `src/lib/capi.functions.ts`: aceptar `externalId` en el esquema Zod (string acotado) y pasarlo a `sendCapiEvents`.
- `src/lib/capi.server.ts`: hashear `external_id` con SHA-256 (hoy va en claro) y mantener el resto igual.
- `src/routes/checkout.tsx`: llamar a la función de emparejamiento en el `onBlur` de nombre/teléfono, además de la llamada actual al enviar.
- `src/lib/orders.server.ts`: propagar `externalId` (enviado desde el cliente al crear el pedido) al `Purchase` de servidor.
- Sin cambios de UI ni de lógica de negocio.

## Verificación

Con el secret `META_TEST_EVENT_CODE` activo, comprobar en "Probar eventos" de Meta que `AddPaymentInfo` aparece como **Navegador y servidor** (una sola vez) y que la tarjeta de calidad en `/admin/integraciones` sube el EMQ de ese evento.
