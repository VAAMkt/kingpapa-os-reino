
ALTER TABLE public.categorias_master
  ADD COLUMN IF NOT EXISTS nombre_override text,
  ADD COLUMN IF NOT EXISTS descripcion_override text;

ALTER TABLE public.productos_master
  ADD COLUMN IF NOT EXISTS nombre_override text,
  ADD COLUMN IF NOT EXISTS descripcion_override text,
  ADD COLUMN IF NOT EXISTS destacado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS es_nuevo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS es_mas_vendido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS es_recomendado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS etiqueta_custom text,
  ADD COLUMN IF NOT EXISTS clasificacion_me text CHECK (clasificacion_me IN ('star','plowhorse','puzzle','dog')),
  ADD COLUMN IF NOT EXISTS margen_pct numeric;
