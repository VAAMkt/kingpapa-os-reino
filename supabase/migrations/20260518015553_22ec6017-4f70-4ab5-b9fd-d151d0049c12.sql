-- WARN 1: quitar SELECT amplia sobre storage.objects para el bucket blog-images.
-- El bucket sigue siendo público (acceso por URL) gracias a buckets.public = true,
-- pero ya no se puede listar el contenido vía API.
DROP POLICY IF EXISTS "blog-images: lectura pública" ON storage.objects;

-- WARN 2: revocar EXECUTE de has_role para que solo sea invocable desde dentro
-- de políticas RLS (que corren como el owner de la función, no como el usuario).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;