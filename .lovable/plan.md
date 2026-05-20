## Diagnóstico

El módulo de upsell ("A tu corona le falta…") **sí está implementado** dentro del `ProductCustomizerSheet`, y los datos de Bebidas/Adiciones existen en todas las sedes (verificado en BD: 13 bebidas + 31 adiciones por sede). El problema es **dónde** se renderiza.

En `ProductCard.tsx` (líneas 42–69), el flujo al tocar "Pedir" es:

1. Si la sede es "exploring" (sin dirección real) → abre `LocationGate`. Customizer nunca aparece.
2. Si el producto tiene modificadores → abre customizer (✅ ahí sí se ven los upsells).
3. Si el producto **no** tiene modificadores → `addItem` directo al carrito. Customizer nunca se abre.

La mayoría de productos del menú (Personales, KingKonos, Combos, Bowls) no tienen modificadores configurados, así que el cliente nunca ve la sección de sugeridos. Bebidas y Adiciones tampoco son "ofrecidas" en el momento clave.

## Solución

Mover/duplicar la sección de upsell al **CartDrawer**, que es el único punto que **siempre** se abre tras `addItem` (sin importar si el producto tiene mods o no). Esto garantiza que el cliente vea Bebidas/Adiciones antes de pagar — que es el momento de mayor intención de compra.

### Cambios

1. **`src/components/kp/CartDrawer.tsx`**
   - Agregar `UpsellSection` justo arriba del bloque de totales/puntos (después de la lista de items, antes del footer de pago).
   - Reusar la misma lógica del hook `useUpsellSuggestions`: leer `qc.getQueryData(["menu", sede.slug])`, filtrar categorías que contengan `bebida`/`postre`/`adicion`/`acompan`, excluir productos que ya están en el carrito, mostrar máximo 3.
   - Cada sugerencia: foto pequeña + nombre + precio + botón `+ Agregar` que llama `addItem({ silent: true })` y muestra toast.
   - Título: "A tu corona le falta…" / subtítulo: "Súmale uno antes de pagar".
   - Si no hay sugerencias disponibles, no renderizar la sección (silencioso).

2. **`src/components/kp/ProductCustomizerSheet.tsx`**
   - Extraer `useUpsellSuggestions` + `UpsellSection` a un módulo compartido `src/components/kp/UpsellSection.tsx` para reusarlo desde el carrito.
   - Mantener el render dentro del customizer (sigue siendo útil para productos con mods).

### Lo que NO se toca

- Lógica de carrito (`cart.ts`), checkout, menú, geocoding, autenticación.
- Categorías ni datos de BD.
- ProductCard sigue igual: no se fuerza abrir el customizer para productos sin mods (eso cambiaría el comportamiento de "1-tap add" pedido originalmente).

## Resultado esperado

Cualquier producto que el cliente agregue → el carrito se abre → ve 3 sugerencias de Bebidas/Adiciones → toca "+ Agregar" → se suman al pedido sin cerrar el drawer. Punto único de conversión que captura el 100% de los flujos.
