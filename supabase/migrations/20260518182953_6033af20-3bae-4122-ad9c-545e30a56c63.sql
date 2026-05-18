
-- =========================================
-- FASE 3: Catálogo Maestro Global
-- =========================================

-- 1) Categorías maestras
CREATE TABLE public.categorias_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rp_id integer NOT NULL UNIQUE,
  nombre text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categorias_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cats master activas: lectura pública"
ON public.categorias_master FOR SELECT TO public
USING (activo = true);

CREATE POLICY "Cats master: editores ven todas"
ON public.categorias_master FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Cats master: editores insertan"
ON public.categorias_master FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Cats master: editores actualizan"
ON public.categorias_master FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Cats master: editores eliminan"
ON public.categorias_master FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE TRIGGER trg_categorias_master_updated_at
BEFORE UPDATE ON public.categorias_master
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Productos maestros
CREATE TABLE public.productos_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rp_id integer NOT NULL UNIQUE,
  categoria_id uuid REFERENCES public.categorias_master(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  descripcion text,
  precio numeric NOT NULL DEFAULT 0,
  imagen_url text,
  disponible boolean NOT NULL DEFAULT true,
  modificadores jsonb NOT NULL DEFAULT '[]'::jsonb,
  modificadores_raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  almacen_id integer,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_productos_master_categoria ON public.productos_master(categoria_id);
ALTER TABLE public.productos_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prods master disponibles: lectura pública"
ON public.productos_master FOR SELECT TO public
USING (disponible = true);

CREATE POLICY "Prods master: editores ven todos"
ON public.productos_master FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Prods master: editores insertan"
ON public.productos_master FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Prods master: editores actualizan"
ON public.productos_master FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Prods master: editores eliminan"
ON public.productos_master FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE TRIGGER trg_productos_master_updated_at
BEFORE UPDATE ON public.productos_master
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Overrides por sede
CREATE TABLE public.sede_producto_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id uuid NOT NULL REFERENCES public.sedes(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES public.productos_master(id) ON DELETE CASCADE,
  disponible boolean NOT NULL DEFAULT true,
  precio_override numeric,
  stock_cache numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sede_id, producto_id)
);

CREATE INDEX idx_overrides_sede ON public.sede_producto_overrides(sede_id);
CREATE INDEX idx_overrides_producto ON public.sede_producto_overrides(producto_id);
ALTER TABLE public.sede_producto_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Overrides: lectura pública si sede publicada"
ON public.sede_producto_overrides FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1 FROM public.sedes s
    WHERE s.id = sede_producto_overrides.sede_id AND s.publicado = true
  )
);

CREATE POLICY "Overrides: editores ven todos"
ON public.sede_producto_overrides FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Overrides: editores insertan"
ON public.sede_producto_overrides FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Overrides: editores actualizan"
ON public.sede_producto_overrides FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Overrides: editores eliminan"
ON public.sede_producto_overrides FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE TRIGGER trg_overrides_updated_at
BEFORE UPDATE ON public.sede_producto_overrides
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- BACKFILL: rp_categorias / rp_productos -> maestras + overrides
-- =========================================

-- Categorías maestras: una fila por rp_id (de cualquier sede)
INSERT INTO public.categorias_master (rp_id, nombre, orden, activo)
SELECT DISTINCT ON (rp_id)
  rp_id,
  nombre,
  orden,
  activo
FROM public.rp_categorias
ORDER BY rp_id, updated_at DESC;

-- Productos maestros: una fila por rp_id
INSERT INTO public.productos_master (
  rp_id, categoria_id, nombre, descripcion, precio,
  imagen_url, disponible, modificadores, modificadores_raw,
  almacen_id, orden
)
SELECT DISTINCT ON (p.rp_id)
  p.rp_id,
  cm.id AS categoria_id,
  p.nombre,
  p.descripcion,
  p.precio,
  p.imagen_url,
  p.disponible,
  p.modificadores,
  p.modificadores_raw,
  p.almacen_id,
  p.orden
FROM public.rp_productos p
LEFT JOIN public.rp_categorias c ON c.id = p.categoria_id
LEFT JOIN public.categorias_master cm ON cm.rp_id = c.rp_id
ORDER BY p.rp_id, p.updated_at DESC;

-- Overrides: por cada (sede, producto) existente en rp_productos
INSERT INTO public.sede_producto_overrides (sede_id, producto_id, disponible, stock_cache)
SELECT
  p.sede_id,
  pm.id AS producto_id,
  p.disponible,
  p.stock_cache
FROM public.rp_productos p
JOIN public.productos_master pm ON pm.rp_id = p.rp_id
ON CONFLICT (sede_id, producto_id) DO NOTHING;

-- =========================================
-- DROP tablas viejas (todo migrado)
-- =========================================
DROP TABLE public.rp_productos;
DROP TABLE public.rp_categorias;
