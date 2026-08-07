-- El asiento es la fuente de verdad: solo suma saldo si esta orden ganó puntos por primera vez.
CREATE OR REPLACE FUNCTION public.loyalty_earn_on_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pts integer;
  inserted_ledger_id uuid;
BEGIN
  IF NEW.status <> 'entregado' THEN RETURN NEW; END IF;
  IF OLD.status = 'entregado' THEN RETURN NEW; END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  pts := GREATEST(0, floor(COALESCE(NEW.total, 0) / 10000)::int * 10);
  IF pts = 0 THEN RETURN NEW; END IF;

  INSERT INTO public.loyalty_accounts(user_id) VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.loyalty_ledger(user_id, order_id, tipo, puntos, motivo, meta)
  VALUES (NEW.user_id, NEW.id, 'earn', pts, 'Pedido entregado',
          jsonb_build_object('total', NEW.total, 'rp_pedido_id', NEW.rp_pedido_id))
  ON CONFLICT (order_id) WHERE tipo = 'earn' AND order_id IS NOT NULL DO NOTHING
  RETURNING id INTO inserted_ledger_id;

  IF inserted_ledger_id IS NULL THEN RETURN NEW; END IF;

  UPDATE public.loyalty_accounts
     SET puntos_balance = puntos_balance + pts,
         puntos_lifetime = puntos_lifetime + pts,
         tier = public.loyalty_calc_tier(puntos_lifetime + pts),
         updated_at = now()
   WHERE user_id = NEW.user_id;

  RETURN NEW;
END; $$;

