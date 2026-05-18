import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { RichEditor } from "./RichEditor";
import { autoExcerpt, readingTimeMin, sanitizeLegacyHtml } from "@/lib/sanitize-html";
import { generateExcerpt, suggestSeoTitle } from "@/lib/ai.functions";
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
const inputBaseCls = cn(
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
          contenido_html: sanitizeLegacyHtml(initial.contenido_html ?? ""),
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
  const [showHtml, setShowHtml] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const generateExcerptFn = useServerFn(generateExcerpt);
  const suggestSeoTitleFn = useServerFn(suggestSeoTitle);
  const [aiBusy, setAiBusy] = useState<null | "excerpt" | "title">(null);

  useEffect(() => {
    if (!slugTouched) {
      setForm((f) => ({ ...f, slug: slugify(f.titulo) }));
    }
  }, [form.titulo, slugTouched]);

  const readingMin = useMemo(() => readingTimeMin(form.contenido_html ?? ""), [form.contenido_html]);

  const upsert = useMutation({
    mutationFn: async () => {
      const finalExcerpt = (form.extracto?.trim() || autoExcerpt(form.contenido_html ?? "", 155)).slice(0, 500);
      const cleaned = {
        ...form,
        extracto: finalExcerpt,
        contenido_html: form.contenido_html || null,
        video_url: form.video_url || null,
        link_original: form.link_original || null,
      };
      const parsed = PostSchema.safeParse(cleaned);
      if (!parsed.success) {
        const map: Record<string, string> = {};
        for (const issue of parsed.error.issues) map[issue.path.join(".")] = issue.message;
        setErrors(map);
        throw new Error("Revisa los campos marcados");
      }
      setErrors({});
      if (editing && initial) return updatePost(initial.id, parsed.data);
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

  async function handleGenerateExcerpt() {
    if (!form.titulo || !(form.contenido_html ?? "").trim()) {
      toast.error("Necesitas título y contenido primero");
      return;
    }
    setAiBusy("excerpt");
    try {
      const { text } = await generateExcerptFn({
        data: { titulo: form.titulo, contenido: form.contenido_html ?? "" },
      });
      setForm((f) => ({ ...f, extracto: text }));
      toast.success("Extracto generado por IA");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAiBusy(null);
    }
  }

  function handleAutoExcerpt() {
    const text = autoExcerpt(form.contenido_html ?? "", 155);
    if (!text) { toast.error("Escribe contenido primero"); return; }
    setForm((f) => ({ ...f, extracto: text }));
  }

  async function handleSuggestTitle() {
    if (!form.titulo) { toast.error("Escribe un título base"); return; }
    setAiBusy("title");
    try {
      const { text } = await suggestSeoTitleFn({
        data: { titulo: form.titulo, contenido: form.contenido_html ?? "" },
      });
      setForm((f) => ({ ...f, titulo: text }));
      toast.success("Título optimizado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAiBusy(null);
    }
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); upsert.mutate(); }}
      className="space-y-5"
    >
      <BrutalCard tone="cheese" className="p-5 space-y-4">
        <div className={fieldCls}>
          <div className="flex items-center justify-between gap-2">
            <label className={labelCls}>Título</label>
            <button
              type="button"
              onClick={handleSuggestTitle}
              disabled={aiBusy === "title"}
              className="text-[10px] font-display uppercase underline disabled:opacity-50"
            >
              {aiBusy === "title" ? "Pensando…" : "✨ Sugerir título SEO"}
            </button>
          </div>
          <BrutalInput
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            required
          />
          <div className="text-[10px] font-mono text-kp-ink/60">
            {form.titulo.length} / 60 chars · ⏱ {readingMin} min de lectura
          </div>
          {errors.titulo && <p className="text-xs text-kp-red">{errors.titulo}</p>}
        </div>

        <div className={fieldCls}>
          <label className={labelCls}>Slug (URL)</label>
          <BrutalInput
            value={form.slug}
            onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: e.target.value }); }}
            placeholder="se-genera-automatico"
          />
          {editing && (
            <p className="text-[10px] text-kp-red/80">⚠ Cambiar el slug rompe enlaces existentes y SEO.</p>
          )}
          {errors.slug && <p className="text-xs text-kp-red">{errors.slug}</p>}
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div className={fieldCls}>
            <label className={labelCls}>Categoría</label>
            <select
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              className={cn(inputBaseCls, "py-3")}
            >
              {CATEGORIAS_HISTORIA.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Fecha</label>
            <BrutalInput type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
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
      </BrutalCard>

      <BrutalCard tone="cheese" className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-display uppercase text-lg">Contenido</h3>
          <p className="text-[10px] text-kp-ink/60">Escribe libre. El sistema genera el HTML por ti.</p>
        </div>
        <RichEditor
          value={form.contenido_html ?? ""}
          onChange={(html) => setForm((f) => ({ ...f, contenido_html: html }))}
          placeholder="Cuenta la historia… usa la barra para dar formato."
        />
        <button
          type="button"
          onClick={() => setShowHtml((v) => !v)}
          className="text-[10px] font-display uppercase underline text-kp-ink/60"
        >
          {showHtml ? "Ocultar HTML" : "Ver HTML (avanzado)"}
        </button>
        {showHtml && (
          <textarea
            rows={8}
            value={form.contenido_html ?? ""}
            onChange={(e) => setForm({ ...form, contenido_html: e.target.value })}
            className={cn(inputBaseCls, "font-mono text-[11px]")}
          />
        )}
      </BrutalCard>

      <BrutalCard tone="cheese" className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className={labelCls + " mb-0"}>
            Extracto SEO <span className="text-[10px] normal-case text-kp-ink/60">(meta description en Google)</span>
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={handleAutoExcerpt} className="text-[10px] font-display uppercase underline">
              Auto desde el texto
            </button>
            <button
              type="button"
              onClick={handleGenerateExcerpt}
              disabled={aiBusy === "excerpt"}
              className="text-[10px] font-display uppercase underline disabled:opacity-50"
            >
              {aiBusy === "excerpt" ? "Pensando…" : "✨ Generar con IA"}
            </button>
          </div>
        </div>
        <textarea
          rows={3}
          value={form.extracto ?? ""}
          onChange={(e) => setForm({ ...form, extracto: e.target.value })}
          className={inputBaseCls}
          maxLength={500}
          placeholder="Si lo dejas vacío, lo generamos al guardar."
        />
        <div className="flex justify-between text-[10px] font-mono">
          <span
            className={
              (form.extracto?.length ?? 0) < 120 || (form.extracto?.length ?? 0) > 158
                ? "text-kp-red"
                : "text-kp-lime"
            }
          >
            {form.extracto?.length ?? 0} / 158 chars ideales
          </span>
        </div>

        {/* Vista previa Google */}
        <div className="border-2 border-kp-ink/20 bg-white p-3 rounded-sm">
          <div className="text-[10px] uppercase font-display text-kp-ink/50 mb-1">Vista previa en Google</div>
          <div className="text-[#1a0dab] text-base leading-tight truncate">
            {(form.titulo || "Título de la historia").slice(0, 60)} — KINGPAPA
          </div>
          <div className="text-[#006621] text-xs">kingpapacali.com › historias › {form.slug || "slug"}</div>
          <div className="text-[#4d5156] text-xs mt-1 line-clamp-2">
            {form.extracto || autoExcerpt(form.contenido_html ?? "", 155) || "El extracto aparecerá aquí."}
          </div>
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
