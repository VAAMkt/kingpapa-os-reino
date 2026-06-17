# Plan "Zero-Touch": Auto-abandono y eliminación de botones manuales

Pasamos de un sistema semi-asistido a uno 100% autónomo. Tres cambios quirúrgicos, sin tocar webhook, RLS ni schema.

## 1. `src/routes/gracias.tsx` — quitar botón manual

- Eliminar el botón **"Actualizar estado"** y el handler que llama a `reconcileOrder`.
- Mantener únicamente el texto informativo cuando `status === 'enviado'` >5 min:
  > "Estamos confirmando tu pedido con la cocina. Si tarda más de 10 min, escribenos a whatsapp."
- El backoff silencioso del `TrackerOperativo` sigue trabajando de fondo. El cliente no carga ninguna tarea.

## 2. `src/routes/admin.integraciones.tsx` — panel solo-lectura

- Mantener la card **"Pedidos huérfanos"** como observabilidad pura: conteo + lista de los 10 más viejos (UUID, `rp_pedido_id`, edad, status).
- Eliminar los botones **"Reconciliar todos"** y los botones de reconciliar individual.
- Eliminar los `useServerFn(reconcileOrphanOrders)` / `useServerFn(reconcileOrder)` del componente y cualquier estado de loading/toast asociado.
- La server function `reconcileOrphanOrders` se queda en el archivo pero deja de tener caller en UI (se puede borrar en una limpieza futura — no la toco ahora para no romper imports si algo más la usa). `listOrphanOrders` se mantiene.

## 3. Auto-Kill a los 45 min — TTL en dos capas

### 3a. `src/components/kp/TrackerOperativo.tsx`

- Reemplazar el corte actual basado en `MAX_BACKOFF_TOTAL_MS` (30 min desde mount) por un corte basado en `order.created_at`:
  - Constante nueva: `ORDER_TTL_MS = 45 * 60_000`.
  - Dentro de `scheduleNext()`, si `Date.now() - new Date(order.created_at).getTime() > ORDER_TTL_MS` → no llamar `reconcile`, no reprogramar. El siguiente `reconcileOrder` (disparado por mount de otra sesión o por el propio backoff antes del corte) hará el Auto-Kill server-side y Realtime cerrará el ciclo.
- Añadir `created_at` al `select` y al tipo `OrderRow`.

### 3b. `src/lib/orders.reconcile.functions.ts` — regla inicial en `reconcileOne`

Justo después de leer la fila y antes del rate-limit / llamada RP:

```ts
const ageMs = Date.now() - new Date(row.created_at).getTime();
const ABANDON_AFTER_MS = 45 * 60_000;
if (
  ageMs > ABANDON_AFTER_MS &&
  (row.status === "enviado" || row.status === "recibido")
) {
  await supabaseAdmin.from("orders").update({
    status: "cancelado",
    cancel_reason: "timeout_sistema: Abandonado por falta de respuesta en POS tras 45 min",
    cancelled_at: new Date().toISOString(),
  }).eq("id", row.id);
  await supabaseAdmin.from("rp_sync_log").insert({
    tipo: "reconcile",
    ok: true,
    mensaje: `auto-abandon: ${row.status} → cancelado (>${ABANDON_AFTER_MS / 60_000} min)`,
    payload: { order_id: row.id, rp_pedido_id: row.rp_pedido_id, age_min: Math.floor(ageMs / 60_000) },
  });
  return { changed: true, status: "cancelado", source: "reconcile", message: "auto_abandon" };
}
```

- Añadir `created_at` al `select` de `reconcileOne`.
- Cero llamadas a RP para pedidos vencidos → servidor protegido.
- Como el `UPDATE` toca `orders`, Realtime dispara → `TrackerOperativo` recibe `cancelado` (terminal) → limpia su timer → muestra card roja con el motivo. Ciclo cerrado sin humanos.

## Lo que NO se toca

- Webhook (`/api/public/rp-webhook`), tabla `orders`, RLS, migrations.
- Cliente RP, checkout, mapeo de estados.
- Lógica de backoff exponencial (60/120/180/300s) — sigue igual, solo cambia el corte total.
- Rate-limit de 20s entre reconciles.

## Resultado

- Cliente: ve la pantalla "pensar" sola; si pasa lo peor, ve "cancelado" con motivo claro y CTA WhatsApp — sin botones.
- Admin: panel de **observabilidad pura**, sin tareas pendientes.
- Servidor: deja de pollear pedidos zombi a los 45 min; cualquier sesión que reabra el tracker dispara el Auto-Kill en la primera llamada.

¿Procedo?  
  
**El Plan "Zero-Touch" es 100% Aprobado. La lógica de Auto-Kill en dos capas (front y server) usando** `created_at` **es exactamente la arquitectura que buscaba.**

**ANTES DE EJECUTAR, AÑADE ESTA MEJORA CRUCIAL AL PLAN (Botón Inteligente de WhatsApp):**

Ya tenemos un botón de "Escribir a la sede por WhatsApp" en la UI de `/gracias` (o en el Tracker). Vamos a hacerlo inteligente para optimizar el tiempo de nuestro Call Center.

1. **Lógica del Mensaje (Helper):** Crea una función que tome el objeto `order` actual de la página de gracias y construya un string de texto estructurado. El texto debe verse más o menos así: *"Hola KingPapa, necesito ayuda con mi pedido.* *Referencia: #{rp_pedido_id}* *A nombre de: {customer_name}* *Teléfono: {customer_phone}* *Dirección: {delivery_address}* *Pedido: [Iterar sobre la lista de items (cantidad x nombre)]"*
2. **Integración en el Botón:**

- El botón de contacto debe estar SIEMPRE visible en la pantalla (no importa en qué estado esté el tracker, ni si hubo timeout).
- Pasa el string generado por `encodeURIComponent()` y pásalo al `href` del botón apuntando al enlace de `[https://wa.me/](https://wa.me/)<NUMERO_DE_KINGPAPA>?text=<MENSAJE_ENCODED>`. (Asegúrate de usar el número de WhatsApp oficial que ya esté configurado en el proyecto o pon una variable/constante clara para él).

**Agrega esta generación del link de WhatsApp al plan "Zero-Touch" y PROCEDE A EJECUTAR TODO EL CÓDIGO INMEDIATAMENTE. Despliega los cambios y avísame.**  
  
**whatsapp de call center kingpapa: +57 317 2455336**