import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { authRedirect } from "../src/lib/auth-validation.ts";

assert.equal(authRedirect("/admin"), "/admin");
assert.equal(authRedirect("/mi-reino"), "/mi-reino");
assert.equal(authRedirect("https://example.com"), "/mi-reino");
assert.equal(authRedirect("//example.com"), "/mi-reino");
assert.equal(authRedirect("/admin/usuarios"), "/mi-reino");

const authForms = readFileSync(new URL("../src/components/auth/AuthForms.tsx", import.meta.url), "utf8");
const resetRoute = readFileSync(new URL("../src/routes/reset-password.tsx", import.meta.url), "utf8");
assert.match(authForms, /resetPasswordForEmail/);
assert.match(authForms, /\/reset-password/);
assert.match(resetRoute, /!isAuthenticated/);
assert.match(resetRoute, /Enlace inválido o vencido/);

console.log("Auth redirect validation: OK");
