# Persistir datos del checkout

## Problema

En `/checkout`, los campos **Dirección de entrega** y **Apto/torre/referencias** se inicializan desde `useActiveSede()` solo en el primer render. Resultado:

- Si el usuario recarga la página, los inputs vuelven a leer de la sede activa pero cualquier edición posterior se pierde.
- Si el usuario borra accidentalmente el texto autocompletado, no hay forma de recuperarlo — tiene que reabrir el LocationGate.
- Los demás campos del formulario (nombre, teléfono, notas, método de pago) tampoco persisten entre recargas.

El usuario ya hizo el trabajo de identificar su dirección en el LocationGate; el checkout debería respetarlo.

## Solución

Persistir el estado del formulario de checkout en `localStorage` con la clave `kp.checkoutForm`, y mantener la dirección/detalles sincronizados con la sede activa en ambos sentidos.

### Comportamiento

1. **Al montar el checkout**: hidratar `nombre`, `telefono`, `direccion`, `detalles`, `notas`, `pago` desde `localStorage` si existen; si no, usar los valores de la sede activa (comportamiento actual).
2. **Al cambiar cualquier campo**: guardar en `localStorage` (con un pequeño debounce o en cada cambio, basta `useEffect`).
3. **Dirección y detalles** quedan sincronizados con `activeSede`:
   - Si el usuario edita el campo en checkout, también se actualiza `activeSede.direccionTexto` / `detalles` para que el header y otros lugares reflejen el cambio.
   - Si `activeSede` cambia (porque el usuario reabrió LocationGate y eligió otra dirección), el checkout adopta el nuevo valor.
4. **Al enviar la orden con éxito**: limpiar `kp.checkoutForm` para no contaminar pedidos futuros con datos viejos (mantenemos `nombre`/`telefono` opcionalmente, pero limpiamos `notas` y `pago` por defecto).

### Cambios técnicos

- `src/routes/checkout.tsx`:
  - Función `loadPersistedForm()` que lee de `localStorage` con try/catch y un schema mínimo.
  - Inicializar `useState` de cada campo con `persisted.xxx ?? sede?.xxx ?? ""`.
  - `useEffect` que serializa `{ nombre, telefono, direccion, detalles, notas, pago }` a `localStorage` cuando cambian.
  - `useEffect` que, cuando `direccion` o `detalles` cambian y difieren de `sede`, llama a `setActiveSede({ ...sede, direccionTexto: direccion, detalles })` para mantener la sede sincronizada (sin disparar recálculo de cobertura si la dirección textual no cambió geográficamente — solo actualizamos los campos de texto).
  - `useEffect` que, si `sede.direccionTexto` cambia desde afuera (nuevo LocationGate) y el usuario no había sobreescrito el campo, lo actualiza.
  - Tras `submitOrder` exitoso, limpiar `kp.checkoutForm`.

- No tocamos `LocationGate`, `active-sede.ts`, ni la lógica de cobertura — solo persistencia de UI.

## Fuera de alcance

- No agregamos un selector de "direcciones guardadas" (eso sería un siguiente paso si lo pides).
- No persistimos en la base de datos por usuario; todo queda en `localStorage` del navegador.
