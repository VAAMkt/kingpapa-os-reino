## Objetivo

Permitir editar la foto de cualquier producto desde `/admin/menu` sin que la sincronización con Restaurant.pe la pise. La columna `imagen_url` sigue siendo espejo del POS; se agrega `imagen_override_url` como capa custom del Reino que siempre gana en el frontend.

---

## PASO 1 — Migración Supabase

```sql
ALTER TABLE public.productos_master
  ADD COLUMN IF NOT EXISTS imagen_override_url TEXT,
  ADD COLUMN IF NOT EXISTS imagen_source TEXT NOT NULL DEFAULT 'rp'
    CHECK (imagen_source IN ('rp', 'admin', 'ugc')),
  ADD COLUMN IF NOT EXISTS imagen_updated_at TIMESTAMPTZ;
```

Sin tocar políticas (la tabla ya tiene RLS y grants definidos).

## Storage bucket

Crear bucket público `product-images` con `supabase--storage_create_bucket`. Políticas en `storage.objects`:

- `SELECT` público (anon + authenticated) sobre `bucket_id = 'product-images'`.
- `INSERT/UPDATE/DELETE` sólo si `public.has_role(auth.uid(), 'super_admin')` OR `'editor'` OR `'marketing'` (mismos roles que ya pueden editar menú).

Path convenido: `productos/{producto_id}-{timestamp}.webp` (o `.jpg`/`.png` si la conversión a WebP no fue posible).

---

## PASO 2 — Render frontend (la override siempre gana)

Archivo `src/lib/rp.functions.ts`, función `getMenuForSede`:

1. Añadir `imagen_override_url` al `select` y al tipo `OvrRow.productos_master`.
2. Cambiar el map:
   ```ts
   imagen_url: pm.imagen_override_url ?? pm.imagen_url,
   ```
   (Se mantiene la key `imagen_url` para no tocar `src/lib/menu.ts` ni `ProductCard`. El fallback `/fallback-product.webp` ya lo maneja la UI con `imagen ?? ""`.)

**Sincronización RP intacta:** el upsert en `syncMenuFromRP` (líneas ~122-140) sólo escribe `imagen_url`, nunca toca `imagen_override_url`, así que la sync ya respeta la override por construcción.

---

## PASO 3 — Server function de override

Nueva server fn en `src/lib/rp.functions.ts` (mismo archivo, junto a `updateAdminProducto`):

```ts
export const setProductoImagenOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      imagen_override_url: z.string().url().nullable(), // null = revertir
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch = {
      imagen_override_url: data.imagen_override_url,
      imagen_source: data.imagen_override_url ? "admin" : "rp",
      imagen_updated_at: new Date().toISOString(),
    };
    const { error } = await context.supabase
      .from("productos_master")
      .update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
```

Actualizar `listAdminMenu` para que el select incluya `imagen_override_url, imagen_source, imagen_updated_at`. La función `updateAdminProducto` NO se toca (la imagen tiene su propio endpoint, evita mezclar booleanos con URL larga); el plan original pedía añadir los campos ahí, pero un endpoint dedicado es más limpio y atómico — confirmar si se prefiere lo contrario.

---

## PASO 4 — UI en `/admin/menu`

Tipo `Prod` añade: `imagen_override_url`, `imagen_source`, `imagen_updated_at`.

En `SortableProductRow` (línea ~408), reemplazar la mini-thumb por un botón clickable:

- `displayImagen = prod.imagen_override_url ?? prod.imagen_url`
- Badge encima: `prod.imagen_override_url ? "Custom" : "Restaurant.pe"` (chip pequeño, esquina inferior).
- Click → abre `ProductImageDialog` (componente nuevo).

**Nuevo componente** `src/components/admin/ProductImageDialog.tsx`:

- Usa `Dialog` de shadcn ya disponible.
- Zona drag & drop + `<input type="file" accept="image/jpeg,image/png,image/webp">`.
- Preview inmediato del File seleccionado (object URL).
- Botón **"Guardar foto"**:
  1. `convertToWebp(file)` con `<canvas>` (max 1200px lado largo, quality 0.85). Si falla por CORS/format, sube el archivo original.
  2. `supabase.storage.from("product-images").upload(path, blob, { contentType, upsert: true })` con `path = productos/${prod.id}-${Date.now()}.webp`.
  3. `getPublicUrl(path)` → llama `setProductoImagenOverride({ id, imagen_override_url: url })`.
- Botón **"Revertir a original"** → `setProductoImagenOverride({ id, imagen_override_url: null })`.
- Estados: `idle | uploading | saving | error`. Toasts con `sonner`.

**Optimistic update** vía React Query:
```ts
const imageMut = useMutation({
  mutationFn: (v: { id: string; url: string | null }) =>
    setOverride({ data: { id: v.id, imagen_override_url: v.url } }),
  onMutate: async ({ id, url }) => {
    await queryClient.cancelQueries({ queryKey: ["admin-menu-master"] });
    const prev = queryClient.getQueryData(["admin-menu-master"]);
    queryClient.setQueryData(["admin-menu-master"], (old: any) => ({
      ...old,
      productos: old.productos.map((p: Prod) =>
        p.id === id ? { ...p, imagen_override_url: url, imagen_source: url ? "admin" : "rp" } : p
      ),
    }));
    return { prev };
  },
  onError: (_e, _v, ctx) => ctx && queryClient.setQueryData(["admin-menu-master"], ctx.prev),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu"] }),
});
```

---

## Conversión a WebP (cliente)

Helper local en el dialog:

```ts
async function toWebp(file: File, max = 1200, quality = 0.85): Promise<Blob> {
  const img = await createImageBitmap(file);
  const ratio = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return await new Promise<Blob>((res, rej) =>
    canvas.toBlob(b => b ? res(b) : rej(new Error("webp encode failed")), "image/webp", quality)
  );
}
```

Si `toBlob` retorna null (raro en Safari viejos), fallback: subir el File original con su `contentType`, path con la extensión original.

---

## Archivos a tocar

1. **Migración Supabase** — columnas + bucket + policies storage.
2. `src/lib/rp.functions.ts` — `getMenuForSede` (override en map), `listAdminMenu` (select), nueva `setProductoImagenOverride`.
3. `src/routes/admin.menu.tsx` — tipo `Prod`, thumb clickable + badge, integración del dialog y mutation.
4. `src/components/admin/ProductImageDialog.tsx` — nuevo.
5. *(Sin cambios)* `src/lib/menu.ts`, `ProductCard`, sync RP — la override se inyecta upstream.

## Criterios verificados

- ✅ Sync RP nunca pisa `imagen_override_url` (upsert sólo escribe `imagen_url`).
- ✅ Override gana siempre en frontend (`pm.imagen_override_url ?? pm.imagen_url`).
- ✅ Optimistic update sin recargar.
- ✅ Storage path estable por producto + timestamp (cache busting).
- ✅ Revertir = `NULL` + `source='rp'`.

## Fuera de alcance

- UGC desde clientes finales (el enum lo soporta, pero no hay UI).
- Cropper avanzado / focal point.
- Recalcular `imagen_updated_at` desde sync RP.
