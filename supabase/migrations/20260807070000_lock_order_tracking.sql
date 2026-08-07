-- El tracker invitado usa el UUID de la orden como capacidad y devuelve solo campos seguros.
-- La política anterior permitía listar todas las órdenes recientes, con cliente y dirección.
DROP POLICY IF EXISTS "Orders: lectura por id reciente" ON public.orders;
REVOKE SELECT ON TABLE public.orders FROM anon;

-- El checkout oficial inserta con service_role; no se aceptan órdenes directas del cliente.
DROP POLICY IF EXISTS "Orders: usuario crea los suyos" ON public.orders;
REVOKE INSERT ON TABLE public.orders FROM authenticated;
