
CREATE TABLE public.sedes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nombre text NOT NULL,
  ciudad text NOT NULL,
  direccion text NOT NULL,
  barrio text,
  mall text,
  horario text NOT NULL DEFAULT '12:00pm – 10:00pm',
  abierta_ahora boolean NOT NULL DEFAULT true,
  delivery boolean NOT NULL DEFAULT true,
  pickup boolean NOT NULL DEFAULT true,
  qr_mesa boolean NOT NULL DEFAULT false,
  whatsapp text,
  maps_url text,
  orden integer NOT NULL DEFAULT 0,
  publicado boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sedes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sedes publicadas: lectura pública"
ON public.sedes FOR SELECT
TO public
USING (publicado = true);

CREATE POLICY "Sedes: editores ven todas"
ON public.sedes FOR SELECT
TO authenticated
USING (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Sedes: editores insertan"
ON public.sedes FOR INSERT
TO authenticated
WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Sedes: editores actualizan"
ON public.sedes FOR UPDATE
TO authenticated
USING (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role))
WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Sedes: editores eliminan"
ON public.sedes FOR DELETE
TO authenticated
USING (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

CREATE TRIGGER sedes_set_updated_at
BEFORE UPDATE ON public.sedes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.sedes (slug, nombre, ciudad, direccion, barrio, mall, whatsapp, maps_url, orden) VALUES
('limonar', 'KINGPAPA Limonar', 'Cali', 'Cl. 5a #66-25, Gran Limonar', 'Gran Limonar', NULL, '573172455336', 'https://maps.app.goo.gl/LSF76XHgKXptuEeC8', 10),
('la-flora', 'KINGPAPA La Flora', 'Cali', 'Calle 44N, Av. 3e Nte. #11', 'La Flora', NULL, '573172455336', 'https://maps.app.goo.gl/UQMUoyZnHd4tKpKy5', 20),
('valle-de-lili', 'KINGPAPA Valle de Lili', 'Cali', 'Cra 94A #42-12, Comuna 17', 'Valle de Lili', NULL, '573172455336', 'https://maps.app.goo.gl/1FP1NQxhMhJxJdADA', 30),
('la-floresta', 'KINGPAPA La Floresta', 'Cali', 'Cl. 44 #19-05, Nueva Floresta', 'Nueva Floresta', NULL, '573172455336', 'https://maps.app.goo.gl/Vu5Hww1hbvata31EA', 40),
('cc-unico', 'KINGPAPA C.C. Único', 'Cali', 'Cl. 52 #3-29, Centro Comercial Único 1', NULL, 'C.C. Único', '573172455336', 'https://maps.app.goo.gl/1ZjZ2Z1ixSfV16QN9', 50),
('cc-unicentro', 'KINGPAPA C.C. Unicentro', 'Cali', 'Cra 94A #42-12, Centro Comercial Unicentro', NULL, 'C.C. Unicentro', '573172455336', 'https://maps.app.goo.gl/DFzciNtjUfSVS8DT7', 60),
('granada', 'KINGPAPA Granada', 'Cali', 'Hotel Portón de Granada, Av. 9 Nte. #13-19, 1er piso', 'Granada', NULL, '573172455336', 'https://maps.app.goo.gl/A5xphJwq3vJfb6bf9', 70),
('pance', 'KINGPAPA Pance', 'Cali', 'Cl. 18 #114b-40, Cañasgordas, Pance', 'Pance', NULL, '573172455336', 'https://maps.app.goo.gl/jVw8QCsfB9RyZnnX6', 80),
('jardin-plaza', 'KINGPAPA Jardín Plaza', 'Cali', 'Cra. 98 #16-200, C.C. Jardín Plaza', NULL, 'C.C. Jardín Plaza', '573172455336', 'https://maps.app.goo.gl/1y3xAeWJJLxZuNko6', 90),
('mallplaza-cali', 'KINGPAPA Mallplaza Cali', 'Cali', 'Calle 3 #52-253, Cuarto de Legua, Mallplaza', NULL, 'Mallplaza Cali', '573172455336', 'https://maps.app.goo.gl/5ohaKtWFuigoS4wM6', 100),
('alfaguara-jamundi', 'KINGPAPA C.C. Alfaguara', 'Jamundí', 'Cl. 2 #22-175, C.C. Alfaguara', NULL, 'C.C. Alfaguara', '573027139738', 'https://maps.app.goo.gl/7V8UExiRvZcjW7Xm7', 200),
('modelia-bogota', 'KINGPAPA Modelia', 'Bogotá', 'Cra. 80c #24c-34, Fontibón', 'Modelia / Fontibón', NULL, '573172455336', 'https://maps.app.goo.gl/f9QCJVJpVaDMWEwk9', 300),
('gp-ensueno-bogota', 'KINGPAPA Gran Plaza El Ensueño', 'Bogotá', 'C.C. Gran Plaza El Ensueño, plazoleta de comidas', NULL, 'C.C. Gran Plaza El Ensueño', '573143484983', 'https://share.google/XjA5F1lP9aaLKVRKb', 310),
('eden-bogota', 'KINGPAPA C.C. El Edén', 'Bogotá', 'C.C. El Edén, Local 03-067', NULL, 'C.C. El Edén', NULL, 'https://maps.app.goo.gl/h1HuQtDRdYoQC4MA9', 320),
('mallplaza-nqs-bogota', 'KINGPAPA Mallplaza NQS', 'Bogotá', 'Av. Cra. 30 #19-00, Paloquemao, Los Mártires', NULL, 'Mallplaza NQS', '573172455336', 'https://maps.app.goo.gl/7T2FPX5FTXgeuutv7', 330);
