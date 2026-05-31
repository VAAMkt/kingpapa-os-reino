
-- =========================================================================
-- FASE 3a — Horarios y banderas en sedes
-- =========================================================================
ALTER TABLE public.sedes
  ADD COLUMN IF NOT EXISTS horarios jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tz text NOT NULL DEFAULT 'America/Bogota',
  ADD COLUMN IF NOT EXISTS kill_switch boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rp_local_estado smallint,
  ADD COLUMN IF NOT EXISTS rp_acepta_delivery smallint;

-- Seed: 12:00-22:00 todos los días para las sedes que aún no tienen horario configurado.
UPDATE public.sedes
SET horarios = jsonb_build_object(
  'lun', jsonb_build_array(jsonb_build_object('abre','12:00','cierra','22:00')),
  'mar', jsonb_build_array(jsonb_build_object('abre','12:00','cierra','22:00')),
  'mie', jsonb_build_array(jsonb_build_object('abre','12:00','cierra','22:00')),
  'jue', jsonb_build_array(jsonb_build_object('abre','12:00','cierra','22:00')),
  'vie', jsonb_build_array(jsonb_build_object('abre','12:00','cierra','22:00')),
  'sab', jsonb_build_array(jsonb_build_object('abre','12:00','cierra','22:00')),
  'dom', jsonb_build_array(jsonb_build_object('abre','12:00','cierra','22:00'))
)
WHERE horarios = '{}'::jsonb OR horarios IS NULL;

-- =========================================================================
-- FASE 4a — orders.status: CHECK + Realtime + RLS para tracker
-- =========================================================================

-- Normalizar valores legacy antes del CHECK.
UPDATE public.orders SET status = 'enviado' WHERE status NOT IN
  ('enviado','recibido','en_preparacion','en_camino','entregado','cancelado','error');

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('enviado','recibido','en_preparacion','en_camino','entregado','cancelado','error'));

-- Realtime
ALTER TABLE public.orders REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.orders';
  END IF;
END $$;

-- Lectura pública por ID con ventana de 24h (para tracker de invitados).
GRANT SELECT ON public.orders TO anon;

DROP POLICY IF EXISTS "Orders: lectura por id reciente" ON public.orders;
CREATE POLICY "Orders: lectura por id reciente"
  ON public.orders FOR SELECT
  TO anon, authenticated
  USING (created_at > now() - interval '24 hours');

-- UPDATE para editores (admin podrá cambiar status manualmente).
DROP POLICY IF EXISTS "Orders: editores actualizan" ON public.orders;
CREATE POLICY "Orders: editores actualizan"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));
