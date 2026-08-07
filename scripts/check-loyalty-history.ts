import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toLoyaltyHistoryCandidate } from "../src/lib/loyalty-history.ts";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260807100000_restaurantpe_loyalty_history.sql",
    import.meta.url,
  ),
  "utf8",
);
const direct = toLoyaltyHistoryCandidate(
  {
    delivery_id: "123",
    delivery_estado: 4,
    canaldelivery_id: 1,
    delivery_celular: "+57 312 852 2152",
    delivery_email: "CLIENTE@EXAMPLE.COM",
    delivery_importe: "88000",
  },
  3,
);

assert.deepEqual(direct, {
  delivery_id: "123",
  local_id: 3,
  customer_phone: "3128522152",
  customer_email: "cliente@example.com",
  total: 88000,
  delivered_at: null,
  channel_id: 1,
});
assert.equal(
  toLoyaltyHistoryCandidate(
    {
      delivery_id: "rappi",
      delivery_estado: 4,
      canaldelivery_id: 2,
      delivery_celular: "3128522152",
    },
    3,
  ),
  null,
);
assert.equal(
  toLoyaltyHistoryCandidate(
    {
      delivery_id: "active",
      delivery_estado: 3,
      canaldelivery_id: 1,
      delivery_celular: "3128522152",
    },
    3,
  ),
  null,
);
assert.match(migration, /CREATE UNIQUE INDEX loyalty_ledger_rp_delivery_earn/);
assert.match(
  migration,
  /REVOKE ALL ON TABLE public\.loyalty_rp_orders FROM PUBLIC, anon, authenticated/,
);
assert.match(migration, /phone_is_unique AND customer_phone = normalized_phone/);
assert.match(migration, /UPDATE public\.orders[\s\S]*status = 'entregado'/);
assert.match(migration, /is_test = false[\s\S]*analytics_excluded_at IS NULL/);
assert.match(migration, /ON CONFLICT DO NOTHING[\s\S]*RETURNING puntos/);

console.log("loyalty history checks passed");
