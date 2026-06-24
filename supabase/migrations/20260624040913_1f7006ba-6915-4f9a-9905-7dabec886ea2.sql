ALTER TABLE public.productos_master
  ADD COLUMN IF NOT EXISTS upsell_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bebida_rec_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS adicion_rec_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS carrito_rec_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS es_alto_margen boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS oculto_en_web boolean DEFAULT false;