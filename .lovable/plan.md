# Plan — KINGPAPA OS: El Sistema Operativo del Reino

Construir la web completa siguiendo los bocetos del zip (Home, Menú, Sedes, Franquicias, Dashboard) + Historias del Reino, sobre el stack actual del proyecto (TanStack Start + React + TS + Tailwind v4), no Next.js — el stack ya está fijado en Lovable y cumple los mismos objetivos (rutas, SSR, TS, Tailwind). Mobile-first, con versión desktop trabajada.

## 1. Design system (src/styles.css + componentes base)

Tokens nuevos en `:root` (oklch) mapeados en `@theme inline`:
- `--kp-yellow` (papa), `--kp-orange` (salsa), `--kp-red` (fuego), `--kp-black` (noche), `--kp-purple` (neón), `--kp-cheese` (blanco queso), `--kp-lime` (acento), más `--kp-bg`, `--kp-ink`, `--kp-border`.
- Sombras duras: `--shadow-brutal: 6px 6px 0 0 var(--kp-black)`.
- Radios mínimos (neo-brutalismo: bordes marcados).
- Fuentes vía Google Fonts (`<link>` en `__root.tsx` head): **Bebas Neue** (display) y **Montserrat** (texto). Variables `--font-display`, `--font-body`.

Componentes base reutilizables en `src/components/ui-kp/`:
- `BrutalButton` (variants: primary amarillo, fire rojo, ghost, neon morado), `BrutalCard`, `BrutalBadge`, `BrutalInput`, `BrutalChip`, `BrutalModal`, `Stepper`.

## 2. Componentes de dominio (`src/components/kp/`)

- `TopAppBar` — logo KINGPAPA + nav fija + mini OrderRouter.
- `Footer` — links + “Si estás a dieta, NO nos sigas.”
- `OrderRouter` — selector de ciudad/sede, 3 CTAs (apps / directo / pickup), deeplinks Rappi/DiDi/WhatsApp (TODO con URLs reales).
- `Hero`, `ProductCard`, `LoyaltyModule` (con teaser de quiz), `QuizSubdito` (modal multi-step), `TrackerOperativo` (4 pasos animados), `EventCard`, `LocationCard`, `LeadFormFranquicia`, `Testimonios`, `LayoutDashboard`.

## 3. Datos mock y tipos (`src/data/`, `src/types/`)

`types/`: `Producto`, `Categoria`, `Sede`, `Historia`, `Usuario`, `Subdito`, `LeadFranquicia`, `QuizQuestion`, `OrderChannel`.
`data/`: `productos.ts`, `categorias.ts`, `sedes.ts` (Cali, Bogotá, Jamundí, Medellín), `historias.ts`, `quiz.ts`, `dashboardMock.ts`. Cada archivo con `// TODO: reemplazar por API …`.

## 4. Rutas (`src/routes/`)

Cada ruta con su `head()` (title, description, og:*) único:
- `index.tsx` — Home: Hero, OrderRouter, Productos estrella, TrackerOperativo demo, Retos/Festivales, LoyaltyModule, Sedes resumen, SocialProof.
- `menu.tsx` — Hero menú + chips de filtros + grid ProductCard + módulo Combo Imán.
- `sedes.tsx` — Hero + buscador + filtros + lista LocationCard + módulo educativo.
- `franquicias.tsx` — Hero + “lo que nadie te cuenta” + futuro/mapa + LeadForm + bloque cultura/BIC.
- `historias.tsx` — Hero + filtros por categoría + grid EventCard.
- `dashboard.tsx` — LayoutDashboard mock (cards de KPIs, top sedes, top productos, súbditos).

Reemplaza el placeholder actual de `index.tsx`. `__root.tsx` añade fuentes y conserva `<Outlet />`.

## 5. Imágenes

Extraer del sitio existente `kingpapacali.com` (logo, productos, retos) vía `fetch_website` y guardarlas en `src/assets/`. Donde falte, usar `imagegen` con prompts brand-aligned (papa gigante neón, festival nocturno caleño). Bocetos del zip ya inspeccionados como referencia visual.

## 6. Integraciones futuras (TODOs marcados)

- OrderRouter → Rappi/DiDi deeplinks + WhatsApp Business API.
- Quiz/Loyalty → endpoint POST `/api/subditos` (preparado pero no implementado; se podría activar Lovable Cloud después).
- LeadFormFranquicia → POST `/api/leads`.
- Dashboard → fetch real cuando exista backend.

## Detalles técnicos

- TanStack Start file-based routing (ya configurado). No tocar `routeTree.gen.ts`.
- Tailwind v4 con `@theme inline` — agregar tokens KP ahí (oklch).
- Mobile-first: layouts en una columna, breakpoints `md:` y `lg:` para grids 2–4 col.
- Sin backend en esta iteración; todo con mocks tipados. Loyalty/quiz capturan en `localStorage` con función `saveSubdito()` lista para swap a API.
- No se añade auth real (registro de súbdito es captura de email/WhatsApp en form, no login).

## Fuera de alcance (para próxima iteración)

- Conexión real a Lovable Cloud (auth, DB, storage) — se deja arquitectura lista.
- Pasarela de pago / checkout propio.
- Mapa interactivo real en /sedes (se usa lista + placeholder de mapa).
- Internacionalización.

Al aprobar, implemento todo de una sola pasada y entrego la app navegable.
