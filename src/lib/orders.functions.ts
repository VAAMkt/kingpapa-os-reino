// Server functions del checkout. Thin file: solo createServerFn + imports.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { submitOrder } from "./orders.server";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

const checkoutSchema = z.object({
  sedeId: z.string().uuid(),
  tipo: z.enum(["delivery", "pickup"]),
  pago: z.enum(["efectivo", "datafono", "online"]),
  cliente: z.object({
    nombre: z.string().min(1).max(120),
    telefono: z.string().min(7).max(40),
    direccion: z.string().max(300).nullable().optional(),
    detalles: z.string().max(300).nullable().optional(),
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
