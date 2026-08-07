import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../supabase/migrations/20260807060000_lock_loyalty_balances.sql", import.meta.url),
  "utf8",
);
const earnSql = readFileSync(
  new URL(
    "../supabase/migrations/20260807080000_make_loyalty_earn_idempotent.sql",
    import.meta.url,
  ),
  "utf8",
);
const checkout = readFileSync(new URL("../src/routes/checkout.tsx", import.meta.url), "utf8");
const loyalty = readFileSync(new URL("../src/lib/loyalty.functions.ts", import.meta.url), "utf8");
const quizUi = readFileSync(new URL("../src/components/kp/LoyaltyModule.tsx", import.meta.url), "utf8");
const quizSql = readFileSync(
  new URL("../supabase/migrations/20260807090000_persist_loyalty_quiz.sql", import.meta.url),
  "utf8",
);

assert.match(sql, /DROP POLICY IF EXISTS "loyalty_accounts: dueño actualiza"/);
assert.match(sql, /DROP POLICY IF EXISTS "loyalty_accounts: dueño inserta"/);
assert.match(sql, /REVOKE INSERT, UPDATE ON TABLE public\.loyalty_accounts FROM authenticated/);
assert.match(earnSql, /RETURNING id INTO inserted_ledger_id/);
assert.match(earnSql, /IF inserted_ledger_id IS NULL THEN RETURN NEW/);
assert.match(earnSql, /COALESCE\(NEW\.total, 0\) \/ 10000/);
assert.match(checkout, /Math\.floor\(total \/ 10000\) \* 10/);
assert.doesNotMatch(checkout, /Math\.floor\(total \/ 1000\) \* 10/);
assert.match(loyalty, /\.eq\("user_id", userId\)/);
assert.match(loyalty, /\.eq\("status", "entregado"\)/);
assert.match(loyalty, /\.eq\("is_test", false\)/);
assert.match(loyalty, /\.is\("analytics_excluded_at", null\)/);
assert.match(loyalty, /saveSubditoQuiz[\s\S]*\.middleware\(\[requireSupabaseAuth\]\)/);
assert.match(loyalty, /habeas_data_accepted: z\.literal\(true\)/);
assert.doesNotMatch(quizUi, /kp_subdito|localStorage/);
assert.match(quizUi, /saveSubditoQuiz/);
assert.match(quizUi, /type="checkbox"[\s\S]*required/);
assert.match(quizSql, /REVOKE INSERT ON TABLE public\.subditos FROM anon, authenticated/);
assert.match(quizSql, /habeas_data_accepted_at = now\(\)/);
assert.match(quizSql, /quiz_clan IS NOT NULL AND quiz_accepted/);
assert.ok(
  earnSql.indexOf("IF inserted_ledger_id IS NULL THEN RETURN NEW") <
    earnSql.indexOf("UPDATE public.loyalty_accounts"),
  "el saldo no puede cambiar antes de confirmar el asiento",
);

console.log("loyalty security and consistency checks passed");
