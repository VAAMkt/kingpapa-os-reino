import assert from "node:assert/strict";
import { authRedirect } from "../src/lib/auth-validation.ts";

assert.equal(authRedirect("/admin"), "/admin");
assert.equal(authRedirect("/mi-reino"), "/mi-reino");
assert.equal(authRedirect("https://example.com"), "/mi-reino");
assert.equal(authRedirect("//example.com"), "/mi-reino");
assert.equal(authRedirect("/admin/usuarios"), "/mi-reino");

console.log("Auth redirect validation: OK");
