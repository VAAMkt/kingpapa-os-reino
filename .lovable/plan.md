
## Objetivo

Que el personal pueda elegir desde `/admin/menu` qué 4 productos aparecen en la sección **"Los más bravos del menú"** del home (pestaña EL REINO), en vez del orden arbitrario actual.

## Estado actual

`src/routes/index.tsx` (líneas 70-78) toma los primeros 4 productos disponibles de la sede por defecto, sin curaduría:

```ts
prods.filter((p) => p.disponible).slice(0, 4)
```

El schema ya tiene la columna `destacado` en `rp_productos` y `/admin/menu` ya la edita (se usa hoy para el badge "Corona del Rey" en `ProductCard`). Solo hay que reutilizarla como criterio de selección de esta sección.

## Cambios

### 1. `src/routes/index.tsx` — criterio de selección
Reemplazar el `slice(0, 4)` por:

1. Filtrar `disponible === true` **y** `destacado === true`.
2. Ordenar por `nombre` (o por `rp_id` para estabilidad).
3. `slice(0, 4)`.
4. **Fallback:** si hay menos de 4 destacados, completar con `es_mas_vendido`, luego con `es_recomendado`, y por último con los primeros disponibles, para que la sección nunca quede vacía o incompleta.

### 2. `/admin/menu` — UX de curaduría
El toggle `destacado` ya existe en la tabla. Añadir:

- Una etiqueta visible tipo **"⭐ Corona del Rey — aparece en el home"** junto al toggle, para que el personal entienda qué controla.
- Un contador arriba de la lista: **"3/4 productos destacados en el home"**, con aviso rojo si hay más de 4 destacados (se mostrarán solo los primeros por orden alfabético) o menos de 4 (se completa con fallback).

### 3. Sin migración de DB
La columna ya existe. No hay cambios de schema, RLS ni grants.

## Fuera de alcance

- No se toca `ProductCard` ni el badge "Corona del Rey".
- No se cambia el menú `/menu` completo.
- No se agrega un campo nuevo `home_orden`: si más adelante quieres arrastrar para ordenar, se hace en una iteración aparte.

## Nota técnica

La sección depende del menú de `defaultSedeSlug` (la primera sede pública). Si un producto está marcado destacado pero no existe/está no-disponible en esa sede, no aparecerá — es el comportamiento correcto para no mostrar productos que no se pueden pedir.
