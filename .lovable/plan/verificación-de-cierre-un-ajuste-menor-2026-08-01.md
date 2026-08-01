# Verificación de cierre + un ajuste menor

## 1. Typecheck / build

`tsgo --noEmit` corre limpio: **0 errores**.

## 2. URLs en /sitemap.xml (generado en vivo)

Rutas estáticas (7): `/`, `/menu`, `/sedes`, `/historias`, `/franquicias`, `/login`, `/registro`.

Sedes (15, todas con slug):
limonar, la-flora, valle-de-lili, la-floresta, cc-unico, cc-unicentro, granada, pance,
jardin-plaza, mallplaza-cali, alfaguara-jamundi, modelia-bogota, gp-ensueno-bogota,
eden-bogota, mallplaza-nqs-bogota.

Más 26 historias publicadas (`/historias/{slug}`). Total 48 URLs.

## 3. /admin

- No hay ninguna URL `/admin*` en el sitemap.
- `public/robots.txt` ya trae `Disallow: /admin` (y `/mi-reino`, `/checkout`, `/gracias`, `/dashboard`, `/no-autorizado`, `/reset-password`).
- Enlaces desde código público:
  - `src/components/auth/UserMenu.tsx` → `/admin`, solo se renderiza para usuarios con rol admin/editor. OK.
  - `src/components/kp/CartPill.tsx` → solo compara `pathname`, no es un enlace. OK.
  - `src/routes/index.tsx` línea 211 → enlace visible a `/admin/sincronizacion` en el estado vacío del bloque "Los más bravos del menú". Es el único enlace público hacia `/admin`.

## Ajuste propuesto (único cambio de código)

En `src/routes/index.tsx`, en ese mensaje de estado vacío: quitar el `<Link>` y dejar el texto plano
("Un editor puede sincronizarlo desde el panel de administración"), para que la home no enlace nunca
a `/admin`. Sin cambios de lógica ni de datos.
