import { supabase } from "@/integrations/supabase/client";
import type { Historia, CategoriaHistoria } from "@/types/kp";
import type { Database } from "@/integrations/supabase/types";

export type PostRow = Database["public"]["Tables"]["posts"]["Row"];
export type PostInsert = Database["public"]["Tables"]["posts"]["Insert"];
export type PostUpdate = Database["public"]["Tables"]["posts"]["Update"];

export function mapPostToHistoria(p: PostRow): Historia {
  return {
    id: p.id,
    slug: p.slug,
    titulo: p.titulo,
    categoria: p.categoria as CategoriaHistoria,
    extracto: p.extracto ?? "",
    fecha: p.fecha,
    imagen: p.imagen_url,
    videoUrl: p.video_url ?? undefined,
    link: p.link_original ?? undefined,
    contenidoHtml: p.contenido_html ?? undefined,
  };
}

export async function listPublicPosts(): Promise<Historia[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("publicado", true)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapPostToHistoria);
}

export async function getPublicPostBySlug(slug: string): Promise<Historia | null> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("slug", slug)
    .eq("publicado", true)
    .maybeSingle();
  if (error) throw error;
  return data ? mapPostToHistoria(data) : null;
}

export async function listAllPosts(): Promise<PostRow[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getPostById(id: string): Promise<PostRow | null> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createPost(input: PostInsert): Promise<PostRow> {
  const { data, error } = await supabase
    .from("posts")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePost(id: string, input: PostUpdate): Promise<PostRow> {
  const { data, error } = await supabase
    .from("posts")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadBlogImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `covers/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("blog-images")
    .upload(path, file, { cacheControl: "31536000", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("blog-images").getPublicUrl(path);
  return data.publicUrl;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export const CATEGORIAS_HISTORIA: CategoriaHistoria[] = [
  "Retos",
  "Festivales",
  "Cultura interna",
  "Fans",
  "Sostenibilidad",
  "Franquicias",
  "Nuevas sedes",
];
