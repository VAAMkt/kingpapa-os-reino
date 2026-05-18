
# Plan: Fix de imágenes (Fase 1.5) + Mata-Monsters (Fase 2)

## Diagnóstico del JSON crudo

Ese `2 pa 2 Didi` reveló todo. La estructura real de Restaurant.pe para **esta** cuenta:

```
productogeneral_escombo: "1"
productogeneral_urlimagen: null          ← combo SIN foto propia
lista_productobase: [
  { producto_urlimagen: "kingpaparestaurantpe/productos/b052...jpg", ... }, ← AQUÍ está la foto
  ...
]
lista_productoadicional: []
```

**Conclusión nuclear:** los combos no tienen `productogeneral_urlimagen` poblado (viene `null`). La foto real vive en `lista_productobase[0].producto_urlimagen`. Por eso quedaban todos sin imagen. La doc OAS3 mentía.

Bonus: las URLs son relativas tipo `kingpaparestaurantpe/productos/<uuid>.jpg` — `resolveRpImage` ya las prefija con `https://api.restaurant.pe/archivos/` → eso ya funciona, era solo el origen el que estaba mal.

## Fase 1.5 — Fix de extracción (quirúrgico)

**`src/lib/restaurantpe-normalize.ts` → `normalizeProduct`:**

Cadena nueva de fallbacks de imagen:

- **Combo (`productogeneral_escombo === "1"`):**
  1. `productogeneral_urlimagen`
  2. `lista_productobase[0].producto_urlimagen` ← el fix
  3. `lista_productobase[0].lista_productoCambio[0].producto_urlimagen`
  4. `producto_imagen` (legacy)
- **Normal:** mantener orden actual (`lista_presentacion[0].producto_urlimagen` → `producto_imagen` → `productogeneral_urlimagen`).

**`src/lib/rp.functions.ts`:**
- Quitar la trampa nuclear (las 25 líneas del `if (rawFirst) { ... throw }`).
- Mantener `syncSedeMenu` igual — preserva overrides en re-sync.

**Verificación:** sincronizo una sede después del fix, hago `SELECT count(*) FILTER (WHERE imagen_url IS NOT NULL)` en `productos_master`. Si pasamos de 0 a >80% poblados, listo.

## Fase 2 — Mata-Monsters (4 módulos)

Igual a lo aprobado antes, sin cambios:

1. **`OrderIntentDialog`** — modal post-LocationGate: 🛵 Domicilio / 🏃 Recoger. Guarda `orderType` en `cart.ts`.
2. **`ProductCustomizerSheet`** — Sheet con grupos de modificadores (radio si max=1, checkbox si max>1), stepper, footer sticky con total. Se abre solo si hay mods.
3. **`/checkout` un solo paso** — 2 cols, form izq + resumen der, genera `KP-XXXXXXXX`, persiste `kp.lastOrder`, redirige a `/gracias`.
4. **`/gracias`** — lee `order_id` de search, hero brutal, `TrackerOperativo` integrado, CTA WhatsApp a la sede.

## Orden de ejecución (un solo commit)

1. Fix de `normalizeProduct` (combos → `lista_productobase[0]`).
2. Quitar trampa nuclear.
3. Implementar los 4 módulos de Mata-Monsters.
4. Te aviso, sincronizás 1 sede, validamos que ahora sí salen las fotos, y arrancás a probar el flujo nuevo.

## Lo que NO se toca
- `restaurantpe.server.ts`, RLS, auth, Fase 4 (menu engineering admin).
- `rpRegistrarDelivery` real al POS — queda para una vuelta posterior. El pedido por ahora es local + WhatsApp (mismo MVP que dijimos).

¿Le doy a todo de una?
