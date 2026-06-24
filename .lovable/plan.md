Tres cambios localizados en `src/routes/checkout.tsx` (más un retoque mínimo en `ResumenPedido`). No se toca `submitOrder`, `precheckStock`, ni el store del carrito — solo se consumen sus funciones existentes (`incItem`, `decItem`, `removeItem`, todas operan sobre `item.key`).

---

### CAMBIO 1 — Ocultar método de pago "Online"

En el bloque "Método de pago" (líneas 353–380):

- Definir flag: `const PAYMENTS_ENABLED = import.meta.env.VITE_PAYMENTS_ENABLED === "true";` (TanStack/Vite usa `VITE_*`, no `NEXT_PUBLIC_*` — equivalente funcional).
- Construir la lista de opciones condicionalmente: siempre `efectivo` y `datafono`; agregar `online` solo si `PAYMENTS_ENABLED`.
- Eliminar el `<p>` de "Pasarela online próximamente…" por completo.
- Si `persisted.pago === "online"` y la pasarela está apagada, inicializar `pago` en `"efectivo"` para no dejar el estado en un método invisible.

### CAMBIO 2 — Editar cantidades y eliminar desde `ResumenPedido`

Refactor de `ResumenPedido` (líneas 436–480):

- Importar `incItem`, `decItem`, `removeItem` desde `@/lib/cart` (los tres ya existen y usan `item.key`, lo cual respeta la persistencia en localStorage del store).
- Por cada `<li>`:
  - Mantener la primera línea con nombre + subtotal del ítem.
  - Debajo, agregar una fila de controles thumb-friendly (mínimo 44×44 px de área tocable, `min-w-[44px] min-h-[44px]`):
    - Botón `−` → `decItem(i.key)` (el store ya elimina al llegar a 0; verificar comportamiento — si no, llamar `removeItem` cuando `i.cantidad === 1`).
    - Contador `i.cantidad` centrado.
    - Botón `+` → `incItem(i.key)`.
    - Botón "Eliminar" (icono 🗑 + sr-only) → `removeItem(i.key)` con `toast.success("Eliminado del pedido")` como confirmación visual breve.
- Estilo brutal consistente: `border-2 border-kp-ink bg-kp-cheese` para los botones, `disabled` visual cuando `cantidad <= 1` no es necesario porque `decItem` ya elimina.
- El `total` recibido por props ya se recalcula en tiempo real porque `useCart()` en el padre es reactivo al store; no requiere cambio adicional.

### CAMBIO 3 — Bloque "Detalles de entrega" siempre visible antes del CTA

Nuevo `<BrutalCard>` insertado en el `<form>` justo después de la card de "Pago" (antes de `<details>` de notas), y también renderizado dentro del `ResumenPedido` desktop para que esté visible al hacer scroll. Contenido:

- **Sede que despacha:** `sede?.label`
- **Tipo de entrega:** "Domicilio" | "Recoger en sede"
- **Dirección de entrega** (si `!esRecoger`): `direccion`
- **Subtotal:** `cop(subtotal)`
- **Costo de domicilio:** el modelo actual de `sede` no expone tarifa de domicilio → renderizar literal "A confirmar por WhatsApp" cuando `!esRecoger`; ocultar cuando `esRecoger`. (No se agrega campo nuevo al modelo.)
- **Total final:** `cop(total)` (hoy = subtotal; si en el futuro se suma fee, se actualiza aquí).
- **Tiempo estimado:** el modelo de sede tampoco lo expone hoy → omitir la línea si no hay dato (regla "si no existe, no existe"). Dejar comentario `TODO` apuntando a `getMenuForSede` / Restaurant.pe para enchufarlo cuando esté disponible.

Layout mobile-first: stack vertical con `text-sm`, etiquetas en `font-display uppercase opacity-70` y valores en `font-display`. Fila Total destacada con borde superior.

---

### Criterios verificados

- `submitOrder` y `precheckStock` no se tocan.
- `clearCart` / `localStorage` del store no se tocan; `incItem/decItem/removeItem` ya escriben al mismo store persistente.
- Botones +/− con área ≥ 44 px.
- Total reactivo porque el padre consume `useCart()`.
- `VITE_PAYMENTS_ENABLED` documentado implícitamente; sin la var, "Online" no aparece.

### Archivos

- `src/routes/checkout.tsx` (único archivo modificado).
