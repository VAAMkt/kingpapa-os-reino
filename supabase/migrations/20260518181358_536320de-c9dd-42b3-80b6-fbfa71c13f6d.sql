ALTER TABLE public.rp_productos
ADD COLUMN IF NOT EXISTS modificadores_raw jsonb NOT NULL DEFAULT '{}'::jsonb;