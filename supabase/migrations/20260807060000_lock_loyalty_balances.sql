-- Los balances solo cambian por trigger, RPC SECURITY DEFINER o service_role.
-- La política anterior permitía a cada usuario asignarse puntos y tier directamente.
DROP POLICY IF EXISTS "loyalty_accounts: dueño actualiza" ON public.loyalty_accounts;
DROP POLICY IF EXISTS "loyalty_accounts: dueño inserta" ON public.loyalty_accounts;

REVOKE INSERT, UPDATE ON TABLE public.loyalty_accounts FROM authenticated;
