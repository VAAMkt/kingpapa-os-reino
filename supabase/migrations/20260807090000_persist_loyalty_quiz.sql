ALTER TABLE public.subditos
  ADD COLUMN IF NOT EXISTS habeas_data_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS habeas_data_version text;

WITH duplicates AS (
  SELECT id,
         row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS position
  FROM public.subditos
  WHERE user_id IS NOT NULL
)
UPDATE public.subditos SET user_id = NULL
WHERE id IN (SELECT id FROM duplicates WHERE position > 1);

CREATE UNIQUE INDEX IF NOT EXISTS subditos_user_id_uidx ON public.subditos(user_id);

DROP POLICY IF EXISTS "subditos: cualquiera se registra" ON public.subditos;
REVOKE INSERT ON TABLE public.subditos FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  quiz_clan text;
  quiz_whatsapp text;
  quiz_city text;
  quiz_answers jsonb;
  quiz_accepted boolean;
BEGIN
  quiz_clan := CASE
    WHEN NEW.raw_user_meta_data->>'quiz_clan' IN (
      'Legión de Acero',
      'Tripulación del After',
      'Iluminado de la Fórmula'
    ) THEN NEW.raw_user_meta_data->>'quiz_clan'
    ELSE NULL
  END;
  quiz_whatsapp := regexp_replace(COALESCE(NEW.raw_user_meta_data->>'whatsapp', ''), '\D', '', 'g');
  IF length(quiz_whatsapp) NOT BETWEEN 7 AND 15 THEN quiz_whatsapp := NULL; END IF;
  quiz_city := NULLIF(left(trim(NEW.raw_user_meta_data->>'ciudad'), 80), '');
  quiz_accepted := NEW.raw_user_meta_data->>'habeas_data_accepted' = 'true';
  quiz_answers := jsonb_strip_nulls(jsonb_build_object(
    'hambre', NEW.raw_user_meta_data->'quiz_respuestas'->>'hambre',
    'picante', NEW.raw_user_meta_data->'quiz_respuestas'->>'picante',
    'ocasion', NEW.raw_user_meta_data->'quiz_respuestas'->>'ocasion',
    'presupuesto', NEW.raw_user_meta_data->'quiz_respuestas'->>'presupuesto',
    'ciudad', NEW.raw_user_meta_data->'quiz_respuestas'->>'ciudad',
    'canal', NEW.raw_user_meta_data->'quiz_respuestas'->>'canal'
  ));

  INSERT INTO public.profiles AS profile (id, display_name, whatsapp, ciudad, arquetipo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    quiz_whatsapp,
    quiz_city,
    quiz_clan
  )
  ON CONFLICT (id) DO UPDATE SET
    whatsapp = COALESCE(EXCLUDED.whatsapp, profile.whatsapp),
    ciudad = COALESCE(EXCLUDED.ciudad, profile.ciudad),
    arquetipo = COALESCE(EXCLUDED.arquetipo, profile.arquetipo);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cliente')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.loyalty_accounts (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  IF quiz_clan IS NOT NULL AND quiz_accepted THEN
    UPDATE public.subditos SET
      user_id = NEW.id,
      email = NEW.email,
      whatsapp = quiz_whatsapp,
      arquetipo = quiz_clan,
      ciudad = quiz_city,
      respuestas = quiz_answers,
      habeas_data_accepted_at = now(),
      habeas_data_version = 'PO-CM-15/2024-01-31'
    WHERE user_id = NEW.id
       OR (user_id IS NULL AND lower(email) = lower(NEW.email));

    IF NOT FOUND THEN
      INSERT INTO public.subditos (
        user_id, email, whatsapp, arquetipo, ciudad, respuestas,
        source, habeas_data_accepted_at, habeas_data_version
      ) VALUES (
        NEW.id, NEW.email, quiz_whatsapp, quiz_clan, quiz_city, quiz_answers,
        'quiz', now(), 'PO-CM-15/2024-01-31'
      )
      ON CONFLICT (user_id) DO UPDATE SET
        email = EXCLUDED.email,
        whatsapp = EXCLUDED.whatsapp,
        arquetipo = EXCLUDED.arquetipo,
        ciudad = EXCLUDED.ciudad,
        respuestas = EXCLUDED.respuestas,
        habeas_data_accepted_at = EXCLUDED.habeas_data_accepted_at,
        habeas_data_version = EXCLUDED.habeas_data_version;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
