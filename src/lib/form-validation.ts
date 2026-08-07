import { z } from "zod";

export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, ""))
  .pipe(z.string().min(7, "Teléfono inválido").max(15, "Teléfono inválido"));
