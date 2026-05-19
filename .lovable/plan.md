## Diagnóstico real

El problema no es la card ni el `<img>`: el navegador sí intenta cargar `producto.imagen`.

La causa raíz confirmada es que las URLs guardadas apuntan a `https://restaurant.pe/archivos/...`, pero ese dominio devuelve una página HTML de Restaurant.pe, no una imagen:

```text
https://restaurant.pe/archivos/... -> 200 text/html
```

Por eso “parece que existe” pero no se muestra: el navegador recibe HTML donde espera JPEG/PNG.

Inspeccioné el JavaScript oficial del panel de Restaurant.pe (`kingpapa.restaurant.pe/restaurant/scripts/scripts...js`) y ahí aparece la constante real:

```text
RESTPE_IMG.URL_BASE = https://img.restpe.com
```

Probé las mismas rutas contra esa CDN y sí devuelven imágenes reales:

```text
https://img.restpe.com/kingpaparestaurantpe/productos/...jpg -> 200 image/jpeg
https://img.restpe.com/kingpaparestaurantpe/productos/...png -> 200 image/png
https://img.restpe.com/kingpaparestaurantpe/products/... -> 200 image/jpeg
```

## Plan de corrección

1. Cambiar el normalizador de imágenes de Restaurant.pe:
   - De: `https://restaurant.pe/archivos/`
   - A: `https://img.restpe.com/`

2. Hacer `resolveRpImage` más defensivo para que también repare URLs absolutas ya guardadas con hosts incorrectos:
   - `https://restaurant.pe/archivos/...`
   - `https://api.restaurant.pe/archivos/...`
   - `http://restaurant.pe/archivos/...`
   - `http://api.restaurant.pe/archivos/...`

   Todas deben quedar como:

   ```text
   https://img.restpe.com/...
   ```

3. Actualizar las filas existentes en `productos_master.imagen_url` para reemplazar los hosts malos por `https://img.restpe.com/`.

4. Validar en navegador que las requests de imagen ya salgan a `img.restpe.com` y respondan como `Image 200`, no como error/HTML.

## Archivos a tocar

- `src/lib/restaurantpe-normalize.ts`

## Base de datos

Ejecutar una actualización de URLs existentes en `productos_master`, sin tocar productos, precios, categorías, modificadores ni disponibilidad.