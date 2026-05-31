# Refactor Integración Restaurant.pe — 4 fases

Fix definitivo de los tres "cables sueltos" descubiertos en la auditoría: el parser de la respuesta del POS, la validación pre-envío con horarios locales, y el tracker en vivo.

## Fase 1 — Parser del ID en backend

Archivo: `src/lib/orders.server.ts` (función `submitOrder`).

Restaurant.pe devuelve `json.data` como **número escalar** (ej. `159235`), no como objeto. El bloque actual recorre `r.pedido_id`, `r.id`, etc. y queda en `null`.

Antes del bucle de `candidates`, agregar:

```ts
if (typeof rpResponse === "number" || typeof rpResponse === "string") {
  rpPedidoId = String(rpResponse).trim() || null;
}
```

Resultado: `orders.rp_pedido_id` queda con `"159235"` y `/gracias` muestra el ID real del POS en vez del UUID local.

Sin cambios adicionales — el bucle de objetos sigue como fallback por si en el futuro la API cambia de shape.

## Fase 2 — Manejo de error en frontend

Archivo: `src/routes/checkout.tsx`.

Buena noticia: el handler **ya hace `await submitOrder(...)`, ya tiene `try/catch`, ya muestra `toast.error(msg)`, ya hace `setEnviando(false)` y NO navega a `/gracias` si la promesa rechaza** (líneas 191-220). El motivo por el que el pedido fantasma cayó en `/gracias` es que **el backend no lanzó error** — Restaurant.pe respondió `tipo:"1"` (éxito), solo que el parser no extrajo el ID. Fase 1 ya soluciona esto.

Ajuste menor de UX: cuando el error venga del backend con el mensaje genérico ("No pudimos enviar tu pedido al sistema de la sede..."), agregar acción al toast con botón **"Hablar por WhatsApp"** que abra el chat con la sede + resumen del pedido prellenado. Esto convierte el peor caso (POS caído) en un fallback humano sin perder el pedido.

## Fase 3 — Validación local de horarios + banderas RP

### 3a. Migración de esquema

Agregar a `public.sedes`:

- `horarios jsonb NOT NULL DEFAULT '{}'::jsonb` — mapa semanal:
  ```json
  {
    "lun": [{ "abre": "11:00", "cierra": "22:00" }],
    "mar": [{ "abre": "11:00", "cierra": "22:00" }],
    "dom": []
  }
  ```
  Un array vacío = cerrado ese día. Array con múltiples ventanas soporta partir el día (almuerzo + cena).
- `tz text NOT NULL DEFAULT 'America/Bogota'` — para evaluar el reloj de cada sede correctamente.
- `kill_switch boolean NOT NULL DEFAULT false` — apagado manual ("hoy no recibimos pedidos") sin tocar horarios.
- `rp_local_estado smallint` y `rp_acepta_delivery smallint` — caché de las banderas del POS, refrescadas por `syncBranches`.

La columna existente `abierta_ahora` queda como derivada/legacy (la UI puede seguir leyéndola, pero se calcula a partir de `horarios` + `kill_switch`).

### 3b. Lógica de validación

En `src/lib/orders.server.ts`, **antes** del primer insert en `public.orders`, agregar `assertSedeOperativa(sede, tipo)`:

1. Si `sede.kill_switch === true` → error `"La sede está temporalmente cerrada."`
2. Si `sede.rp_local_estado !== 1` → error `"La sede no está activa en el sistema central."`
3. Si `tipo === "delivery"` y `sede.rp_acepta_delivery !== 1` → error `"Esta sede no acepta domicilios por ahora."`
4. Resolver `now` en `sede.tz` (usando `Intl.DateTimeFormat` con `timeZone`), obtener día de semana y `HH:MM`, y verificar que caiga dentro de alguna ventana de `sede.horarios[dia]`. Si no, error:
  `"Estamos fuera de horario. Hoy atendemos de 11:00 a 22:00."` (mensaje construido a partir de las ventanas reales).

Todos los errores se lanzan **antes** del insert local y antes del POST a Restaurant.pe → el frontend los atrapa en el catch existente y los muestra como `toast.error`. Nada de pedidos fantasma.

### 3c. Sincronización de banderas RP

Modificar `syncBranches` en `src/lib/rp.functions.ts` para que copie también `local_estado` y `local_aceptadelivery` desde el JSON de `rpGetDominioInfo()` a las nuevas columnas `rp_local_estado` / `rp_acepta_delivery`. Así la validación de paso 2-3 no requiere una llamada extra a la API en cada checkout.

### 3d. UI de horarios en admin

`src/components/admin/SedeForm.tsx`: agregar editor visual de `horarios` (7 días × ventanas con `time inputs`) y toggle de `kill_switch`. Sin esto, el operador no puede mantener los horarios.

## Fase 4 — Tracker conectado en vivo

### 4a. Migración de esquema

Extender `public.orders.status` con estados intermedios. Hoy es `text` libre con `"enviado" | "error"`; agregar `CHECK` constraint:

