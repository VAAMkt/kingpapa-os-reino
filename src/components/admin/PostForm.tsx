import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { BrutalCard, BrutalBadge, BrutalInput } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import { cn } from "@/lib/utils";
import {
  CATEGORIAS_HISTORIA,
  createPost,
  slugify,
  updatePost,
  uploadBlogImage,
  type PostRow,
} from "@/lib/posts";
import { toast } from "sonner";

const PostSchema = z.object({
  slug: z.string().min(3).max(120).regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  titulo: z.string().min(3).max(200),
  categoria: z.string().min(1),
  extracto: z.string().max(500).optional().default(""),
  contenido_html: z.string().optional().nullable(),
  imagen_url: z.string().url("Debe ser una URL").or(z.string().startsWith("/")),
  video_url: z.string().url().optional().nullable(),
  link_original: z.string().url().optional().nullable(),
  fecha: z.string().min(8),
  publicado: z.boolean(),
});

type FormState = z.input<typeof PostSchema>;

const emptyState: FormState = {
  slug: "",
  titulo: "",
  categoria: "Cultura interna",
  extracto: "",
  contenido_html: "",
  imagen_url: "",
  video_url: "",
  link_original: "",
  fecha: new Date().toISOString().slice(0, 10),
  publicado: true,
};

const labelCls = "block font-display uppercase text-xs mb-1";
const fieldCls = "space-y-1";
const textareaCls = cn(
  "w-full px-4 py-3 bg-kp-cheese border-2 border-kp-ink shadow-brutal-sm",
  "font-body text-kp-ink placeholder:text-kp-ink/50",
  "focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-none",
);

export function PostForm({ initial }: { initial?: PostRow }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const editing = !!initial;

  const [form, setForm] = useState<FormState>(
    initial
      ? {
          slug: initial.slug,
          titulo: initial.titulo,
          categoria: initial.categoria,
          extracto: initial.extracto ?? "",
          contenido_html: initial.contenido_html ?? "",
          imagen_url: initial.imagen_url,
          video_url: initial.video_url ?? "",
          link_original: initial.link_original ?? "",
          fecha: initial.fecha,
          publicado: initial.publicado,
        }
      : emptyState,
  );
  const [slugTouched, setSlugTouched] = useState(editing);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!slugTouched) {
      setForm((f) => ({ ...f, slug: slugify(f.titulo) }));
    }
  }, [form.titulo, slugTouched]);

  const upsert = useMutation({
    mutationFn: async () => {
      const cleaned = {
        ...form,
        extracto: form.extracto ?? "",
        contenido_html: form.contenido_html || null,
        video_url: form.video_url || null,
        link_original: form.link_original || null,
      };
      const parsed = PostSchema.safeParse(cleaned);
      if (!parsed.success) {
        const map: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          map[issue.path.join(".")] = issue.message;
        }
        setErrors(map);
        throw new Error("Revisa los campos marcados");
      }
      setErrors({});
      if (editing && initial) {
        return updatePost(initial.id, parsed.data);
      }
      return createPost(parsed.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success(editing ? "Historia actualizada" : "Historia creada");
      navigate({ to: "/admin/contenidos" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadBlogImage(file);
      setForm((f) => ({ ...f, imagen_url: url }));
      toast.success("Imagen subida");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        upsert.mutate();
      }}
      className="space-y-5"
    >
      <BrutalCard tone="cheese" className="p-5 space-y-4">
        <div className={fieldCls}>
          <label className={labelCls}>Título</label>
          <BrutalInput
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            required
          />
          {errors.titulo && <p className="text-xs text-kp-red">{errors.titulo}</p>}
        </div>

        <div className={fieldCls}>
          <label className={labelCls}>Slug</label>
          <BrutalInput
            value={form.slug}
            onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: e.target.value }); }}
            placeholder="se-genera-automatico"
          />
          {errors.slug && <p className="text-xs text-kp-red">{errors.slug}</p>}
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div className={fieldCls}>
            <label className={labelCls}>Categoría</label>
            <select
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              className={cn(textareaCls, "py-3")}
            >
              {CATEGORIAS_HISTORIA.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Fecha</label>
            <BrutalInput
              type="date"
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Estado</label>
            <label className="flex items-center gap-2 h-[50px] px-3 border-2 border-kp-ink bg-kp-cheese shadow-brutal-sm">
              <input
                type="checkbox"
                checked={form.publicado}
                onChange={(e) => setForm({ ...form, publicado: e.target.checked })}
              />
              <span className="font-display uppercase text-xs">Publicado</span>
              {form.publicado ? <BrutalBadge tone="lime">on</BrutalBadge> : <BrutalBadge tone="black">borrador</BrutalBadge>}
            </label>
          </div>
        </div>

        <div className={fieldCls}>
          <label className={labelCls}>Extracto</label>
          <textarea
            rows={3}
            value={form.extracto}
            onChange={(e) => setForm({ ...form, extracto: e.target.value })}
            className={textareaCls}
            maxLength={500}
          />
          {errors.extracto && <p className="text-xs text-kp-red">{errors.extracto}</p>}
        </div>
      </BrutalCard>

      <BrutalCard tone="cheese" className="p-5 space-y-3">
        <h3 className="font-display uppercase text-lg">Portada</h3>
        <div className={fieldCls}>
          <label className={labelCls}>URL de la imagen</label>
          <BrutalInput
            value={form.imagen_url}
            onChange={(e) => setForm({ ...form, imagen_url: e.target.value })}
            placeholder="/blog-covers/mi-historia.jpg o https://…"
          />
          {errors.imagen_url && <p className="text-xs text-kp-red">{errors.imagen_url}</p>}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
            className="text-xs"
          />
          {uploading && <span className="text-xs">Subiendo…</span>}
        </div>
        {form.imagen_url && (
          <div className="border-2 border-kp-ink max-w-xs">
            <img src={form.imagen_url} alt="" className="w-full h-auto" />
          </div>
        )}
      </BrutalCard>

      <BrutalCard tone="cheese" className="p-5 space-y-3">
        <h3 className="font-display uppercase text-lg">Contenido HTML</h3>
        <textarea
          rows={18}
          value={form.contenido_html ?? ""}
          onChange={(e) => setForm({ ...form, contenido_html: e.target.value })}
          className={cn(textareaCls, "font-mono text-xs")}
          placeholder="<p>Cuerpo del post en HTML…</p>"
        />
      </BrutalCard>

      <BrutalCard tone="cheese" className="p-5 grid md:grid-cols-2 gap-4">
        <div className={fieldCls}>
          <label className={labelCls}>Video URL (opcional)</label>
          <BrutalInput
            value={form.video_url ?? ""}
            onChange={(e) => setForm({ ...form, video_url: e.target.value })}
            placeholder="https://youtube.com/…"
          />
        </div>
        <div className={fieldCls}>
          <label className={labelCls}>Link original (opcional)</label>
          <BrutalInput
            value={form.link_original ?? ""}
            onChange={(e) => setForm({ ...form, link_original: e.target.value })}
            placeholder="https://kingpapacali.com/…"
          />
        </div>
      </BrutalCard>

      <div className="flex items-center gap-3">
        <BrutalButton type="submit" variant="primary" disabled={upsert.isPending}>
          {upsert.isPending ? "Guardando…" : editing ? "Guardar cambios" : "Crear historia"}
        </BrutalButton>
        <BrutalButton type="button" variant="ghost" onClick={() => navigate({ to: "/admin/contenidos" })}>
          Cancelar
        </BrutalButton>
      </div>
    </form>
  );
}
