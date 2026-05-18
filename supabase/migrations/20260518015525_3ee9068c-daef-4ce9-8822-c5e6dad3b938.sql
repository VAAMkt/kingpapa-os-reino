-- Tabla posts (historias)
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  titulo text NOT NULL,
  categoria text NOT NULL,
  extracto text NOT NULL DEFAULT '',
  contenido_html text,
  imagen_url text NOT NULL,
  video_url text,
  link_original text,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  publicado boolean NOT NULL DEFAULT true,
  autor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX posts_publicado_fecha_idx ON public.posts (publicado, fecha DESC);
CREATE INDEX posts_slug_idx ON public.posts (slug);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Lectura pública SOLO de publicados
CREATE POLICY "Posts publicados: lectura pública"
  ON public.posts FOR SELECT
  USING (publicado = true);

-- Editores y super_admin ven todo
CREATE POLICY "Posts: editores ven todos"
  ON public.posts FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'editor'::app_role)
  );

CREATE POLICY "Posts: editores insertan"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'editor'::app_role)
  );

CREATE POLICY "Posts: editores actualizan"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'editor'::app_role)
  );

CREATE POLICY "Posts: editores eliminan"
  ON public.posts FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'editor'::app_role)
  );

-- Trigger updated_at (función ya existe)
CREATE TRIGGER posts_set_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Bucket público para imágenes del blog
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública del bucket (objetos)
CREATE POLICY "blog-images: lectura pública"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'blog-images');

-- Editores suben/actualizan/eliminan
CREATE POLICY "blog-images: editores suben"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'blog-images'
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'editor'::app_role)
    )
  );

CREATE POLICY "blog-images: editores actualizan"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'blog-images'
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'editor'::app_role)
    )
  );

CREATE POLICY "blog-images: editores eliminan"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'blog-images'
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'editor'::app_role)
    )
  );