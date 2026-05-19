# Fix: las fotos del menú no cargan

## Causa raíz (confirmada con curl)

Las imágenes están bien guardadas en la base de datos. El problema es el **host** que estamos usando para componerlas.

- Lo que generamos hoy: `https://api.restaurant.pe/archivos/...` → **404 Not Found**
- Host correcto: `https://restaurant.pe/archivos/...` → **200 OK** ✅

Restaurant.pe sirve la API desde `api.restaurant.pe` pero los archivos estáticos desde el dominio raíz `restaurant.pe`. Por eso las cards muestran el placeholder roto: el `<img>` tiene `src` válido pero el servidor devuelve 404.

## Cambio

Una sola línea en `src/lib/restaurantpe-normalize.ts`:

```ts
const RP_IMG_BASE = "https://restaurant.pe/archivos/";
```

(antes: `https://api.restaurant.pe/archivos/`)

Esto arregla **todas las fotos** automáticamente, sin re-sincronizar — porque la URL final se compone en el cliente cada vez que se pinta la card. Lo que está en `productos_master.imagen_url` ya quedó como URL absoluta con el host viejo en algunos casos; para esos voy a:

1. Cambiar `RP_IMG_BASE` (efecto inmediato para próximas sincronizaciones y para el path relativo guardado).
2. Correr una sentencia que reemplace `api.restaurant.pe/archivos` por `restaurant.pe/archivos` en las filas ya guardadas:
   ```sql
   UPDATE productos_master
   SET imagen_url = REPLACE(imagen_url, 'https://api.restaurant.pe/archivos/', 'https://restaurant.pe/archivos/')
   WHERE imagen_url LIKE 'https://api.restaurant.pe/archivos/%';
   ```

## Verificación

- Recargar `/menu` y confirmar que se ven Clasiking, Costiking y Desvare con foto.
- Tab Combos: revisar que los combos con foto desde `lista_productobase` también carguen.

## Fuera de alcance

No tocar lógica de extracción (`normalizeProduct`), ni el flujo de modificadores, ni el checkout. Solo el host.
