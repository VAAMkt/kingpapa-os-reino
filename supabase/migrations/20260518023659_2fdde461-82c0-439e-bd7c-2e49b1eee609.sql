CREATE SCHEMA IF NOT EXISTS app_private;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;

DROP POLICY IF EXISTS "Profiles: super_admin ve todos" ON public.profiles;
CREATE POLICY "Profiles: super_admin ve todos"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Profiles: super_admin actualiza todos" ON public.profiles;
CREATE POLICY "Profiles: super_admin actualiza todos"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Roles: super_admin ve todos" ON public.user_roles;
CREATE POLICY "Roles: super_admin ve todos"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Roles: super_admin inserta" ON public.user_roles;
CREATE POLICY "Roles: super_admin inserta"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Roles: super_admin elimina" ON public.user_roles;
CREATE POLICY "Roles: super_admin elimina"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Posts: editores ven todos" ON public.posts;
CREATE POLICY "Posts: editores ven todos"
  ON public.posts FOR SELECT
  TO authenticated
  USING (
    app_private.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR app_private.has_role(auth.uid(), 'editor'::public.app_role)
  );

DROP POLICY IF EXISTS "Posts: editores insertan" ON public.posts;
CREATE POLICY "Posts: editores insertan"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (
    app_private.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR app_private.has_role(auth.uid(), 'editor'::public.app_role)
  );

DROP POLICY IF EXISTS "Posts: editores actualizan" ON public.posts;
CREATE POLICY "Posts: editores actualizan"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (
    app_private.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR app_private.has_role(auth.uid(), 'editor'::public.app_role)
  )
  WITH CHECK (
    app_private.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR app_private.has_role(auth.uid(), 'editor'::public.app_role)
  );

DROP POLICY IF EXISTS "Posts: editores eliminan" ON public.posts;
CREATE POLICY "Posts: editores eliminan"
  ON public.posts FOR DELETE
  TO authenticated
  USING (
    app_private.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR app_private.has_role(auth.uid(), 'editor'::public.app_role)
  );