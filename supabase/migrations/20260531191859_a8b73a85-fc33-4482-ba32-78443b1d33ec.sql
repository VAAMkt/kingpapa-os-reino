ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rp_numero_comanda text;