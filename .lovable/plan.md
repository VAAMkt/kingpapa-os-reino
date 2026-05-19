## Problema

Algunos productos muestran la imagen IA `src/assets/hero-salchipapa.jpg` (la que vino con el diseño) cuando no tienen `imagen_url` real desde Restaurant.pe. El origen es `src/lib/menu.ts:77`:

```ts
imagen: row.imagen_url || placeholder,
```

## Cambios

1. **`src/lib/menu.ts`**
   - Quitar `import placeholder from "@/assets/hero-salchipapa.jpg"`.
   - Cambiar a `imagen: row.imagen_url ?? ""` (string vacío = sin imagen real).

2. **`src/components/kp/ProductCard.tsx`**
   - Renderizar `<img>` solo si `producto.imagen` no está vacía. El contenedor ya tiene `bg-kp-ink` (negro), así que sin imagen queda el fondo negro pedido. Badges y resto del layout intactos.

3. **`src/components/kp/ProductCustomizerSheet.tsx`**
   - Mismo guard: render condicional del `<img>` del hero del sheet. Mantener el `bg-kp-ink` como fondo negro.

4. **`src/components/kp/CartDrawer.tsx`**
   - Ya tiene `{i.imagen && (...)}`, no se toca.

No se toca el hero de la home (`src/routes/index.tsx`), ni `src/data/productos.ts` (datos de ejemplo no usados en `/menu`), ni la lógica de Restaurant.pe ni base de datos. Solo presentación.

## Verificación

- Recargar `/menu`: productos con `imagen_url` real siguen mostrando la foto de Restaurant.pe; los que no tienen, muestran cuadro negro sin la imagen IA.
