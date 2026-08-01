ALTER TABLE public.sedes
  ADD COLUMN IF NOT EXISTS google_rating numeric(2,1),
  ADD COLUMN IF NOT EXISTS google_reviews_count integer;

ALTER TABLE public.sedes
  ADD CONSTRAINT sedes_google_rating_range CHECK (google_rating IS NULL OR (google_rating >= 0 AND google_rating <= 5)),
  ADD CONSTRAINT sedes_google_reviews_count_nonneg CHECK (google_reviews_count IS NULL OR google_reviews_count >= 0);