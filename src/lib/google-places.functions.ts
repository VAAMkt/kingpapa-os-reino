// Server function del admin para sincronizar la reputación de Google.
// Autorización: requiere rol super_admin | editor (verificado vía user_roles).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const syncGoogleRatings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sedeId: z.string().uuid().nullable().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["super_admin", "editor"]);
    if (!roles || roles.length === 0) {
      throw new Error("Forbidden: se requiere super_admin o editor");
    }

    const { syncGoogleRatingsCore } = await import("@/lib/google-places.server");
    return syncGoogleRatingsCore(data.sedeId ?? null);
  });
