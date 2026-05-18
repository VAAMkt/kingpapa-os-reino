# Fix: "Maximum update depth exceeded" en CartDrawer

## Causa raíz
Ambos stores (`src/lib/cart.ts` y `src/lib/active-sede.ts`) usan `useSyncExternalStore` pero su `getSnapshot` (`read()`) hace `JSON.parse(localStorage…)` en cada llamada, devolviendo una **referencia nueva cada vez**. React detecta el cambio de referencia, re-renderiza, vuelve a llamar `getSnapshot`, ve otra referencia nueva, y entra en bucle infinito → el error que ves en `CartDrawer`.

## Fix

**`src/lib/cart.ts`**
- Mantener una variable `cache: CartItem[] | null`.
- `read()` devuelve `cache` si está poblado; si no, parsea localStorage y lo guarda.
- `write()` actualiza `cache` con la nueva referencia antes de `emit()`.
- Inicializar `cache` perezosamente en la primera lectura cliente.

**`src/lib/active-sede.ts`**
- Mismo patrón: cache de `ActiveSede | null`, invalidada en `setActiveSede` / `clearActiveSede` y en el handler de `storage`.
- Mover el listener de `storage` al módulo (una sola vez) en vez de adjuntarlo por suscriptor.

## Resultado
`getSnapshot` devuelve la **misma referencia** mientras los datos no cambien, rompiendo el loop. El Drawer se monta normal, el carrito y la sede activa siguen funcionando idéntico desde fuera (misma API pública).

## Fuera de alcance
No se tocan componentes ni UI; sólo la implementación interna de los dos stores.
