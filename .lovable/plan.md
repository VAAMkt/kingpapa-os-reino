## Plan revisado (alertas de arquitectura incorporadas)

Fases B y C aprobadas para ejecución. Fase A se reemplaza por una **sonda de descubrimiento aislada** — sin tocar producción ni añadir polling ciego.

---

### Fase B — Notas del cliente al POS

**Archivo:** `src/lib/orders.server.ts`

Cambio único en el payload enviado a `rpRegistrarDelivery`:

```diff
 cliente: {
   cliente_nombres: input.cliente.nombre,
   cliente_apellidos: "",
   cliente_dniruc: "",
   cliente_direccion: input.cliente.direccion ?? "",
   cliente_telefono: input.cliente.telefono,
   cliente_email: "",
+  cliente_observacion: input.notas ?? "",
 },
 ...
 delivery: {
   ...
-  delivery_observacion: input.notas ?? "",
+  delivery_observacion: input.notas ?? "",   // se mantiene como respaldo
 }
```

Doble inserción intencionada: `cliente_observacion` alimenta "Ver notas del cliente" en el POS de Restaurant.pe v2, y mantenemos `delivery_observacion` por si una sede tiene la vista vieja. Sin migraciones.

---

### Fase C — UX de cancelación robusta en `TrackerOperativo`

**Archivo:** `src/components/kp/TrackerOperativo.tsx`

- Cuando llega un UPDATE por Realtime con `status === "cancelado"` y el estado anterior NO era cancelado → disparar `toast.error("Tu pedido fue cancelado. Mira el motivo abajo.")`.
- En la rama `isError` con status `cancelado`:
  - Si `cancel_reason` existe → mostrar `Motivo: {cancel_reason}` (ya implementado).
  - Si `cancel_reason` es `null` → mostrar mensaje genérico: *"Tu pedido fue cancelado desde el local. Contáctanos por WhatsApp para más detalles."*
- Detener el `setInterval` de fetch (no recargar más una vez en estado terminal).

Sin polling al POS, sin nuevos endpoints, sin migraciones. La cancelación desde el POS llegará a la web solo cuando exista el endpoint correcto descubierto en la sonda (Fase A diferida).

---

### Fase A (diferida) — Sonda de descubrimiento aislada

**Sin código de producción.** Ejecutar un único script one-shot en el sandbox (`/tmp/probe_rp.ts`) que:

1. Lee `RESTAURANT_PE_TOKEN` y `RESTAURANT_PE_DOMINIO` del entorno.
2. Hace **una sola pasada** (no loop, no retry) contra una lista cerrada de 5 candidatos, usando como ID el último pedido conocido (`159267`):
   ```
   GET  {READ_BASE}/delivery/{dominio}/{id}
   GET  {READ_BASE}/pedido/{dominio}/{id}
   GET  {WRITE_BASE}/delivery/{dominio}/{id}
   GET  {WRITE_BASE}/pedido/{dominio}/{id}
   POST {WRITE_BASE}/delivery/obtenerDelivery/{dominio}   body: { pedido_id: id }
   ```
3. Para cada candidato imprime: método, URL, status HTTP, primeros 400 chars de body.
4. **Sin reintentos, sin recursión, sin paralelismo**: 5 requests totales y termina.

**Entregable de la fase A:** pegar en el chat el resultado para que tú confirmes cuál endpoint devolvió 200 y qué clave contiene el número visible (`#158718`). Solo entonces diseñaremos juntos la arquitectura de sincronización (probablemente un cronjob server-side, no polling por cliente).

**Hasta entonces:** la UI sigue mostrando `rp_pedido_id` como fallback del badge (cosmético, sin riesgo).

---

### Orden de ejecución

```text
1. Fase B (1 archivo, ~2 líneas)
2. Fase C (1 archivo, toast + mensaje genérico)
3. Build limpio
4. Sonda A one-shot → pegar resultado en chat
5. STOP. Esperar tu visto bueno con el endpoint correcto antes de tocar nada más.
```

### Lo que explícitamente NO se hace en este turno

- ❌ No se añade `pollOrderFromRp` ni `setInterval` que llame al POS.
- ❌ No se añaden más candidatos a `rpObtenerPedido` en producción.
- ❌ No se hace fallback con `listarDeliveries` bajo ninguna circunstancia.
- ❌ No se loguea contra `rp_sync_log` desde la sonda (es one-shot en sandbox, no producción).

### Archivos a tocar

```text
src/lib/orders.server.ts                  ← Fase B
src/components/kp/TrackerOperativo.tsx    ← Fase C
/tmp/probe_rp.ts                          ← Fase A (efímero, no se commitea)
```

Sin migraciones. Sin secrets nuevos. Sin nuevas rutas.
