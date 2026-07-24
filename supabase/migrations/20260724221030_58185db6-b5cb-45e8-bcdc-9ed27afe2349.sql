
REVOKE ALL ON FUNCTION public.loyalty_earn_on_delivery() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.loyalty_calc_tier(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.loyalty_calc_tier(integer) TO authenticated;
