
-- =========================================
-- LOYALTY + FAVORITES + SUBDITOS (v1)
-- =========================================

-- ---------- loyalty_accounts ----------
CREATE TABLE public.loyalty_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  puntos_balance integer NOT NULL DEFAULT 0,
  puntos_lifetime integer NOT NULL DEFAULT 0,
  tier text NOT NULL DEFAULT 'parcero',
  referral_code text NOT NULL UNIQUE DEFAULT upper(substring(replace(gen_random_uuid()::text,'-',''),1,8)),
  referred_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.loyalty_accounts TO authenticated;
GRANT ALL ON public.loyalty_accounts TO service_role;
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_accounts: dueño ve" ON public.loyalty_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "loyalty_accounts: dueño actualiza" ON public.loyalty_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "loyalty_accounts: dueño inserta" ON public.loyalty_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "loyalty_accounts: admin ve todo" ON public.loyalty_accounts FOR SELECT TO authenticated USING (app_private.has_role(auth.uid(),'super_admin') OR app_private.has_role(auth.uid(),'marketing'));
CREATE TRIGGER loyalty_accounts_set_updated_at BEFORE UPDATE ON public.loyalty_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- loyalty_ledger ----------
CREATE TABLE public.loyalty_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('earn','redeem','bonus','refund','adjust')),
  puntos integer NOT NULL,
  motivo text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX loyalty_ledger_earn_per_order ON public.loyalty_ledger(order_id) WHERE tipo='earn' AND order_id IS NOT NULL;
CREATE INDEX loyalty_ledger_user_idx ON public.loyalty_ledger(user_id, created_at DESC);
GRANT SELECT ON public.loyalty_ledger TO authenticated;
GRANT ALL ON public.loyalty_ledger TO service_role;
ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_ledger: dueño ve" ON public.loyalty_ledger FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "loyalty_ledger: admin ve" ON public.loyalty_ledger FOR SELECT TO authenticated USING (app_private.has_role(auth.uid(),'super_admin') OR app_private.has_role(auth.uid(),'marketing'));

-- ---------- loyalty_rewards ----------
CREATE TABLE public.loyalty_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  costo_puntos integer NOT NULL CHECK (costo_puntos > 0),
  tipo text NOT NULL CHECK (tipo IN ('descuento_fijo','producto','envio_gratis')),
  valor numeric NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  stock integer,
  imagen text,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loyalty_rewards TO authenticated, anon;
GRANT ALL ON public.loyalty_rewards TO service_role;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rewards: público ve activas" ON public.loyalty_rewards FOR SELECT TO authenticated, anon USING (activo = true);
CREATE POLICY "rewards: admin gestiona" ON public.loyalty_rewards FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(),'super_admin') OR app_private.has_role(auth.uid(),'marketing'))
  WITH CHECK (app_private.has_role(auth.uid(),'super_admin') OR app_private.has_role(auth.uid(),'marketing'));
