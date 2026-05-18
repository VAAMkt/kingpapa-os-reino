## Objetivo de la fase 1

Activar Lovable Cloud y montar el esqueleto de las dos sub-apps de KINGPAPA OS — `/admin` (CMS + operación) y `/mi-reino` (portal del cliente) — con **auth real, sistema de roles y rutas protegidas**. El contenido funcional de cada módulo (CRUDs, pedidos, puntos) se construye en fases siguientes sobre esta base.

Las fases 2+ (CMS de contenidos, pedidos con checkout propio, MVP de puntos) se mencionan al final como roadmap, pero no se implementan en este turno.

---

## 1. Activar Lovable Cloud

- Activar la integración (provisiona Postgres, Auth y storage).
- Configurar Auth: Email/Password + Google (vía broker de Lovable).
- Habilitar leaked password protection.

## 2. Modelo de datos inicial (migración)

Solo lo imprescindible para roles + perfil. Lo demás se añade en cada fase.

```text
profiles
  id uuid PK -> auth.users(id) ON DELETE CASCADE
  display_name text
  whatsapp text
  ciudad text
  arquetipo text         -- del quiz existente
  created_at timestamptz default now()

app_role (enum): 'super_admin' | 'editor' | 'marketing' | 'franquiciado' | 'cliente'

user_roles
  id uuid PK
  user_id uuid -> auth.users(id) ON DELETE CASCADE
  role app_role NOT NULL
  sede_id uuid NULL          -- para franquiciados (scope por sede, fase 2)
  UNIQUE(user_id, role)

has_role(_user_id uuid, _role app_role) RETURNS boolean
  SECURITY DEFINER, STABLE, SET search_path = public
```

**RLS**
- `profiles`: el usuario ve/edita el suyo; `super_admin` ve todos (vía `has_role`).
- `user_roles`: solo `super_admin` puede insertar/borrar; cada usuario puede leer sus propios roles.
- Trigger `handle_new_user()` (AFTER INSERT en `auth.users`) → crea fila en `profiles` y asigna rol `cliente` por defecto.

## 3. Auth wiring (TanStack Start)

- Listener `supabase.auth.onAuthStateChange` en `__root.tsx` → `router.invalidate()` + `queryClient.invalidateQueries()`.
- Hook `useAuth()` que expone `{ user, session, roles, hasRole, hasAnyRole, signOut }`.
- `attachSupabaseAuth` ya está en `src/start.ts` (verificar; si falta, añadir como `functionMiddleware`).
- Server fn `getMyRoles()` con `requireSupabaseAuth` que devuelve los roles del usuario actual.

## 4. Rutas y layouts

### Rutas públicas nuevas
- `src/routes/login.tsx` — email/password + botón Google. Soporta `?redirect=` para volver al destino.
- `src/routes/registro.tsx` — signup (crea usuario → trigger crea profile + rol `cliente`).
- `src/routes/reset-password.tsx` — set new password (requerido por flujo de recovery).

### Sub-app cliente — `/mi-reino` (layout `_cliente`)
- `src/routes/_cliente.tsx` — `beforeLoad` exige sesión; redirige a `/login` si no.
- `src/routes/_cliente/mi-reino.tsx` — landing del portal con tabs placeholders: **Inicio · Pedidos · Puntos · Datos · Favoritos**.
- Layout reutiliza `Layout.tsx` actual + sidebar/tabs en estilo brutal.

### Sub-app admin — `/admin` (layout `_admin`)
- `src/routes/_admin.tsx` — `beforeLoad`: exige sesión + `hasAnyRole(['super_admin','editor','marketing','franquiciado'])`; si no, redirige a `/` o `/no-autorizado`.
- `src/routes/_admin/index.tsx` — Dashboard placeholder con KPIs mock (reusa `dashboardMock`).
- Shell con `SidebarProvider` shadcn + secciones del sidebar (links a rutas todavía no implementadas, marcadas como "Próximamente" para no romper navegación):
  - Dashboard · Contenidos · Menú · Sedes · Pedidos · Loyalty · Campañas · Usuarios · Integraciones
