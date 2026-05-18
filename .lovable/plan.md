
# Plan: Trampa nuclear de imágenes + Flujo "Mata-Monsters"

Dos fases. La Fase 1 es quirúrgica y bloqueante (necesitamos el JSON crudo real antes de tocar normalización). La Fase 2 es el flujo de conversión completo, todo en Drawers/Sheets sobre el menú — el cliente nunca siente que cambia de pantalla.

## Fase 1 — Trampa nuclear (5 min, bloqueante)

**Objetivo:** ver exactamente cómo viene 1 producto crudo de Restaurant.pe en producción para esta cuenta, no según la doc.

Cambio quirúrgico en `src/lib/rp.functions.ts`, dentro de `syncSedeMenu`, justo después de obtener `catalogo.data` y antes del bucle de normalización:

```ts
// TRAMPA NUCLEAR — quitar tras diagnóstico
const primerCrudo = (catalogo.data ?? [])[0];
if (primerCrudo) {
  await supabase.from("rp_sync_log").insert({
    tipo: "debug_raw_product",
    sede_id: sede.id,
    ok: true,
    mensaje: "DEBUG_RAW_PRODUCT_0",
    payload: primerCrudo as never,
  });
  throw new Error(
    "TRAMPA NUCLEAR: producto crudo guardado en rp_sync_log. " +
    "Revisa /admin/sincronizacion → último log debug_raw_product."
  );
}
```

**Por qué guardar en `rp_sync_log` y no `console.error`:**
- Los logs del worker se truncan y se pierden entre intentos.
- `rp_sync_log` ya existe, ya tiene RLS de editor, ya se muestra en `/admin/sincronizacion`.
- El admin puede copiar el JSON limpio de la UI y pegarlo aquí sin abrir devtools.

**Acción del usuario:**
1. Aprueba el plan → implemento la trampa.
2. Vas a `/admin/sincronizacion` y le das **Sincronizar** a cualquier sede.
3. Saldrá el error rojo. Bajas y copias el `payload` del último log `debug_raw_product`.
4. Me lo pegas en el chat.

Apenas tengamos ese JSON, en la siguiente vuelta:
- Arreglo `normalizeProduct` con las llaves reales (no las que asume la doc).
- Quito la trampa.
- Verifico que los modificadores también caigan bien para alimentar el Módulo 2.

## Fase 2 — Flujo Mata-Monsters (después del JSON)

Todo Neubrutalista, todo sobre Sheet/Drawer. El cliente nunca abandona `/menu` hasta el "gracias".

### Módulo 1 — Intent (Delivery / Pickup)
- Nuevo componente `OrderIntentDialog.tsx` (usa `ui/dialog` brutalizado).
- Se dispara una sola vez tras `LocationGate` resolver sede activa, si no hay `orderType` en estado.
- 2 botones gigantes: `🛵 Domicilio` / `🏃 Recoger en sede`.
- Guardamos `orderType` en `cart.ts` (nuevo campo en el store) — persiste en localStorage junto al carrito.
- Pill visible en header (junto a `ActiveSedePill`) para cambiarlo después.

### Módulo 2 — Upsell Sheet (adiciones)
- Nuevo `ProductCustomizerSheet.tsx` con `ui/sheet` (side=bottom en mobile, right en desktop).
- En `ProductCard.tsx`: si `producto.modificadores.length > 0` o `modificadores_raw.lista_productoadicional?.length > 0` → el CTA abre el Sheet; si no, va directo al carrito (comportamiento actual).
- Sheet renderiza:
  - Hero del producto (imagen + nombre + precio base).
  - Por cada grupo de `modificadores`: título + min/max + checkboxes (o radio si max=1) con precio delta.
  - Validación reactiva del min/max por grupo (deshabilita CTA si no cumple).
  - Stepper de cantidad.
  - Footer sticky: total calculado + botón brutal "Agregar al carrito por $X.XXX".
- `addItem` en `cart.ts` acepta `modificadores: {grupo_id, opcion_id, nombre, precio}[]` y los incluye en el `key` para que dos configuraciones distintas del mismo producto sean líneas separadas.

### Módulo 3 — Checkout de un solo paso
- Refactor de `routes/checkout.tsx`:
  - Si `cart.items.length === 0` → `Navigate to="/menu"`.
  - Layout 2 columnas (desktop) / stacked (mobile): izq formulario, der resumen sticky.
  - Form: nombre, teléfono, dirección (prefill desde `active-sede` / location gate), notas, método de pago (`efectivo` / `datafono` / `online`).
  - Si `orderType === "pickup"` ocultamos dirección y mostramos la dirección de la sede.
  - Submit → genera `orderId = "KP-" + nanoid(8).toUpperCase()`, persiste en localStorage (`kp.lastOrder`), limpia carrito, redirige a `/gracias?order_id=...`.
  - (No tocamos `rpRegistrarDelivery` todavía — eso es otra fase; por ahora el pedido es local + WhatsApp.)

### Módulo 4 — Pantalla de tracking
- Nueva ruta `src/routes/gracias.tsx`.
- Lee `order_id` de `useSearch`. Lee `kp.lastOrder` de localStorage para reconstruir items + sede.
- Hero brutal: "👑 Tu corona se está forjando" + Order ID gigante monoespaciado.
- Integra `TrackerOperativo.tsx` (etapas: Recibido → En cocina → En camino / Listo para recoger → Entregado), avanza con timers simulados o estado manual.
- CTA secundario: "Escribir a la sede por WhatsApp" → `https://wa.me/{sede.whatsapp}?text=Hola%20mi%20pedido%20{orderId}`.
- CTA terciario: "Volver al menú".

### Archivos que se tocan en Fase 2
- `src/lib/cart.ts` — añadir `orderType`, soporte de modificadores en key/total.
- `src/components/kp/OrderIntentDialog.tsx` (nuevo).
- `src/components/kp/ProductCustomizerSheet.tsx` (nuevo).
- `src/components/kp/ProductCard.tsx` — ramificar CTA según mods.
- `src/routes/menu.tsx` — montar el `OrderIntentDialog` arriba del grid.
- `src/routes/checkout.tsx` — reescritura de un paso.
- `src/routes/gracias.tsx` (nuevo).
- `src/components/kp/TrackerOperativo.tsx` — pequeño ajuste para aceptar `orderId` y `sede` como props si hace falta.

## Lo que NO se toca
- `restaurantpe.server.ts` (el cliente HTTP está fino).
- Auth, roles, RLS.
- `rpRegistrarDelivery` real al POS (queda para fase siguiente cuando confirmes que el flujo local convierte).
- Menu engineering admin (Fase 4 ya está).

## Orden de ejecución
1. Apruebas → implemento **solo** la trampa nuclear (Fase 1).
2. Sincronizas, me pegas el JSON.
3. Arreglo normalización + quito trampa + ejecuto los 4 módulos de Fase 2 en una sola vuelta.

¿Le doy a la trampa?
