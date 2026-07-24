# Plan: Fidelización, Mi Reino y Admin — todo funcional

Hoy `mi-reino/*`, `admin/index` y el módulo de "Súbditos" son mock (dashboardMock, "0 pts", "Aún no tienes pedidos", localStorage). Este plan los convierte en funcionalidad real sobre datos ya existentes en `orders`, `profiles` y `user_roles`, agregando lo mínimo indispensable para loyalty.

## 1. Backend — nuevas tablas y funciones

**Migración (una sola):**
- `loyalty_accounts` (user_id PK, puntos_balance, puntos_lifetime, tier, referral_code único, referred_by).
- `loyalty_ledger` (user_id, order_id nullable, tipo `earn|redeem|bonus|refund|adjust`, puntos, motivo, meta jsonb).
- `loyalty_rewards` (nombre, descripcion, costo_puntos, tipo `descuento_fijo|producto|envio_gratis`, valor, activo, stock nullable, imagen).
- `loyalty_redemptions` (user_id, reward_id, order_id nullable, puntos_gastados, codigo único, status `emitido|usado|expirado`, expires_at).
- `order_favorites` (user_id, order_id, alias).
- `subditos` (email, whatsapp, arquetipo, ciudad, respuestas jsonb, user_id nullable) — el quiz de `LoyaltyModule` hoy solo escribe localStorage.
- GRANTs a `authenticated`/`service_role`, RLS por `auth.uid()`, `has_role('super_admin'|'marketing')` para admin.
- Trigger `on orders.status='entregado'` → INSERT en `loyalty_ledger` (10 pts por cada $10.000 de `total`) + recompute `loyalty_accounts.puntos_balance/lifetime/tier`. Idempotente por `order_id`.
- Función `redeem_reward(reward_id)` SECURITY DEFINER: valida saldo/stock, descuenta puntos, emite `loyalty_redemptions` con código corto.
- Tiers derivados de `puntos_lifetime`: Parcero (0), Rey (500), Coronado (2000).

## 2. Server functions (`src/lib/loyalty.functions.ts`, `mi-reino.functions.ts`, `admin-stats.functions.ts`)

Todas con `requireSupabaseAuth`.
- `getMyLoyalty()` → cuenta, tier, próximo tier, últimos 20 movimientos.
- `listRewards()` / `redeemReward({reward_id})` / `listMyRedemptions()`.
- `getMyOrders({limit,cursor})` → paginado con status/total/items resumidos.
- `repeatOrder({order_id})` → devuelve carrito reconstruido para `/checkout`.
- `listMyFavorites()` / `toggleFavorite({order_id, alias?})`.
- `updateMyProfile({display_name, whatsapp, ciudad})`.
- `getMyReferralCode()` / `applyReferralCode({code})` (una vez, en signup o primer pedido).
- `saveSubditoQuiz({email,whatsapp,arquetipo,respuestas,ciudad})` público — reemplaza el localStorage actual.
- **Admin** (`super_admin|marketing`): `getAdminDashboard({range: '24h'|'7d'|'30d'})` con pedidos/ingresos/ticket promedio por canal (tipo)/sede/producto/estado + súbditos nuevos, todo con SQL agregado sobre `orders` y `subditos`. `listSubditos({cursor,search})`, `listLoyaltyLedger({user_id?})`, `adjustPoints({user_id,puntos,motivo})`, CRUD de `loyalty_rewards`.

## 3. UI — Mi Reino (cliente)

- `/mi-reino` (index): tarjeta de saldo/tier con barra al próximo tier, último pedido con botón "Repetir" y "Ver tracking", CTA a recompensas.
- `/mi-reino/pedidos`: lista real con estado/fecha/total + link a `/gracias?order=<id>` y botón "Repetir" / "Marcar favorito".
- `/mi-reino/puntos`: saldo, tier, historial (`loyalty_ledger`), catálogo `loyalty_rewards` con canje + "Mis códigos" (`loyalty_redemptions`).
- `/mi-reino/favoritos`: pedidos guardados con alias editable y "Repetir".
- `/mi-reino/datos`: formulario editable (display_name, whatsapp, ciudad) + código de referido con botón copiar/compartir WhatsApp.
- Aplicar tono "la banda" (verbatim ya adoptado).

## 4. UI — Admin

- `/admin` (index): reemplaza `dashboardMock` por `getAdminDashboard` con selector de rango, KPIs (pedidos, ingresos, ticket, cancelación %), pedidos por canal (tipo), sedes top, productos top (derivados de `orders.items`), súbditos nuevos vs totales, últimos pedidos con link a `/admin/pedidos`.
- `/admin/loyalty` (nueva): tabla de `loyalty_accounts` con búsqueda, ledger por usuario, ajuste manual de puntos, CRUD de recompensas.
- `/admin/subditos` (nueva): lista `subditos` con export CSV, filtros por arquetipo/ciudad.
- Añadir ambos al sidebar de `admin.tsx` (hoy `LOYALTY · SOON` y `CAMPAÑAS · SOON`).

## 5. Checkout / quiz — enganches

- `checkout.tsx`: al confirmar y si el usuario está logueado, ofrecer canjear una `loyalty_redemption` activa (aplica el `valor` como descuento; guardar `redemption_id` en `orders.rp_payload.meta`).
- `LoyaltyModule` quiz: llamar `saveSubditoQuiz` en lugar de sólo `localStorage`; si hay sesión, vincular `user_id`.

## Detalles técnicos

- Puntos se computan en trigger (no en cliente) para evitar fraude; el trigger deduplica por `order_id` en `loyalty_ledger`.
- `repeatOrder` reconstituye `items` respetando stock/precio actual de `productos_master` y `sede_producto_overrides`; si algo cambió, marca warning en UI.
- Códigos de redención: `nanoid` 8 chars, únicos, TTL 30 días por defecto.
- Todas las queries admin usan `has_role` vía `context.supabase` (no `supabaseAdmin` para autorización).
- Sin cambios en integraciones RP, tracking ni webhook.

## Fuera de alcance (para no inflar el commit)

- Push/email transaccional de puntos ganados (queda TODO con el trigger listo).
- Campañas segmentadas por arquetipo (se habilita después con `subditos` ya poblada).
- Programa multi-nivel de referidos (v1: 1 nivel, bono fijo).

¿Apruebas y sigo con la migración + implementación?
