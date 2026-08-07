import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../supabase/migrations/20260807060000_lock_loyalty_balances.sql", import.meta.url),
  "utf8",
);

assert.match(sql, /DROP POLICY IF EXISTS "loyalty_accounts: dueño actualiza"/);
assert.match(sql, /DROP POLICY IF EXISTS "loyalty_accounts: dueño inserta"/);
assert.match(sql, /REVOKE INSERT, UPDATE ON TABLE public\.loyalty_accounts FROM authenticated/);

console.log("loyalty security checks passed");
