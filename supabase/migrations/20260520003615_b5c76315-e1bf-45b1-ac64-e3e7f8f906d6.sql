
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NULL,
  sede_id uuid NOT NULL REFERENCES public.sedes(id) ON DELETE RESTRICT,
  rp_pedido_id text NULL,
  rp_payload jsonb NOT NULL,
  rp_response jsonb NULL,
  status text NOT NULL DEFAULT 'enviado',
  tipo text NOT NULL,
  pago text NOT NULL,
  cliente jsonb NOT NULL,
  items jsonb NOT NULL,
  subtotal numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notas text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_sede_id ON public.orders(sede_id);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Orders: dueño ve los suyos"
ON public.orders FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Orders: editores ven todos"
ON public.orders FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'editor'::app_role)
);

CREATE TRIGGER orders_set_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
