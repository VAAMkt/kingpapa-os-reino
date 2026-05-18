
## Objetivo

1. Cargar las 15 sedes reales de KINGPAPA en la página `/sedes` (sin cambiar el diseño).
2. Mover las sedes de mock estático (`src/data/sedes.ts`) a la base de datos para que se puedan administrar.
3. Crear módulo admin en `/admin/sedes` para crear / editar / despublicar sedes.
4. Cambiar el botón "Pedir aquí" para que use el flujo de pedido interno de la web (no WhatsApp). "Cómo llegar" se mantiene a Google Maps.
5. Añadir cierre comercial: CTA a `/franquicias` ("¿Quieres ser parte del Reino?").

---

## 1. Base de datos

Nueva tabla `public.sedes` (migración):

- `id uuid pk`, `slug text unique`, `nombre text`, `ciudad text`, `direccion text`
- `barrio text null`, `mall text null`
- `horario text` (texto libre tipo "12:00pm – 1:00am")
- `abierta_ahora bool default true`, `delivery bool`, `pickup bool`, `qr_mesa bool`
- `whatsapp text null`, `maps_url text null`, `orden int default 0`, `publicado bool default true`
- `created_at`, `updated_at` con trigger `set_updated_at`

RLS:
- `SELECT` pública cuando `publicado = true`.
- `SELECT` total + `INSERT/UPDATE/DELETE` para `super_admin` o `editor` (mismo patrón que `posts`).

Seed: insertar las 15 sedes del payload del usuario, normalizando ciudad (`Cali`/`Jamundí`/`Bogotá`), y guardando el número de WhatsApp solo como dígitos (`573172455336`, `573027139738`, `573143484983`, null para El Edén). `maps_url` = URL de Google Maps provista.

---

## 2. Capa de datos cliente

- `src/lib/sedes.ts`: `listPublicSedes()`, `listAllSedes()`, `getSedeById()`, `createSede()`, `updateSede()`, `deleteSede()` (mismo patrón que `src/lib/posts.ts`, usando `supabase` browser client; RLS hace el trabajo).
- Adaptar `src/types/kp.ts > Sede` para incluir `slug` y `publicado` (sin romper consumos actuales).
- Marcar `src/data/sedes.ts` como deprecated y dejar el `OrderRouter` consumiendo desde la query de sedes publicadas (React Query) en vez del array estático.

---

## 3. `/sedes` (sin tocar el diseño)

- Reemplazar el `useMemo` sobre el array estático por `useQuery(['sedes','public'], listPublicSedes)`.
- Ajustar derivación de `ciudades` para que salga del resultado real (Cali, Jamundí, Bogotá).
- En `LocationCard` (`src/components/kp/Cards.tsx`):
  - "Cómo llegar" → sigue usando `sede.mapsUrl`.
  - "Pedir aquí" → cambia de `wa.me/...` a un `Link` interno a `/menu` con `search={{ sede: sede.slug }}` (el `/menu` ya es nuestro flujo de pedido; preseleccionar sede vía query). Sin WhatsApp.
- Nuevas secciones (manteniendo estilo brutalist, mismos componentes `BrutalCard`/`SectionHeading`):
  1. **"El Reino crece"**: 3 stats (`15 sedes`, `3 ciudades`, `meta 50 sedes 2030`).
  2. **"Cómo pedir"** — ya existe, se conserva.
  3. **CTA "¿Quieres traer el Reino a tu ciudad?"**: bloque `BrutalCard tone="purple"` con copy de franquicias y `BrutalLink` a `/franquicias` ("Quiero ser parte del Reino").

---

## 4. Admin `/admin/sedes`

Nueva ruta layout + listado + edición, copiando el patrón de `/admin/contenidos`:

- `src/routes/admin.sedes.tsx` — layout con `<Outlet/>`.
- `src/routes/admin.sedes.index.tsx` — tabla con columnas: Nombre, Ciudad, Dirección, Estado, Acciones (Editar / Publicar-Despublicar / Eliminar). Botón "+ Nueva sede".
- `src/routes/admin.sedes.nuevo.tsx` y `src/routes/admin.sedes.$id.tsx` — formulario `SedeForm` compartido en `src/components/admin/SedeForm.tsx`:
  - Campos: nombre, slug (autogenerado del nombre, editable), ciudad (select Cali/Bogotá/Jamundí + "otra"), dirección, barrio, mall, horario, whatsapp (solo dígitos), maps_url, switches delivery/pickup/qr_mesa/abierta_ahora/publicado, orden.
  - Validación con `zod`.
- Agregar item "Sedes" al `adminNav` de `src/routes/admin.tsx` (quitar el `soon: true` actual).

---

## 5. Detalle técnico extra

- "Pedir aquí" interno: `/menu` aún no tiene lógica por sede; sólo pasamos `?sede=<slug>` para que cuando exista el flujo real ya esté cableado. En esta iteración el botón abre el menú; no más WhatsApp por sede listada.
- Mantener `OrderRouter` con sus opciones existentes (Rappi/DiDi/WhatsApp) — es otro componente y el usuario no pidió tocarlo.
- No se cambia paleta, tipografía, ni componentes UI.

---

## Archivos a crear / modificar

**Crear**
- `supabase/migrations/<ts>_sedes.sql` (tabla + RLS + seed con las 15 sedes)
- `src/lib/sedes.ts`
- `src/components/admin/SedeForm.tsx`
- `src/routes/admin.sedes.tsx`
- `src/routes/admin.sedes.index.tsx`
- `src/routes/admin.sedes.nuevo.tsx`
- `src/routes/admin.sedes.$id.tsx`

**Modificar**
- `src/types/kp.ts` (añadir `slug`, `publicado` opcionales)
- `src/routes/sedes.tsx` (query + nuevas secciones + CTA franquicias)
- `src/components/kp/Cards.tsx` (botón "Pedir aquí" → Link interno a `/menu`)
- `src/components/kp/OrderRouter.tsx` (consumir sedes desde query)
- `src/routes/admin.tsx` (activar item "Sedes")
- `src/data/sedes.ts` (deprecar o vaciar tras migración)
