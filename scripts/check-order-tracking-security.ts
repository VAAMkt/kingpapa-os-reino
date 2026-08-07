import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyOrderLookup } from "../src/lib/order-lookup.ts";

const uuid = "123e4567-e89b-12d3-a456-426614174000";
assert.deepEqual(classifyOrderLookup(uuid), { kind: "uuid", value: uuid });
assert.deepEqual(classifyOrderLookup("+57 300 123 4567"), {
  kind: "phone",
  value: "3001234567",
});
assert.equal(classifyOrderLookup("158716"), null);

const sql = readFileSync(
  new URL("../supabase/migrations/20260807070000_lock_order_tracking.sql", import.meta.url),
  "utf8",
);
assert.match(sql, /REVOKE SELECT ON TABLE public\.orders FROM anon/);
assert.match(sql, /REVOKE INSERT ON TABLE public\.orders FROM authenticated/);

console.log("order tracking security checks passed");
