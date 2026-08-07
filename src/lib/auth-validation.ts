export type AuthRedirect = "/mi-reino" | "/admin";

export function authRedirect(value: unknown): AuthRedirect {
  return value === "/admin" ? "/admin" : "/mi-reino";
}
