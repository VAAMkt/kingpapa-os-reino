# Integraciones — panel admin

## Objetivo

Reemplazar el chip "Integraciones · soon" del admin por una ruta real donde puedas ver, sin pasar por el chat:

1. El **stream de webhooks** entrantes de Restaurant.pe en vivo.
2. El **estado de cada integración** configurada (RP, Lovable AI, Google Maps).
3. **Diagnóstico rápido** de un pedido: dado un `rp_pedido_id` o UUID, ver todos los eventos que tocaron ese pedido.

Filosofía: una sola pantalla, tres bloques verticales, cero adornos. Brutal/cheese consistente con el resto del admin.

## Alcance del cambio

- **Nuevo**: `src/routes/admin.integraciones.tsx` (con `_authenticated` ya cubierto por `admin.tsx`).
- **Editar**: `src/routes/admin.index.tsx` para que el chip "Integraciones · soon" sea ahora un `<Link to="/admin/integraciones">` activo.
- **Sin cambios** en `rp-webhook.ts`, schema de BD, ni en el resto de admin.

No se requieren migraciones — la tabla `rp_sync_log` ya tiene todo lo necesario (`created_at, tipo, ok, mensaje, payload`).

## Layout (de arriba a abajo)

```text
┌─────────────────────────────────────────────────────┐
│ Integraciones                                       │
│ ───────────────────────────────────────────────────│
│                                                     │
│ Estado                                              │
│ ┌──────────────┬──────────────┬─────────────────┐ │
│ │ Restaurant.pe│ Lovable AI   │ Google Maps     │ │
│ │ ● activo     │ ● configurado│ ● configurado   │ │
│ │ último wh:   │ key presente │ key presente    │ │
│ │ hace 12s     │              │                 │ │
│ └──────────────┴──────────────┴─────────────────┘ │
│                                                     │
│ Buscar pedido                                       │
│ [ rp_pedido_id o UUID            ] [Buscar]        │
│ → muestra timeline filtrado abajo                  │
│                                                     │
│ Webhooks en vivo            [tipo▾] [ok/all] [⟳]   │
│ ─ 04:33:21  webhook_ignored_external  did=160314   │
│   sc=3 → en_camino · IP 191.111.x · headers ▾      │
│ ─ 04:33:21  webhook_raw  POST recibido             │
│   body { deliveryId:160314, statusCode:3 } ▾       │
│ ─ 04:32:17  webhook_ignored_external  did=160313   │
│ ...                                                 │
└─────────────────────────────────────────────────────┘
```

## Bloque 1 — Estado de integraciones

Tres tarjetas en grid responsive (3 cols desktop, stack mobile):

- **Restaurant.pe**: badge `activo`/`silencioso`/`error` en función del último `webhook_raw` recibido. "Último webhook hace Xs" calculado en cliente. Mostrar URL del webhook (`/api/public/rp-webhook`) y el dominio configurado (lectura ligera vía un nuevo serverFn `getIntegrationsStatus` que devuelva `{ rp: { domain_set: bool, last_webhook_at }, lovable_ai: { key_set }, google_maps: { key_set } }` — sin exponer valores).
- **Lovable AI** y **Google Maps**: sólo badge "configurado/faltante" según si la secret existe (el serverFn lo chequea con `!!process.env.X`).

## Bloque 2 — Buscar pedido

Input + botón. Al buscar:

- Si parece UUID → busca `order_id` en `payload->>'order_id'` y `rp_pedido_id` por join.
- Si es numérico → busca `payload->>'deliveryId' = X` **o** `rp_pedido_id = X`.
- Resultado: filtra el stream de abajo para mostrar sólo eventos relacionados. Botón "limpiar".

Esto es exactamente lo que necesitabas para 160347: poder verificar visualmente que **cero** webhooks tocaron ese ID.

## Bloque 3 — Webhooks en vivo

Lista vertical de los últimos 100 eventos de `rp_sync_log`, ordenada desc por `created_at`. Cada fila:

- timestamp HH:MM:SS
- badge de `tipo` (`webhook_raw`, `webhook`, `webhook_ignored_external`, `order`, `order_test_mode`)
- badge ok/error
- `mensaje` (truncado, expandible)
- `▾` despliega payload JSON con `<pre>` (incluye headers, IP, body crudo).

Filtros mínimos en la barra:

- Select de `tipo` (con opción "todos").
- Toggle "sólo errores" (ok=false).
- Botón `⟳` manual.

