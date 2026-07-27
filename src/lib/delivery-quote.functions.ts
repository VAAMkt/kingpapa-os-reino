// Thin wrapper — server function pública para cotizar el domicilio en checkout.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { quoteDeliveryInternal } from "./delivery-quote.server";

const schema = z.object({
  sedeId: z.string().uuid(),
  tipo: z.enum(["delivery", "pickup"]),
  destino: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
});

export const quoteDelivery = createServerFn({ method: "POST" })
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data }) => quoteDeliveryInternal(data));
