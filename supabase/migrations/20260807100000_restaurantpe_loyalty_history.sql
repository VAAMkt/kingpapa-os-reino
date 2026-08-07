-- Historial directo de Restaurant.pe, aislado de orders para no contaminar tracking/analítica.
CREATE TABLE public.loyalty_rp_orders (
  delivery_id text PRIMARY KEY,
  local_id integer NOT NULL,
  customer_phone text,
  customer_email text,
  total numeric NOT NULL DEFAULT 0 CHECK (total >= 0),
  delivered_at timestamptz,
  channel_id integer NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX loyalty_rp_orders_phone_idx
  ON public.loyalty_rp_orders(customer_phone)
  WHERE customer_phone IS NOT NULL AND user_id IS NULL;
CREATE INDEX loyalty_rp_orders_email_idx
  ON public.loyalty_rp_orders(customer_email)
  WHERE customer_email IS NOT NULL AND user_id IS NULL;
CREATE INDEX loyalty_rp_orders_user_idx
  ON public.loyalty_rp_orders(user_id, delivered_at DESC)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.loyalty_rp_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.loyalty_rp_orders FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.loyalty_rp_orders TO service_role;

CREATE TABLE public.loyalty_rp_sync_state (
  local_id integer PRIMARY KEY,
  next_page integer NOT NULL DEFAULT 1 CHECK (next_page > 0),
  backfill_complete boolean NOT NULL DEFAULT false,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_rp_sync_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.loyalty_rp_sync_state FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.loyalty_rp_sync_state TO service_role;

-- Idempotencia también para asientos históricos, que no tienen orders.id local.
CREATE UNIQUE INDEX loyalty_ledger_rp_delivery_earn
  ON public.loyalty_ledger ((meta->>'rp_delivery_id'))
  WHERE tipo = 'earn'
    AND order_id IS NULL
    AND meta->>'source' = 'restaurantpe_history';

CREATE UNIQUE INDEX orders_rp_pedido_id_unique
  ON public.orders(rp_pedido_id)
  WHERE rp_pedido_id IS NOT NULL AND trim(rp_pedido_id) <> '';

CREATE OR REPLACE FUNCTION public.claim_restaurantpe_loyalty(
  _user_id uuid,
  _phone text,
  _email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_phone text := right(regexp_replace(coalesce(_phone, ''), '\D', '', 'g'), 10);
  normalized_email text := lower(trim(coalesce(_email, '')));
  phone_is_unique boolean := false;
  email_belongs_to_user boolean := false;
  claimed_count integer := 0;
  local_claimed_count integer := 0;
  added_points integer := 0;
BEGIN
  IF _user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'invalid_user';
  END IF;

  IF length(normalized_phone) = 10 THEN
    SELECT count(*) = 1 AND bool_or(id = _user_id)
      INTO phone_is_unique
      FROM public.profiles
     WHERE right(regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g'), 10) = normalized_phone;
  END IF;

  IF normalized_email <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM auth.users
       WHERE id = _user_id AND lower(email) = normalized_email
    ) INTO email_belongs_to_user;
  END IF;

  UPDATE public.loyalty_rp_orders
     SET user_id = _user_id, updated_at = now()
   WHERE user_id IS NULL
     AND (
       (phone_is_unique AND customer_phone = normalized_phone)
       OR (email_belongs_to_user AND customer_email = normalized_email)
     );
  GET DIAGNOSTICS claimed_count = ROW_COUNT;

  UPDATE public.orders
     SET user_id = _user_id
   WHERE user_id IS NULL
     AND status = 'entregado'
     AND is_test = false
     AND analytics_excluded_at IS NULL
     AND (
       (
         phone_is_unique
         AND right(regexp_replace(coalesce(cliente->>'telefono', ''), '\D', '', 'g'), 10)
             = normalized_phone
       )
       OR (
         email_belongs_to_user
         AND lower(trim(coalesce(cliente->>'email', ''))) = normalized_email
       )
     );
  GET DIAGNOSTICS local_claimed_count = ROW_COUNT;

  INSERT INTO public.loyalty_accounts(user_id)
  VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  WITH inserted AS (
    INSERT INTO public.loyalty_ledger(user_id, order_id, tipo, puntos, motivo, meta)
    SELECT candidate.user_id,
           candidate.order_id,
           'earn',
           candidate.puntos,
           candidate.motivo,
           candidate.meta
      FROM (
        SELECT _user_id AS user_id,
               o.id AS order_id,
               floor(o.total / 10000)::integer * 10 AS puntos,
               'Pedido entregado'::text AS motivo,
               jsonb_build_object('total', o.total, 'rp_pedido_id', o.rp_pedido_id) AS meta
          FROM public.orders o
         WHERE o.user_id = _user_id
           AND o.status = 'entregado'
           AND o.is_test = false
           AND o.analytics_excluded_at IS NULL
        UNION ALL
        SELECT _user_id,
               NULL::uuid,
               floor(h.total / 10000)::integer * 10,
               'Compra directa histórica',
               jsonb_build_object(
                 'source', 'restaurantpe_history',
                 'rp_delivery_id', h.delivery_id,
                 'total', h.total,
                 'local_id', h.local_id
               )
          FROM public.loyalty_rp_orders h
         WHERE h.user_id = _user_id
      ) candidate
     WHERE candidate.puntos > 0
    ON CONFLICT DO NOTHING
    RETURNING puntos
  )
  SELECT coalesce(sum(puntos), 0)::integer INTO added_points FROM inserted;

  IF added_points > 0 THEN
    UPDATE public.loyalty_accounts
       SET puntos_balance = puntos_balance + added_points,
           puntos_lifetime = puntos_lifetime + added_points,
           tier = public.loyalty_calc_tier(puntos_lifetime + added_points),
           updated_at = now()
     WHERE user_id = _user_id;
  END IF;

  RETURN jsonb_build_object(
    'claimed_orders', claimed_count + local_claimed_count,
    'added_points', added_points
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_restaurantpe_loyalty(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_restaurantpe_loyalty(uuid, text, text)
  TO service_role;
