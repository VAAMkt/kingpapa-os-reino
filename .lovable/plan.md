Crear helper `src/lib/analytics.ts` y disparar `track()` en los puntos exactos del flujo. Fire-and-forget, sin await, sin datos personales.

---

### Helper — `src/lib/analytics.ts` (nuevo)

```ts
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: string, payload?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log("[KP Analytics]", event, payload ?? {});
      return;
    }
    window.gtag?.("event", event, payload ?? {});
  } catch {
    /* never break UX por analytics */
  }
}
```

Notas:
- Vite expone `import.meta.env.DEV` (no `process.env.NODE_ENV`, que no existe en el bundle del browser de TanStack Start).
- `try/catch` defensivo: si gtag falla, el flujo continúa.
- No se instala GA4 en este cambio; el helper queda no-op en prod hasta que el snippet de gtag se monte (fuera del alcance solicitado).

### Instrumentación por evento

| # | Evento | Archivo | Punto exacto |
|---|---|---|---|
| 1 | `menu_view` | `src/routes/menu.tsx` | `useEffect` que dispare cuando `sede?.sedeId` cambie y exista. Payload: `{ sede_id: sede.sedeId, sede_nombre: sede.label }`. |
| 2 | `category_clicked` | `src/routes/menu.tsx` | Dentro de `handleNavClick(cat)` (o el handler del pill de categorías), antes del scroll. Payload: `{ categoria_id: cat.id, categoria_nombre: cat.nombre }`. Se omite cuando `cat.id === "all"` opcionalmente; lo incluimos también con `categoria_id: "all"` para medir el reset. |
| 3 | `product_view` | `src/components/kp/ProductCustomizerSheet.tsx` | `useEffect` dentro de `CustomizerBody` con dep `[producto.id]` (sólo se monta cuando el sheet abre con un producto). Payload: `{ producto_id, producto_nombre: producto.nombre, precio_base: producto.precioDesde }`. |
| 4 | `add_to_cart` | `src/components/kp/ProductCustomizerSheet.tsx` | Dentro de `agregar()`, justo después de `addItem(...)` y antes de `onDone()`. Payload: `{ producto_id: producto.id, producto_nombre: producto.nombre, precio_final: unit, tiene_modificadores: mods.length > 0, tiene_upsell: bebidasSugeridas.length > 0 }`. |
| 5 | `checkout_started` | `src/routes/checkout.tsx` | `useEffect` con `[]` (mount), guard `count > 0`. Payload: `{ items_count: count, subtotal }`. |
| 6 | `payment_method_selected` | `src/routes/checkout.tsx` | En el `onClick` del botón de método de pago, antes/después de `setPago(opt.id)`. Payload: `{ metodo: opt.id }`. |
| 7 | `order_submitted` | `src/routes/checkout.tsx` | Dentro de `confirmar()`, justo antes del `try` que llama `submitOrder`. Payload: `{ items_count: count, subtotal, sede_id: sede.sedeId, metodo_pago: pago }`. |
| 8 | `order_success` | `src/routes/checkout.tsx` | Inmediatamente después de recibir `result` de `submitOrder`, antes de `clearCart()`/`navigate`. Payload: `{ order_id: result.orderId, total: result.total, sede_id: sede.sedeId }`. |
| 9 | `order_error` | `src/routes/checkout.tsx` | Dos puntos: (a) dentro del `catch` del `precheckFn` — `error_type: "precheck"`, (b) en el `catch` final de `submitOrder` — `error_type: "submit"`. Payload: `{ error_type, mensaje: err instanceof Error ? err.message : String(err) }`. También cuando `precheck` retorna agotados: `error_type: "stock"`, `mensaje: nombres`. |

### Privacidad

- Ninguno de los payloads incluye `nombre`, `telefono`, `direccion`, `detalles` ni `notas`.
- `order_id` y `sede_id` son IDs internos, no PII.

### Archivos

- `src/lib/analytics.ts` (nuevo)
- `src/routes/menu.tsx` (eventos 1, 2)
- `src/components/kp/ProductCustomizerSheet.tsx` (eventos 3, 4)
- `src/routes/checkout.tsx` (eventos 5, 6, 7, 8, 9)

No se toca `submitCheckoutOrder`, `precheckStock`, ni el store del carrito.