**Realtime**: suscripción a `postgres_changes` sobre `rp_sync_log` (igual que `admin.pedidos.tsx` hace con `orders`) → prepend nuevas filas sin recargar. Necesita habilitar realtime en la tabla:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.rp_sync_log;
```

(Migración aparte, una sola línea.)

## Datos y permisos

- `rp_sync_log` ya tiene RLS con política para admins (asumido por las 2 policies existentes). Si la lectura falla desde el cliente con el rol actual, agrego policy `SELECT` para `authenticated` con `has_role(auth.uid(), 'admin')`. Lo verifico antes de implementar.
- Nuevo serverFn `getIntegrationsStatus` (en `src/lib/integrations.functions.ts`) protegido con `requireSupabaseAuth` + check de rol admin.

## Lo que NO se incluye (por filosofía "al grano")

- Sin gráficas ni métricas agregadas.
- Sin export CSV.
- Sin edición de secrets desde el panel (eso vive en Lovable Cloud).
- Sin paginación: 100 filas + realtime es suficiente para QA.
- Sin tabs ni subsecciones.

## Verificación post-deploy

1. `/admin/integraciones` abre y muestra las 3 tarjetas de estado.
2. Lanzo un pedido nuevo desde la web → veo el `order` aparecer en vivo, y si RP responde con webhook, lo veo aparecer en segundos.
3. Busco `160347` → confirma 0 eventos (validando el diagnóstico actual).
4. Busco `160314` → muestra `webhook_raw` + `webhook_ignored_external`.

## Pregunta abierta

El diagnóstico de 160347 sigue sin resolverse a nivel RP — este panel sólo lo hace **visible**, no lo arregla. Una vez tengas el panel y veas en vivo varios pedidos propios, podremos decidir si:

- **A**: agregar fallback de match por `rp_numero_comanda` en el webhook (si descubrimos que RP manda otro ID),
- **B**: escalar a soporte de Restaurant.pe con evidencia,
- **C**: no hacer nada porque era un caso aislado.

Eso lo decides después de observar — no necesita estar en este plan.

**El plan conceptual para el Panel de Integraciones es excelente. Aprobado el layout "brutal/cheese" sin arandelas.**

**EJECUTA EL PLAN CON ESTAS 3 MEJORAS DE CALIDAD DE VIDA (UX/DevEx):**

1. **Formato y Copiado:** En el Bloque 3 (Webhooks en vivo), el JSON expandido debe renderizarse formateado con `JSON.stringify(payload, null, 2)`. Además, incluye un botón pequeño de "Copiar" al lado de cada payload crudo para poder copiar el JSON completo al portapapeles con un clic.
2. **Límite Reactivo:** En el estado del frontend que maneja el Realtime del Bloque 3, asegúrate de hacer un "slice" o mantener siempre un máximo de 100 o 200 ítems en memoria. Si el usuario deja la pestaña abierta, no queremos que un array infinito crashee el navegador.
3. **Migración Realtime:** No olvides ejecutar la migración SQL `ALTER PUBLICATION supabase_realtime ADD TABLE public.rp_sync_log;` para que el panel funcione.

**SOBRE TU PREGUNTA ABIERTA (La solución al problema de fondo):** No vamos a quedarnos sentados observando el panel mientras la UI de los clientes se queda en "Asignando comanda...". Mientras el webhook siga siendo inestable o no mande la comanda visual, **vamos a implementar una Arquitectura Híbrida.**

- Reactiva el polling en `TrackerOperativo.tsx` (cada 20 segundos).
- Este polling debe llamar EXCLUSIVAMENTE a la ruta interna del POS (`http://kingpapa.restaurant.pe/restaurant/api/rest/pedido/getPedidoListByDelivery/{id}`) inyectando la cookie de sesión a través de la variable `RESTAURANT_PE_POS_TOKEN`.
- Su misión principal es extraer el `rp_numero_comanda` e inyectarlo en nuestra BD. Si de paso detecta un avance de estado que el webhook perdió, que lo actualice. Si falla silenciosamente (token expirado), que dependa solo del Webhook.

**Construye el Panel de Integraciones y aplica la Arquitectura Híbrida del Polling simultáneamente. Avísame cuando esté desplegado.**  
  
**Actúa como Arquitecto Backend Senior.**

Acabo de interceptar la respuesta exacta del endpoint interno del POS (`/getPedidoListByDelivery/{id}`) y ya tenemos la estructura JSON confirmada para implementar nuestra **Arquitectura Híbrida (Polling de Guerrilla + Webhooks)**.

La respuesta del POS tiene este formato exacto:

JSON

```
{
  "tipo": "1",
  "data": [
    {
      "pedido_id": "2501365",
      "delivery_id": "160347",
      "pedido_estado": "1",
      "pedido_comandaid": null
    }
  ]
}

```

**EJECUTA LA ARQUITECTURA HÍBRIDA CON ESTAS DIRECTRICES:**

**1. Parseo Exacto en el Server Function (**`pollOrderFromRp`**):**

- La data viene en un array. Debes leer el primer elemento: `res.data[0]`.
- Extrae el estado desde `data[0].pedido_estado`.
- Extrae el número de comanda con un fallback inteligente: usa `data[0].pedido_comandaid`, y si es `null` o vacío, usa `data[0].pedido_id`.

**2. Mapeo del Endpoint Interno (Diferente al Webhook):** Recuerda que este endpoint usa una tabla de estados distinta al webhook. Mapea `pedido_estado` (string o number) así:

- `1` -> `"recibido"`
- `2` -> `"en_preparacion"`
- `3` -> `"en_camino"`
- `4` -> `"cancelado"`
- `5` -> `"entregado"`

**3. Actualización de la BD (Fallback y Comanda):** Cuando el polling extraiga esta data, haz un `UPDATE` en `orders`:

- Guarda el número extraído en `rp_numero_comanda` (para que la UI deje de decir "Asignando comanda...").
- **Lógica de Fallback de Estado:** Solo actualiza el `status` si el estado extraído del POS representa un avance respecto al que ya tenemos en DB. El Webhook sigue siendo el maestro, el polling es el salvavidas por si el webhook pierde el evento.

**4. Reactivación Segura en Cliente:** Reactiva el `setInterval` en `TrackerOperativo.tsx` (cada 20 segundos). Si la server function falla (ej. si `RESTAURANT_PE_POS_TOKEN` expira o no está), el error debe ser tragado silenciosamente (`catch(() => {})`) para no ensuciar la consola y dejar que la app siga funcionando reactivamente con Supabase Realtime y los webhooks.

**Aplica esto inmediatamente para desatascar las UIs de los clientes.**