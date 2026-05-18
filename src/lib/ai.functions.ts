import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

async function callGateway(system: string, user: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Falta LOVABLE_API_KEY en el servidor");
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (res.status === 429) throw new Error("Demasiadas solicitudes a la IA, intenta en un minuto.");
  if (res.status === 402) throw new Error("Sin créditos de IA en el workspace.");
  if (!res.ok) throw new Error(`IA falló: ${res.status}`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return (json.choices?.[0]?.message?.content ?? "").trim().replace(/^["']|["']$/g, "");
}

export const generateExcerpt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      titulo: z.string().min(1).max(300),
      contenido: z.string().min(1).max(20000),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const system =
      "Eres redactor SEO en español para KINGPAPA, marca de papas a la francesa en Cali, Colombia. " +
      "Tono cercano, vendedor, sin emojis, sin comillas. Devuelves SOLO la meta description, sin prefijos.";
    const user =
      `Genera una meta description SEO de 140 a 155 caracteres para este artículo.\n\n` +
      `Título: ${data.titulo}\n\nContenido:\n${data.contenido.slice(0, 4000)}`;
    const text = await callGateway(system, user);
    return { text: text.slice(0, 158) };
  });

export const suggestSeoTitle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      titulo: z.string().min(1).max(300),
      contenido: z.string().max(20000).optional().default(""),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const system =
      "Eres experto SEO en español. Devuelves SOLO el nuevo título, máximo 60 caracteres, " +
      "con la palabra clave principal al inicio, sin comillas ni prefijos.";
    const user = `Reescribe este título para SEO (máx 60 chars):\n"${data.titulo}"\n\nContexto:\n${data.contenido.slice(0, 1500)}`;
    const text = await callGateway(system, user);
    return { text: text.slice(0, 60) };
  });
