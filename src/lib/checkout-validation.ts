import { z } from "zod";
import { phoneSchema } from "./form-validation.ts";

export const checkoutSchema = z
  .object({
    sedeId: z.string().uuid(),
    tipo: z.enum(["delivery", "pickup"]),
    pago: z.enum(["efectivo", "datafono", "online"]),
    cliente: z.object({
      nombre: z.string().trim().min(1).max(120),
      telefono: phoneSchema,
      direccion: z.string().trim().max(300).nullable().optional(),
      detalles: z.string().trim().max(300).nullable().optional(),
    }),
    notas: z.string().trim().max(500).nullable().optional(),
    pickupScheduledFor: z.string().datetime().nullable().optional(),
    externalId: z.string().max(120).nullable().optional(),
    destino: z
      .object({
        lat: z.number().finite().min(-90).max(90),
        lng: z.number().finite().min(-180).max(180),
      })
      .nullable()
      .optional(),
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
  })
  .superRefine((input, ctx) => {
    if (input.tipo === "delivery" && !input.cliente.direccion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Dirección obligatoria para domicilio",
        path: ["cliente", "direccion"],
      });
    }
  });
