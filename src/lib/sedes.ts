import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type SedeRow = Database["public"]["Tables"]["sedes"]["Row"];
export type SedeInsert = Database["public"]["Tables"]["sedes"]["Insert"];
export type SedeUpdate = Database["public"]["Tables"]["sedes"]["Update"];

export async function listPublicSedes(): Promise<SedeRow[]> {
  const { data, error } = await supabase
    .from("sedes")
    .select("*")
    .eq("publicado", true)
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listAllSedes(): Promise<SedeRow[]> {
  const { data, error } = await supabase
    .from("sedes")
    .select("*")
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getSedeById(id: string): Promise<SedeRow | null> {
  const { data, error } = await supabase.from("sedes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createSede(input: SedeInsert): Promise<SedeRow> {
  const { data, error } = await supabase.from("sedes").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateSede(id: string, input: SedeUpdate): Promise<SedeRow> {
  const { data, error } = await supabase.from("sedes").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteSede(id: string): Promise<void> {
  const { error } = await supabase.from("sedes").delete().eq("id", id);
  if (error) throw error;
}

export function slugifySede(input: string): string {
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

export const CIUDADES_SUGERIDAS = ["Cali", "Jamundí", "Bogotá", "Medellín"] as const;