- `src/routes/no-autorizado.tsx` — pantalla 403 en estilo del reino.

### Header / navegación pública
- En `Layout.tsx`, agregar en el header:
  - Si no hay sesión → "Iniciar sesión" / "Crear cuenta".
  - Si hay sesión cliente → avatar + dropdown ("Mi Reino", "Cerrar sesión").
  - Si hay sesión con rol admin → además link a "Admin".

## 5. Componentes nuevos

- `src/components/auth/LoginForm.tsx`, `SignupForm.tsx`, `ResetPasswordForm.tsx` — estilo brutal (reutiliza `BrutalInput`, `BrutalButton`).
- `src/components/auth/UserMenu.tsx` — avatar + dropdown en header.
- `src/components/admin/AdminSidebar.tsx` — sidebar shadcn con secciones.
- `src/components/admin/AdminShell.tsx` — wrapper con `SidebarProvider` + header con `SidebarTrigger`.
- `src/components/cliente/ClienteTabs.tsx` — tabs del portal.
- `src/hooks/useAuth.ts` — hook centralizado.

## 6. Integración con quiz existente

`LoyaltyModule` actualmente guarda en `localStorage`. Cambiamos: si hay sesión, hace UPSERT en `profiles` (`arquetipo`, `whatsapp`, `ciudad`); si no, sigue en `localStorage` y al hacer signup migra esos datos al profile.

## 7. Out of scope (fases siguientes)

Aprobado conceptualmente, NO se implementa ahora:
- **Fase 2 — CMS de contenidos**: tablas `posts`, `post_categories`, `media`; mover `historias.ts` a DB; CRUDs en `/admin/contenidos`, `/admin/menu`, `/admin/sedes`.
- **Fase 3 — Pedidos + checkout propio**: tablas `orders`, `order_items`; carrito; `/admin/pedidos` con cola por estados; tracker conectado a DB.
- **Fase 4 — Loyalty MVP**: `loyalty_accounts`, `loyalty_transactions`; reglas (X% del subtotal en puntos); canje en checkout; vista de saldo en `/mi-reino/puntos`.
- **Fase 5+**: campañas, cupones, integraciones POS / Rappi / DiDi, segmentación.

---

## Detalles técnicos

- **Stack**: TanStack Start v1 + Supabase (Lovable Cloud). Auth con `requireSupabaseAuth` para server fns; `supabaseAdmin` solo para operaciones server-only verificadas.
- **Roles**: tabla separada `user_roles` + función `has_role` SECURITY DEFINER (evita recursión RLS). Nunca guardar rol en `profiles`.
- **Rutas protegidas**: `beforeLoad` en layouts `_cliente` y `_admin` con `throw redirect(...)` — no en componentes (evita flash).
- **Hidratación**: el error actual de "ago/sept" en `Cards.tsx` ya quedó pendiente; lo arreglo de paso forzando `MESES` consistentes (ya estaba previsto pero quedó residuo). Revisar `formatFecha` y `EventCard`.
- **Migraciones**: una sola migración que crea enum, tablas, función, trigger y políticas RLS.

## Criterios de aceptación fase 1

1. Cloud activado, Auth con email + Google funcionando.
2. `/login`, `/registro`, `/reset-password` operativas.
3. Signup crea automáticamente `profile` + rol `cliente`.
4. `/mi-reino` accesible solo con sesión; muestra tabs placeholder y datos del profile.
5. `/admin` accesible solo con rol admin/editor/marketing; muestra dashboard mock + sidebar navegable (secciones marcadas como "Próximamente" si no hay CRUD aún).
6. Header público refleja estado de sesión y rol.
7. Quiz `LoyaltyModule` persiste arquetipo en `profiles` cuando hay sesión.
8. Sin errores de hidratación en `/historias`.
