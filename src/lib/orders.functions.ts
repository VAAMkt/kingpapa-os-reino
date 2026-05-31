// Server functions del checkout. Thin file: solo createServerFn + imports.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { submitOrder } from "./orders.server";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const checkoutSchema = z.object({
  sedeId: z.string().uuid(),
  tipo: z.enum(["delivery", "pickup"]),
  pago: z.enum(["efectivo", "datafono", "online"]),
  cliente: z.object({
    nombre: z.string().min(1).max(120),
    telefono: z.string().min(7).max(40),
    direccion: z.string().max(300).nullable().optional(),
    detalles: z.string().max(300).nullable().optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
  }),
  notas: z.string().max(500).nullable().optional(),
  items: z
    .array(
      z.object({
        productoId: z.string().uuid(),
        cantidad: z.number().int().min(1).max(50),
        modificadores: z
          .array(
            z.object({
              grupoId: z.number().int(),
              opcionId: z.number().int(),
            }),
          )
          .max(20)
          .optional(),
      }),
    )
    .min(1)
    .max(50),
});

export const submitCheckoutOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => checkoutSchema.parse(input))
  .handler(async ({ data }) => {
    // Auth opcional: si viene un bearer válido, asociamos el pedido al user.
    let userId: string | null = null;
    try {
      const authHeader = getRequestHeader("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (url && key) {
          const sb = createClient(url, key, {
            global: { headers: { Authorization: `Bearer ${token}` } },
          });
          const { data: userData } = await sb.auth.getUser();
          userId = userData.user?.id ?? null;
        }
      }
    } catch {
      // Pedido como invitado.
    }

    const result = await submitOrder({ ...data, userId });
    return result;
  });

/**
 * Busca el pedido más reciente del cliente (últimas 24h) por:
 *   - id (UUID)
 *   - rp_pedido_id (id interno del POS)
 *   - rp_numero_comanda (número corto del POS)
 *   - teléfono (cliente->>'telefono', últimos 10 dígitos)
 * Devuelve solo el id para evitar exponer datos del cliente.
 */
export const findRecentOrder = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ query: z.string().min(4).max(60) }).parse(input),
  )
  .handler(async ({ data }) => {
    const raw = data.query.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
    const digits = raw.replace(/\D/g, "");
    const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    if (isUuid) {
      const { data: row } = await supabaseAdmin
        .from("orders")
        .select("id, created_at")
        .eq("id", raw)
        .gt("created_at", cutoffIso)
        .maybeSingle();
      return row ? { orderId: row.id } : { notFound: true as const };
    }

    // Si parece número de comanda / id POS (3-10 dígitos), prioriza esa búsqueda.
    if (digits.length >= 3 && digits.length <= 10) {
      const { data: rows } = await supabaseAdmin
        .from("orders")
        .select("id, created_at")
        .or(`rp_numero_comanda.eq.${digits},rp_pedido_id.eq.${digits}`)
        .gt("created_at", cutoffIso)
        .order("created_at", { ascending: false })
        .limit(1);
      if (rows && rows.length > 0) return { orderId: rows[0].id };
    }

    // Fallback: teléfono. Buscamos por sufijo de 10 dígitos para tolerar prefijos.
    if (digits.length >= 7) {
      const tail = digits.slice(-10);
      const { data: rows } = await supabaseAdmin
        .from("orders")
        .select("id, created_at, cliente")
        .gt("created_at", cutoffIso)
        .order("created_at", { ascending: false })
        .limit(20);
      const match = (rows ?? []).find((r) => {
        const tel = ((r.cliente as { telefono?: string } | null)?.telefono ?? "").replace(/\D/g, "");
        return tel.endsWith(tail);
      });
      if (match) return { orderId: match.id };
    }

    return { notFound: true as const };
  });
