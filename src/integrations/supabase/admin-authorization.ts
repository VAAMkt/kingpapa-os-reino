import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

type AppRole = Database["public"]["Enums"]["app_role"];

export const OPERATOR_ROLES = ["super_admin", "editor"] as const satisfies readonly AppRole[];
export const INTEGRATION_ROLES = [
  "super_admin",
  "editor",
  "marketing",
] as const satisfies readonly AppRole[];

export function hasAllowedRole(
  rows: readonly { role: string }[] | null | undefined,
  allowedRoles: readonly AppRole[],
): boolean {
  return !!rows?.some(({ role }) => allowedRoles.includes(role as AppRole));
}

export async function assertUserHasAnyRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  allowedRoles: readonly AppRole[],
): Promise<void> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", [...allowedRoles]);

  if (error) {
    console.error("[Auth] No se pudo verificar el rol administrativo", error);
    throw new Error("Forbidden: no se pudo verificar el rol");
  }
  if (!hasAllowedRole(data, allowedRoles)) throw new Error("Forbidden: rol insuficiente");
}