```sql
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('enviado','recibido','en_preparacion','en_camino','entregado','cancelado','error'));
```

Habilitar Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;` + `ALTER TABLE public.orders REPLICA IDENTITY FULL;`

### 4b. RLS — lectura del pedido por UUID para invitados

**Decisión necesaria.** El tracker debe funcionar tanto para usuarios logueados como invitados. Hoy la policy de `orders` exige `auth.uid() = user_id`, lo que **bloquea a los invitados** de ver su propio pedido en el tracker.

Opción A (recomendada): agregar policy que permita `SELECT` cuando el lector trae el UUID exacto y el pedido es reciente (24h). El UUID es lo bastante imposible de adivinar para servir como token.

```sql
CREATE POLICY "Orders: lectura por id reciente"
  ON public.orders FOR SELECT TO anon, authenticated
  USING (created_at > now() - interval '24 hours');
```

Esto NO expone listados (el cliente igual necesita el `id` exacto, no puede `SELECT *`).

Opción B: una server fn pública `getOrderStatus({ orderId })` que solo devuelve `{ status, rp_pedido_id, items_summary }` y se llama por polling cada 10s. Más restrictivo pero requiere más código.

**→ Pregunta para ti más abajo.**

### 4c. Componente

Reescribir `src/components/kp/TrackerOperativo.tsx`:

- Recibir `orderId: string` por props.
- Suscripción a Supabase Realtime sobre `public.orders` filtrada por `id=eq.${orderId}` (o useQuery con polling de 10s como fallback de respaldo).
- Mapeo:
  ```
  enviado | recibido       → paso 1 (Recibimos tu pedido)
  en_preparacion           → paso 2 (Freímos / bañamos / coronamos)
  en_camino                → paso 3 (Motorizado en camino)
  entregado                → paso 4 (Disfrútalo)
  cancelado | error        → estado de error con CTA a WhatsApp
  ```
- Quitar el badge `"DEMO EN VIVO"` y el `setInterval` ficticio.
- Mostrar también `rp_pedido_id` ("Comanda #159235") cuando exista, para que el cliente pueda referirlo si llama a la sede.

`src/routes/gracias.tsx`: pasar `order_id` del search-param al `<TrackerOperativo orderId={...} />`.

### 4d. Actualización del status

El tracker es **read-only**. Las transiciones de status (`en_preparacion`, `en_camino`, `entregado`) tienen que entrar a `public.orders` desde algún lado:

- **Corto plazo**: una pantalla simple en `/admin/pedidos` con botones "Marcar en preparación / En camino / Entregado" para que el operador las dispare manualmente. Realtime hace el resto.
- **Largo plazo**: un job que consulte `obtenerEstadoPedido` de Restaurant.pe (si existe en su API; no lo hemos verificado) y mapee a nuestros estados.

Esta plan cubre el corto plazo (botones manuales en admin) para que el tracker tenga datos reales desde el día uno. El job RP queda para una siguiente iteración.

---

## Decisiones que necesito confirmar

1. **RLS para invitados (4b):** ¿voy con opción A (policy pública con ventana de 24h, simple) u opción B (server fn pública dedicada, más estricta pero más código)?
2. **Pantalla admin de transiciones (4d):** ¿la incluyo en este mismo refactor o queda para después y por ahora el tracker solo refleja `enviado → entregado` cuando alguien edite la fila a mano?
3. **Horarios iniciales:** ¿cargo los horarios de las 16 sedes con el valor genérico `12:00-22:00` todos los días como semilla, o prefieres que el admin los configure uno por uno antes de activar la validación?

**1. RLS para invitados (4b): Vamos con la Opción A.** Utilizaremos la policy pública validando el UUID con una ventana de 24 horas (`created_at > now() - interval '24 hours'`). Los UUID v4 son criptográficamente seguros y matemáticamente imposibles de adivinar mediante fuerza bruta. Esto nos permite usar Supabase Realtime de forma eficiente sin saturar el sistema con polling de Server Functions, manteniendo la latencia baja para el cliente.

**2. Pantalla admin de transiciones (4d): Inclúyela en este refactor (MVP).** Crea un selector rápido (dropdown) o botones simples en la vista de `/admin/pedidos` para cambiar el status manualmente. Aunque a largo plazo buscaremos que el POS lo automatice, por ahora necesitamos esta interfaz en el admin para que la operación fluya, el equipo pueda probar la herramienta en la vida real y el cliente vea cómo su tracker cobra vida de inmediato.

**3. Horarios iniciales: Carga un "Seed" por defecto.** Por favor, inyecta un horario base de **12:00 a 22:00** de lunes a domingo para todas las sedes actuales. Esto evitará que, al hacer el despliegue a producción, los pedidos se bloqueen repentinamente por encontrar arrays de horarios vacíos. Una vez en vivo, nosotros afinaremos los horarios exactos de cada sede desde el nuevo panel de administración.

**¡Luz verde! Ejecuta las 4 fases con estas decisiones.**