CREATE TRIGGER loyalty_rewards_set_updated_at BEFORE UPDATE ON public.loyalty_rewards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- loyalty_redemptions ----------
CREATE TABLE public.loyalty_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES public.loyalty_rewards(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  puntos_gastados integer NOT NULL,
  codigo text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'emitido' CHECK (status IN ('emitido','usado','expirado','anulado')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX loyalty_redemptions_user_idx ON public.loyalty_redemptions(user_id, created_at DESC);
GRANT SELECT ON public.loyalty_redemptions TO authenticated;
GRANT ALL ON public.loyalty_redemptions TO service_role;
ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "redemptions: dueño ve" ON public.loyalty_redemptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "redemptions: admin ve" ON public.loyalty_redemptions FOR SELECT TO authenticated USING (app_private.has_role(auth.uid(),'super_admin') OR app_private.has_role(auth.uid(),'marketing'));

-- ---------- order_favorites ----------
CREATE TABLE public.order_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  alias text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, order_id)
);
CREATE INDEX order_favorites_user_idx ON public.order_favorites(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_favorites TO authenticated;
GRANT ALL ON public.order_favorites TO service_role;
ALTER TABLE public.order_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favorites: dueño gestiona" ON public.order_favorites FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- subditos ----------
CREATE TABLE public.subditos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  whatsapp text,
  arquetipo text,
  ciudad text,
  respuestas jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'quiz',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX subditos_email_uidx ON public.subditos(lower(email)) WHERE email IS NOT NULL;
CREATE INDEX subditos_created_idx ON public.subditos(created_at DESC);
GRANT INSERT ON public.subditos TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.subditos TO authenticated;
GRANT ALL ON public.subditos TO service_role;
ALTER TABLE public.subditos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subditos: cualquiera se registra" ON public.subditos FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "subditos: admin ve" ON public.subditos FOR SELECT TO authenticated USING (app_private.has_role(auth.uid(),'super_admin') OR app_private.has_role(auth.uid(),'marketing'));
CREATE POLICY "subditos: admin actualiza" ON public.subditos FOR UPDATE TO authenticated USING (app_private.has_role(auth.uid(),'super_admin') OR app_private.has_role(auth.uid(),'marketing'));

-- ---------- tier helper ----------
CREATE OR REPLACE FUNCTION public.loyalty_calc_tier(lifetime integer)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN lifetime >= 2000 THEN 'coronado'
              WHEN lifetime >= 500  THEN 'rey'
              ELSE 'parcero' END;
$$;

-- ---------- earn on delivered ----------
CREATE OR REPLACE FUNCTION public.loyalty_earn_on_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pts integer;
BEGIN
  IF NEW.status <> 'entregado' THEN RETURN NEW; END IF;
  IF OLD.status = 'entregado' THEN RETURN NEW; END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  pts := GREATEST(0, floor(COALESCE(NEW.total,0) / 10000)::int * 10);
  IF pts = 0 THEN RETURN NEW; END IF;

  INSERT INTO public.loyalty_accounts(user_id) VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.loyalty_ledger(user_id, order_id, tipo, puntos, motivo, meta)
  VALUES (NEW.user_id, NEW.id, 'earn', pts, 'Pedido entregado',
          jsonb_build_object('total', NEW.total, 'rp_pedido_id', NEW.rp_pedido_id))
  ON CONFLICT (order_id) WHERE tipo='earn' AND order_id IS NOT NULL DO NOTHING;

  UPDATE public.loyalty_accounts
     SET puntos_balance = puntos_balance + pts,
         puntos_lifetime = puntos_lifetime + pts,
         tier = public.loyalty_calc_tier(puntos_lifetime + pts),
         updated_at = now()
   WHERE user_id = NEW.user_id;

  RETURN NEW;
END; $$;
CREATE TRIGGER trg_loyalty_earn_on_delivery
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.loyalty_earn_on_delivery();

-- ---------- redeem RPC ----------
CREATE OR REPLACE FUNCTION public.redeem_reward(_reward_id uuid)
RETURNS TABLE(redemption_id uuid, codigo text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  r record;
  acc record;
  new_code text;
  new_id uuid;
  exp timestamptz := now() + interval '30 days';
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión'; END IF;

  SELECT * INTO r FROM public.loyalty_rewards WHERE id=_reward_id AND activo=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recompensa no disponible'; END IF;
  IF r.stock IS NOT NULL AND r.stock <= 0 THEN RAISE EXCEPTION 'Sin stock'; END IF;

  INSERT INTO public.loyalty_accounts(user_id) VALUES (uid) ON CONFLICT DO NOTHING;
  SELECT * INTO acc FROM public.loyalty_accounts WHERE user_id=uid FOR UPDATE;
  IF acc.puntos_balance < r.costo_puntos THEN
    RAISE EXCEPTION 'Puntos insuficientes (tienes %, necesitas %)', acc.puntos_balance, r.costo_puntos;
  END IF;

  new_code := 'KP-' || upper(substring(replace(gen_random_uuid()::text,'-',''),1,8));
  INSERT INTO public.loyalty_redemptions(user_id, reward_id, puntos_gastados, codigo, expires_at)
  VALUES (uid, r.id, r.costo_puntos, new_code, exp)
  RETURNING id INTO new_id;

  UPDATE public.loyalty_accounts SET puntos_balance = puntos_balance - r.costo_puntos, updated_at=now() WHERE user_id=uid;
  IF r.stock IS NOT NULL THEN UPDATE public.loyalty_rewards SET stock = stock - 1 WHERE id=r.id; END IF;

  INSERT INTO public.loyalty_ledger(user_id, tipo, puntos, motivo, meta)
  VALUES (uid, 'redeem', -r.costo_puntos, 'Canje: ' || r.nombre,
          jsonb_build_object('reward_id', r.id, 'codigo', new_code, 'redemption_id', new_id));

  RETURN QUERY SELECT new_id, new_code, exp;
END; $$;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid) TO authenticated;

-- ---------- ensure loyalty_account on profile creation ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cliente')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.loyalty_accounts (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END; $$;

-- Backfill loyalty_accounts para usuarios existentes
INSERT INTO public.loyalty_accounts (user_id)
SELECT id FROM auth.users
ON CONFLICT DO NOTHING;

-- Seed 3 recompensas iniciales
INSERT INTO public.loyalty_rewards (nombre, descripcion, costo_puntos, tipo, valor, orden) VALUES
  ('Envío gratis', 'Domicilio gratis en tu próximo pedido', 100, 'envio_gratis', 0, 1),
  ('$10.000 de descuento', 'Descuento fijo en tu próximo pedido', 200, 'descuento_fijo', 10000, 2),
  ('$25.000 de descuento', 'Descuentazo para la banda coronada', 450, 'descuento_fijo', 25000, 3)
ON CONFLICT DO NOTHING;
