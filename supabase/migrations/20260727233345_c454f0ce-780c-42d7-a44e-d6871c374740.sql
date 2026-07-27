ALTER TABLE public.sedes
  ADD COLUMN IF NOT EXISTS delivery_base_fee numeric,
  ADD COLUMN IF NOT EXISTS delivery_base_distance_km numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS delivery_extra_km_fee numeric NOT NULL DEFAULT 1200,
  ADD COLUMN IF NOT EXISTS delivery_max_distance_km numeric;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_distance_km numeric;

UPDATE public.sedes
   SET delivery_base_fee = 5000
 WHERE delivery_base_fee IS NULL
   AND lower(ciudad) IN ('cali','jamundi','jamundí');

UPDATE public.sedes
   SET delivery_base_fee = 7000
 WHERE delivery_base_fee IS NULL
   AND lower(ciudad) = 'bogotá' OR lower(ciudad) = 'bogota';