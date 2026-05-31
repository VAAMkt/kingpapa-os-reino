# Plan: Dirección con autocompletado + mapa en SedeForm

Eliminar la fricción de escribir coordenadas a mano en el panel de sedes. El administrador escribe la dirección, elige una sugerencia de Google Places, y ajusta el pin arrastrándolo en un mini-mapa. Lat/lng se calculan solos y son la única fuente de verdad para el cálculo de cobertura del checkout.

## Alcance

Solo afecta `src/components/admin/SedeForm.tsx`. No se tocan tablas ni el cálculo de cobertura (`active-sede.ts`) — ese ya usa `sede.lat/lng` de la BD; lo que arreglamos es que esos valores ahora siempre serán precisos.

## Reutilización

Los dos componentes que necesitamos ya existen y se usan en LocationGate:

- `PlacesAutocomplete` (`src/components/kp/PlacesAutocomplete.tsx`) — buscador con sugerencias de Places API (New), devuelve `{lat, lng, label}`.
- `GateMap` (`src/components/kp/GateMap.tsx`) — mini-mapa con marker arrastrable, soporta click y dragend.

No hace falta crear componentes nuevos ni instalar paquetes. El loader de Google Maps (`lib/google-maps.ts`) ya está configurado con la API key correcta.

## Cambios en `SedeForm.tsx`

### 1. Reemplazar el campo "Dirección" actual

Hoy es un `BrutalInput` simple. Cambiarlo por `PlacesAutocomplete`:

- `onPick({ lat, lng, label })` actualiza `form.direccion = label`, `form.lat = lat`, `form.lng = lng` de una sola vez.
- Mantener el `BrutalInput` como **fallback editable** debajo en modo solo-vista del texto seleccionado (para que el admin pueda corregir el string si Google devuelve "Cl 5 #66-25, Cali, Colombia" y prefiere "Cl. 5 #66-25"). Permitir editar el texto sin perder las coordenadas.

### 2. Mini-mapa interactivo

Debajo del autocompletado, renderizar `<GateMap>` solo cuando `form.lat != null && form.lng != null`. Antes de eso, mostrar un placeholder pequeño tipo "Selecciona una dirección para ver el mapa".

- `center = { lat: form.lat, lng: form.lng }`
- `onPinChange({ lat, lng })` → `setForm({ ...form, lat, lng })`

El círculo de cobertura visual queda fuera de alcance (opcional futuro); solo el pin arrastrable.

### 3. Convertir lat/lng a campos de solo lectura

En la sección "Restaurant.pe & ubicación":

- Quitar los dos `BrutalInput type="number"` editables para lat/lng.
- Reemplazarlos por un bloque pequeño de solo lectura tipo "Coordenadas: 3.4516, -76.5320 · ajusta arrastrando el pin" (texto, no input). Si están vacías, mostrar "Sin ubicación aún".
- Mantener el campo "Cobertura (km)" tal cual (sí debe seguir editable).

### 4. Desacoplar de Restaurant.pe para lat/lng

En el `onChange` del `<select>` de Restaurant.pe (líneas 264-274), hoy autocompleta `lat`/`lng` si están vacíos con los del local de RP. **Eliminar ese autocompletado de coordenadas** — el rp_local_id se sigue vinculando pero NO toca lat/lng. La única fuente queda Google Places + pin del mapa.

### 5. Validación Zod

`SedeSchema` ya valida lat/lng como nullable. Considerar (sin bloquear) agregar un refinement "si tiene rp_local_id o delivery=true, recomienda tener lat/lng" — solo como warning visual, no bloqueante, para no romper sedes existentes sin coordenadas.

## Layout propuesto del bloque de ubicación

```text
┌─ Dirección ──────────────────────────────────┐
│ [🔍 PlacesAutocomplete: "Av 9N #15-30..."]    │
│ Texto editable: [Cl. 5 #66-25            ]    │
├─ Ubicación en mapa ──────────────────────────┤
│ ┌──────────────────────────────────────────┐ │
│ │         [Mini-mapa con pin]              │ │
│ │         (arrastrable)                    │ │
│ └──────────────────────────────────────────┘ │
│ Coordenadas: 3.4516, -76.5320                │
│ Arrastra el pin para afinar la ubicación.    │
└──────────────────────────────────────────────┘
```

## Fuera de alcance

- Cambios en el cálculo de cobertura del checkout (ya quedó bien en la iteración anterior).
- Dibujar el círculo de cobertura sobre el mapa.
- Backfill de sedes existentes sin coordenadas (el admin las re-guarda manualmente cuando entre a editar).
- Migrar la lógica del autocompletado de RP (solo se quita el side-effect sobre lat/lng).

## Verificación

1. Crear sede nueva: escribir dirección → elegir sugerencia → ver pin en el mapa → arrastrar → guardar → confirmar en BD que lat/lng coinciden con el pin final.
2. Editar sede existente con lat/lng: ver pin en posición correcta, arrastrar, guardar, confirmar update.
3. Editar sede sin lat/lng: mapa oculto hasta seleccionar dirección.
4. Cambiar el local de RP no debe pisar lat/lng cuando ya están seteadas.

### Optimizaciones recomendadas para agregar al plan

1. **Restricción de País (Location Bias):** En el punto 1 (`PlacesAutocomplete`), pídele que se asegure de que la búsqueda de Google Places esté restringida estrictamente a Colombia (`country: 'co'`). Esto evitará que al escribir una dirección genérica se autocompleten opciones de México o España por accidente.
2. **Independencia del Input Editable:** En el punto 1, especifica que la edición del `BrutalInput` de respaldo actualice **únicamente** el string de la dirección, sin volver a disparar peticiones a la API de Google Maps ni alterar el pin que ya se había ajustado manualmente.
3. **Manejo de Errores de API:** En el punto 2, indica que si por alguna razón la API de Google Maps falla o el script tarda en cargar, el componente no debe romper la pantalla, sino mostrar un mensaje discreto (ej. "Cargando mapa...").