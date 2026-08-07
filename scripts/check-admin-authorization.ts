import assert from "node:assert/strict";
import {
  hasAllowedRole,
  INTEGRATION_ROLES,
  OPERATOR_ROLES,
} from "../src/integrations/supabase/admin-authorization.ts";
import { authorizeCronRequest } from "../src/lib/cron-auth.server.ts";

assert.equal(hasAllowedRole([{ role: "editor" }], OPERATOR_ROLES), true);
assert.equal(hasAllowedRole([{ role: "marketing" }], OPERATOR_ROLES), false);
assert.equal(hasAllowedRole([{ role: "marketing" }], INTEGRATION_ROLES), true);
assert.equal(hasAllowedRole([{ role: "cliente" }], INTEGRATION_ROLES), false);

process.env.INTERNAL_CRON_SECRET = "test-secret";
assert.equal(
  authorizeCronRequest(
    new Request("https://kingpapa.co/api/public/hooks/test", {
      headers: { authorization: "Bearer test-secret" },
    }),
  ),
  null,
);
assert.equal(
  authorizeCronRequest(
    new Request("https://kingpapa.co/api/public/hooks/test", {
      headers: { "x-cron-secret": "wrong" },
    }),
  )?.status,
  401,
);
assert.equal(
  authorizeCronRequest(
    new Request("https://kingpapa.co/api/public/hooks/test", {
      headers: { authorization: "Basic test-secret" },
    }),
  )?.status,
  401,
);
delete process.env.INTERNAL_CRON_SECRET;
assert.equal(
  authorizeCronRequest(new Request("https://kingpapa.co/api/public/hooks/test"))?.status,
  503,
);

console.log("admin authorization checks passed");
