UPDATE public.productos_master
SET imagen_url = regexp_replace(imagen_url, '^https?://(www\.)?restaurant\.pe/archivos/', 'https://img.restpe.com/')
WHERE imagen_url ~* '^https?://(www\.)?restaurant\.pe/archivos/';

UPDATE public.productos_master
SET imagen_url = regexp_replace(imagen_url, '^https?://api\.restaurant\.pe/archivos/', 'https://img.restpe.com/')
WHERE imagen_url ~* '^https?://api\.restaurant\.pe/archivos/';