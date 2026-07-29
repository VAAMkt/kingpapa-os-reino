-- Métricas confiables de pedidos y trazabilidad operativa.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS analytics_excluded_at timestamptz,
  ADD COLUMN IF NOT EXISTS analytics_exclusion_reason text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS preparing_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_analytics_created_at
  ON public.orders (created_at DESC)
  WHERE is_test = false AND analytics_excluded_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_delivered_created_at
  ON public.orders (created_at DESC, sede_id, tipo)
  WHERE status = 'entregado' AND is_test = false AND analytics_excluded_at IS NULL;

CREATE TABLE IF NOT EXISTS public.order_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'system',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_order_status_events_order_time
  ON public.order_status_events (order_id, occurred_at);

ALTER TABLE public.order_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order status events: admins read"
ON public.order_status_events FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'editor'::app_role)
  OR public.has_role(auth.uid(), 'marketing'::app_role)
);

CREATE OR REPLACE FUNCTION public.capture_order_status_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_time timestamptz := now();
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_events (order_id, status, occurred_at, source)
    VALUES (NEW.id, NEW.status, event_time, COALESCE(NEW.source, 'system'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_capture_status_event ON public.orders;
CREATE TRIGGER orders_capture_status_event
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.capture_order_status_event();

CREATE OR REPLACE FUNCTION public.set_order_milestone_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  event_time timestamptz := now();
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'recibido' THEN NEW.received_at := COALESCE(NEW.received_at, event_time);
      WHEN 'en_preparacion' THEN NEW.preparing_at := COALESCE(NEW.preparing_at, event_time);
      WHEN 'en_camino' THEN NEW.dispatched_at := COALESCE(NEW.dispatched_at, event_time);
      WHEN 'entregado' THEN NEW.delivered_at := COALESCE(NEW.delivered_at, event_time);
      ELSE NULL;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_set_milestone_timestamps ON public.orders;
CREATE TRIGGER orders_set_milestone_timestamps
BEFORE INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_order_milestone_timestamps();
