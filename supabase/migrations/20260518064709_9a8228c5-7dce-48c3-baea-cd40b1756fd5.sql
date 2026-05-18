
ALTER TABLE public.sedes
  ADD COLUMN IF NOT EXISTS rp_local_id integer UNIQUE,
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric,
  ADD COLUMN IF NOT EXISTS cobertura_radio_km numeric NOT NULL DEFAULT 5;

CREATE TABLE public.rp_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rp_id integer NOT NULL,
  sede_id uuid NOT NULL REFERENCES public.sedes(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sede_id, rp_id)
);

CREATE TABLE public.rp_productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rp_id integer NOT NULL,
  sede_id uuid NOT NULL REFERENCES public.sedes(id) ON DELETE CASCADE,
  categoria_id uuid REFERENCES public.rp_categorias(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  descripcion text,
  precio numeric NOT NULL DEFAULT 0,
  imagen_url text,
  disponible boolean NOT NULL DEFAULT true,
  modificadores jsonb NOT NULL DEFAULT '[]'::jsonb,
  almacen_id integer,
  stock_cache numeric,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sede_id, rp_id)
);

CREATE INDEX idx_rp_productos_sede ON public.rp_productos(sede_id);
CREATE INDEX idx_rp_productos_categoria ON public.rp_productos(categoria_id);

CREATE TABLE public.rp_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  sede_id uuid REFERENCES public.sedes(id) ON DELETE SET NULL,
  payload jsonb,
  ok boolean NOT NULL DEFAULT true,
  mensaje text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rp_sync_log_created ON public.rp_sync_log(created_at DESC);

ALTER TABLE public.rp_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rp_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rp_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categorías activas: lectura pública"
  ON public.rp_categorias FOR SELECT TO public
  USING (activo = true);

CREATE POLICY "Categorías: editores ven todas"
  ON public.rp_categorias FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Categorías: editores insertan"
  ON public.rp_categorias FOR INSERT TO authenticated
  WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Categorías: editores actualizan"
  ON public.rp_categorias FOR UPDATE TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Categorías: editores eliminan"
  ON public.rp_categorias FOR DELETE TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Productos disponibles: lectura pública"
  ON public.rp_productos FOR SELECT TO public
  USING (disponible = true);

CREATE POLICY "Productos: editores ven todos"
  ON public.rp_productos FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Productos: editores insertan"
  ON public.rp_productos FOR INSERT TO authenticated
  WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Productos: editores actualizan"
  ON public.rp_productos FOR UPDATE TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Productos: editores eliminan"
  ON public.rp_productos FOR DELETE TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Sync log: editores ven"
  ON public.rp_sync_log FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Sync log: editores insertan"
  ON public.rp_sync_log FOR INSERT TO authenticated
  WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

CREATE TRIGGER set_updated_at_rp_categorias
  BEFORE UPDATE ON public.rp_categorias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_rp_productos
  BEFORE UPDATE ON public.rp_productos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
