## Causa raíz (auditoría)

1. **Stale cache en `localStorage`** (`kp.activeSede`). El label "Recoger en Kingpapa Limonar" de la captura es la firma de `pickupOnly()` en `src/components/kp/LocationGate.tsx:108-130`, que **fuerza** `enCobertura: false` y guarda `sedes[0]` como fallback — no recalcula nunca aunque la dirección sí tenga cobertura.
2. **No hay recálculo en el checkout**: `src/routes/checkout.tsx:42` lee ciegamente `sede.enCobertura` del cache. Si está en `false`, el `tipo` se fuerza a `pickup` y el `useEffect` (línea 47) ni siquiera intenta lo contrario.
3. **`OrderIntentDialog`** (línea 37) tiene la misma lógica: si `enCobertura === false`, vuelve a auto-elegir pickup → el botón "Cambiar" abre el diálogo pero el diálogo vuelve a forzar pickup. La interacción está "bloqueada" sin un `disabled` visible.
4. **DB ya OK**: `sedes.cobertura_radio_km` es `numeric NOT NULL DEFAULT 5`. Esto cumple tu requisito de default estricto 5 km y configurabilidad por sede. No se necesita migración.

## Cambios

### 1. `src/lib/active-sede.ts`
- Cambiar `DEFAULT_COBERTURA_KM = 7` → **`5`**.
- Exportar nueva función `recomputeCoverage(active, sedes)` que toma el `ActiveSede` actual + la lista de sedes y recalcula `enCobertura`, `distanciaKm` y `sedeId/slug/label` usando `pickNearestSede(active.lat/lng, sedes)`. Si la activa no tiene `lat/lng`, retorna el original sin tocar. Devuelve `{ active, changed }`.

### 2. `src/components/kp/LocationGate.tsx`
- En `pickupOnly()`: en vez de hard-codear `sedes[0]`, usar `pickNearestSede(pin, sedes)?.sede ?? sedes[0]` para que la sede de "recoger" sea la más cercana real (no la primera de la lista).
- Mantener `enCobertura: false` solo cuando realmente está fuera; si el `nearest` devolvió `enCobertura: true`, llamar a `confirm()` en lugar de `pickupOnly()` (consistencia).

### 3. `src/routes/checkout.tsx` (auto-rehidratación + UX)
- Al montar (con sede + `sedes` cargadas vía `useQuery(['sedes','public'])`): si `sede.lat/lng` están presentes, ejecutar `recomputeCoverage()` y, si el resultado cambió a `enCobertura: true`, llamar a `setActiveSede(updated)` + `setOrderType("delivery")`. Esto **arregla el stale cache automáticamente** sin que el usuario tenga que reabrir el LocationGate.
- Quitar el `useEffect` que fuerza pickup silenciosamente (líneas 46-51). Reemplazar por: solo mostrar un **aviso amigable** ("Estás un poco lejos para nuestro domicilio (fuera de la zona de X km). Tu pedido quedó configurado para recoger en {sede}.") cuando `sede.enCobertura === false` y el orderType acabó en `pickup`. No bloquear UI; el pill "cambiar" sigue funcionando.
- El pill nunca debe estar disabled. Si el usuario abre `OrderIntentDialog` y elige Delivery estando fuera de cobertura, dejarlo elegir y mostrar el aviso (no revertir).

### 4. `src/components/kp/OrderIntentDialog.tsx`
- Quitar el auto-pick que fuerza `pickup` cuando `!sede.enCobertura`. La nueva regla: si `orderType` ya está definido (default `"delivery"` del cart), no tocar nada. El auto-pick solo aplica en el caso de carrito vacío sin orderType — lo cual ya casi nunca pasa porque el default del cart es `"delivery"`.
- En la elección manual (`pick(t)`): respetar siempre la elección del usuario. Si elige Delivery con `!sede.enCobertura`, mostrar un `toast.message` informativo en vez de revertir.

### 5. Admin de sedes
- Verificar que `src/components/admin/SedeForm.tsx` ya expone el campo `cobertura_radio_km`. Si no, añadir input numérico (paso 0.5, min 0.5) — la columna ya existe en BD.

## Verificación

- Limpiar `localStorage.kp.activeSede`, re-elegir dirección "Cra 63A #3C-160 El Refugio": al entrar a checkout debe quedar en **Domicilio** automáticamente.
- Cache stale existente con `enCobertura: false` pero dentro de 5 km: al abrir `/checkout`, recompute lo arregla y queda en Domicilio sin intervención.
- Dirección a >5 km de toda sede: queda en Pickup pero con mensaje amigable; el pill "cambiar" sigue abriendo el diálogo y permite (con aviso) forzar Delivery.

## Fuera de alcance
- Polígonos por barrio (descartado por la respuesta del usuario).
- Cambios al flujo de Restaurant.pe o a `submitOrder`.
