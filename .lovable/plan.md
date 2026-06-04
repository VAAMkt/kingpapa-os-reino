Confirmación inicial:
- Tienes razón: yo no ejecuté un pedido real. El pedido real lo hiciste tú desde la web.
- No puedo devolver créditos directamente desde aquí; eso debe gestionarlo soporte/billing de Lovable. Sí puedo dejar la evidencia técnica clara para que revisen el caso.

Hallazgos del último pedido:
- Pedido `160162`: creado correctamente en KINGPAPA Limonar, quedó en la web como `enviado`.
- Pedido `160163`: creado correctamente en KINGPAPA Limonar a las `18:35:49 UTC`, con nota `PRUEBA`, y Restaurant.pe respondió `160163`.
- En ambos casos, nuestra base tiene `rp_pedido_id` correcto y sede `KINGPAPA Limonar`.
- Después del envío de `160163`, no aparece ningún `webhook_raw` ni `webhook` real de Restaurant.pe en `rp_sync_log`.
- El único `webhook_raw` reciente fue una prueba técnica con `curl`, con token incorrecto; no venía de Restaurant.pe.

Conclusión técnica provisional:
- Si Restaurant.pe hubiera llamado nuestro endpoint con `{ deliveryId: 160163, statusCode: 0 }`, el código actual lo habría marcado como `cancelado`.
- Como no aparece ni siquiera el log crudo `webhook_raw`, el problema más probable no está en el parseo del webhook, sino en que Restaurant.pe no está llamando la URL configurada para Limonar, o la está llamando a otra URL/token/ambiente.

Plan de revisión minuciosa:
1. Documentar la línea de tiempo exacta de `160162` y `160163`: creación, respuesta de Restaurant.pe, sede, local_id `9`, estado local y ausencia de webhook posterior.
2. Revisar que la URL configurada en Limonar sea la URL pública publicada, no la preview, y que incluya exactamente el parámetro `?t=...` vigente.
3. Hacer una prueba controlada desde fuera simulando exactamente el body oficial de Restaurant.pe para demostrar que nuestro endpoint sí cancela cuando recibe `statusCode: 0` con el token correcto.
4. Repetir la prueba real: crear/cancelar desde Call Center y consultar `rp_sync_log` desde el timestamp de cancelación.
5. Si no entra `webhook_raw`, enviar a Restaurant.pe el ticket con evidencia: pedidos `160162/160163`, sede Limonar, local_id `9`, hora UTC, URL configurada y prueba de que nuestro endpoint no recibió ninguna llamada.
6. Si sí entra `webhook_raw` pero no cambia estado, corregir el parser o el matching contra `rp_pedido_id` según el payload real recibido.

Resultado esperado:
- Separar definitivamente si el fallo es de emisión/configuración en Restaurant.pe o de procesamiento en nuestra web.
- Dejar pruebas verificables para soporte de Restaurant.pe y para soporte de créditos/billing de Lovable.