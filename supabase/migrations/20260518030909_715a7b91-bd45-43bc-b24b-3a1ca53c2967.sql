DROP POLICY IF EXISTS "blog-images: editores suben" ON storage.objects;
DROP POLICY IF EXISTS "blog-images: editores actualizan" ON storage.objects;
DROP POLICY IF EXISTS "blog-images: editores eliminan" ON storage.objects;

CREATE POLICY "blog-images: editores suben"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'blog-images'
  AND (app_private.has_role(auth.uid(), 'super_admin'::app_role)
       OR app_private.has_role(auth.uid(), 'editor'::app_role))
);

CREATE POLICY "blog-images: editores actualizan"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'blog-images'
  AND (app_private.has_role(auth.uid(), 'super_admin'::app_role)
       OR app_private.has_role(auth.uid(), 'editor'::app_role))
);

CREATE POLICY "blog-images: editores eliminan"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'blog-images'
  AND (app_private.has_role(auth.uid(), 'super_admin'::app_role)
       OR app_private.has_role(auth.uid(), 'editor'::app_role))
);