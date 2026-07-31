// Espejo servidor de los eventos del pixel (Meta Conversions API).
// Endpoint público por diseño: sólo acepta una lista blanca de eventos
// estándar y un conjunto acotado de parámetros. Nunca lanza.

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";

const EVENTS = [
  "PageView",
  "ViewContent",
  "Search",
  "ViewCategory",
  "AddToCart",
  "InitiateCheckout",
  "AddPaymentInfo",
  "Lead",
  "Purchase",
] as const;

const contentLine = z.object({
  id: z.string().max(120),
  quantity: z.number().finite().nonnegative().max(999),
  item_price: z.number().finite().nonnegative().max(100_000_000).optional(),
});

const customData = z
  .object({
    value: z.number().finite().nonnegative().max(1_000_000_000).optional(),
    currency: z.string().max(8).optional(),
    content_type: z.string().max(40).optional(),
    content_name: z.string().max(200).optional(),
    content_category: z.string().max(200).optional(),
    content_ids: z.array(z.string().max(120)).max(100).optional(),
    contents: z.array(contentLine).max(100).optional(),
    num_items: z.number().int().nonnegative().max(999).optional(),
    search_string: z.string().max(200).optional(),
  })
  .strip();

const schema = z.object({
  eventName: z.enum(EVENTS),
  eventId: z.string().min(1).max(120),
  eventSourceUrl: z.string().url().max(500).optional(),
  customData: customData.optional(),
  fbp: z.string().max(120).optional(),
  fbc: z.string().max(200).optional(),
  // Datos de contacto: se hashean en el servidor, nunca se persisten.
  nombre: z.string().max(120).optional(),
  telefono: z.string().max(40).optional(),
  ciudad: z.string().max(80).optional(),
});

export const sendMetaEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { sendCapiEvents } = await import("./capi.server");
      await sendCapiEvents([
        {
          eventName: data.eventName,
          eventId: data.eventId,
          eventSourceUrl: data.eventSourceUrl ?? null,
          actionSource: "website",
          customData: data.customData,
          user: {
            nombre: data.nombre ?? null,
            telefono: data.telefono ?? null,
            ciudad: data.ciudad ?? null,
            fbp: data.fbp ?? null,
            fbc: data.fbc ?? null,
            ip: getRequestIP({ xForwardedFor: true }) ?? null,
            userAgent: getRequestHeader("user-agent") ?? null,
          },
        },
      ]);
    } catch {
      /* analytics nunca rompe la app */
    }
    return { ok: true };
  });
