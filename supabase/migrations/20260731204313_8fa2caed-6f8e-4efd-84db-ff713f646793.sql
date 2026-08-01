ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS analytics_excluded_at timestamptz,
  ADD COLUMN IF NOT EXISTS analytics_exclusion_reason text;