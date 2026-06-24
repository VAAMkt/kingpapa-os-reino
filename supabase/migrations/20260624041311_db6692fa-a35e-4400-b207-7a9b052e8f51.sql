ALTER TABLE public.categorias_master
  ADD COLUMN IF NOT EXISTS slug text GENERATED ALWAYS AS (
    regexp_replace(
      regexp_replace(
        lower(
          translate(nombre,
            'áéíóúàèìòùäëïöüñÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÑ',
            'aeiouaeiouaeiounAEIOUAEIOUAEIOUN'
          )
        ),
        '[^a-z0-9\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    )
  ) STORED;