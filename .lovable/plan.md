
## Diagnóstico rápido de lo que ya existe

Buena noticia: ya tenemos ~70% del andamiaje. El plan es **refinar y conectar**, no reescribir.

- ✅ Header con `LocationPill` y nada bloqueando al entrar (`Layout.tsx`).
- ✅ `LocationGate` abre solo bajo demanda, con mapa + GPS + autocomplete.
- ✅ `ProductCustomizerSheet` ya existe con Sheet de shadcn (bottom), hero, modificadores y CTA sticky.
- ✅ `ProductCard` ya hace el flow correcto: sin mods → al carrito; con mods → abre Sheet; sin sede → abre gate y guarda pending intent.
- ✅ `CartDrawer` lateral con suma/resta y CTA a `/checkout`.
- ✅ `checkout.tsx` ya es una sola página con datos + resumen + pago.

Lo que falta es **inyectar la psicología de conversión** que pediste: upsell "A tu corona le falta…", gamificación de puntos en el carrito, bloqueo de domicilio por distancia, y un par de pulidas de fricción.

## Plan de implementación

### Módulo 1 — Navegación "craving first" (ajustes finos)
Estado: ya implementado. Sólo verificar:
- Confirmar que `LocationPill` muestra "📍 Selecciona tu ubicación" cuando `source === "exploring"` (hoy dice "Ingresa tu ubicación" — alinear copy al pedido).
- Verificar que `/menu` no auto-abre gate en mobile (hoy hace `setExploringSede` automático — ok).

### Módulo 2 — Upselling Sheet (el gatillo)
Estado: base lista. Agregar la pieza de oro:
- Nueva sección **"A tu corona le falta…"** al final del `ProductCustomizerSheet`, encima del footer sticky.
  - Renderiza 2-3 productos sugeridos de categoría `Bebidas` o `Postres` del menú actual (lee del cache `["menu", sedeSlug]` con `useQueryClient`).
  - Cada sugerencia es una mini-card horizontal con foto, nombre, precio y botón `+ Agregar`. Al tocar, se suma al carrito directo (sin cerrar el sheet) y dispara toast.
  - Si la categoría no existe en el menú, la sección no renderiza (silencioso, no rompe).
- Mantener el footer sticky con total dinámico ya existente.

### Módulo 3 — Carrito "FOMO" con puntos
Editar `CartDrawer.tsx`:
- Calcular puntos de lealtad estimados: `Math.floor(subtotal / 1000) * 10` (10 pts por cada $1.000 — regla simple, ajustable).
- Mostrar bloque visual sobre el botón "Ir a pagar":
  - Badge amarillo brutalista: `👑 Ganarás ~{puntos} PUNTOS con este pedido`.
  - Línea opcional condicional si `subtotal < umbral` (ej. $40.000): `Te faltan ${cop(faltante)} para envío gratis` (umbral hardcoded por ahora, marcado como TODO sede-config).
- Resto del drawer queda igual.

### Módulo 4 — Checkout one-page (refinamientos)
Editar `checkout.tsx`:
- **Forzar pickup si está fuera de cobertura:** `useEffect` que detecta `sede && !sede.enCobertura && tipo === "delivery"` y hace `setOrderType("pickup")` + toast informativo ("Tu dirección está a más de Xkm — solo recogida disponible"). Ya está el `disabled` en el botón delivery, falta el auto-switch.
- **Heredar dirección del gate:** ya se hace via `useState(sede?.direccionTexto ?? "")`. Verificar que también herede `detalles`.
- **Resumen:** agregar línea "👑 +{puntos} pts al confirmar" en el aside derecho.
- **Post-confirmación:** ya redirige a `/gracias?order_id=...`. El prompt pide `/rastrear` — confirmar con el usuario si quiere renombrar la ruta o crear `/rastrear` como alias (ver pregunta abajo).

### Archivos a tocar

- `src/components/kp/Layout.tsx` — copy del pill.
- `src/components/kp/ProductCustomizerSheet.tsx` — sección "A tu corona le falta…".
- `src/components/kp/CartDrawer.tsx` — bloque de puntos + FOMO opcional.
- `src/routes/checkout.tsx` — auto-switch a pickup, línea de puntos en resumen.

### Lo que NO voy a tocar
- Mapa, geocoding, autocomplete (recién estabilizado).
- Sistema de auth / loyalty real (puntos quedan como cálculo visual; el POST a backend de loyalty queda como TODO).
- Pasarela de pago online.

## Preguntas para confirmar antes de implementar

1. **Ruta post-compra:** ¿dejamos `/gracias?order_id=...` (ya existe) o creo `/rastrear` como nueva ruta tipo tracker?
2. **Regla de puntos:** ¿10 pts por cada $1.000 está bien o tienes una fórmula oficial?
3. **Umbral envío gratis:** ¿quieres que muestre el FOMO de "te faltan $X para envío gratis"? Si sí, ¿qué umbral fijo uso por ahora (ej. $40.000)?
4. **Sugerencias upsell:** ¿priorizo categorías `Bebidas` y `Postres`, o prefieres marcar productos específicos como "sugeridos" desde el admin más adelante?
