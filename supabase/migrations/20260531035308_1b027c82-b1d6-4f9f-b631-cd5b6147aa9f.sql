
-- 1. Standardize policies to use app_private.has_role (drop public.has_role afterwards)

-- categorias_master
DROP POLICY IF EXISTS "Cats master: editores ven todas" ON public.categorias_master;
DROP POLICY IF EXISTS "Cats master: editores insertan" ON public.categorias_master;
DROP POLICY IF EXISTS "Cats master: editores actualizan" ON public.categorias_master;
DROP POLICY IF EXISTS "Cats master: editores eliminan" ON public.categorias_master;

CREATE POLICY "Cats master: editores ven todas" ON public.categorias_master
FOR SELECT TO authenticated
USING (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Cats master: editores insertan" ON public.categorias_master
FOR INSERT TO authenticated
WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Cats master: editores actualizan" ON public.categorias_master
FOR UPDATE TO authenticated
USING (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role))
WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Cats master: editores eliminan" ON public.categorias_master
FOR DELETE TO authenticated
USING (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

-- productos_master
DROP POLICY IF EXISTS "Prods master: editores ven todos" ON public.productos_master;
DROP POLICY IF EXISTS "Prods master: editores insertan" ON public.productos_master;
DROP POLICY IF EXISTS "Prods master: editores actualizan" ON public.productos_master;
DROP POLICY IF EXISTS "Prods master: editores eliminan" ON public.productos_master;

CREATE POLICY "Prods master: editores ven todos" ON public.productos_master
FOR SELECT TO authenticated
USING (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Prods master: editores insertan" ON public.productos_master
FOR INSERT TO authenticated
WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Prods master: editores actualizan" ON public.productos_master
FOR UPDATE TO authenticated
USING (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role))
WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Prods master: editores eliminan" ON public.productos_master
FOR DELETE TO authenticated
USING (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

-- sede_producto_overrides
DROP POLICY IF EXISTS "Overrides: editores ven todos" ON public.sede_producto_overrides;
DROP POLICY IF EXISTS "Overrides: editores insertan" ON public.sede_producto_overrides;
DROP POLICY IF EXISTS "Overrides: editores actualizan" ON public.sede_producto_overrides;
DROP POLICY IF EXISTS "Overrides: editores eliminan" ON public.sede_producto_overrides;

CREATE POLICY "Overrides: editores ven todos" ON public.sede_producto_overrides
FOR SELECT TO authenticated
USING (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Overrides: editores insertan" ON public.sede_producto_overrides
FOR INSERT TO authenticated
WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Overrides: editores actualizan" ON public.sede_producto_overrides
FOR UPDATE TO authenticated
USING (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role))
WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Overrides: editores eliminan" ON public.sede_producto_overrides
FOR DELETE TO authenticated
USING (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

-- orders: same standardization for editor SELECT
DROP POLICY IF EXISTS "Orders: editores ven todos" ON public.orders;
CREATE POLICY "Orders: editores ven todos" ON public.orders
FOR SELECT TO authenticated
USING (app_private.has_role(auth.uid(), 'super_admin'::app_role) OR app_private.has_role(auth.uid(), 'editor'::app_role));

-- 2. Drop public.has_role (was SECURITY DEFINER with broad EXECUTE)
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);

-- 3. Orders: explicit INSERT policies (client path is blocked; service role bypasses RLS for server-side submitCheckoutOrder)
CREATE POLICY "Orders: usuario crea los suyos" ON public.orders
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 4. Profiles: explicit INSERT policy (creation normally happens via handle_new_user trigger; this policy lets a user backfill their own row safely)
CREATE POLICY "Profiles: usuario crea el suyo" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- 5. Lock down handle_new_user EXECUTE (only the auth trigger needs it; runs as definer)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
