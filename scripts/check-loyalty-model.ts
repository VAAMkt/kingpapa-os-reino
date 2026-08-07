import assert from "node:assert/strict";
import { calculateClan, getLoyaltyProgress } from "../src/lib/loyalty-model.ts";

const expectedRanks = new Map([
  [-1, "Postulante"],
  [0, "Postulante"],
  [2, "Postulante"],
  [3, "Iniciado"],
  [5, "Iniciado"],
  [6, "Militante"],
  [11, "Militante"],
  [12, "Guardián"],
  [23, "Guardián"],
  [24, "Consagrado"],
]);

for (const [orders, rank] of expectedRanks) {
  assert.equal(getLoyaltyProgress(orders).current.name, rank);
}
assert.deepEqual(getLoyaltyProgress(2), {
  orders: 2,
  current: { name: "Postulante", band: "Blanca", minOrders: 0 },
  next: { name: "Iniciado", band: "Amarilla", minOrders: 3 },
  remaining: 1,
  percent: 67,
});
assert.equal(getLoyaltyProgress(Number.NaN).orders, 0);

assert.equal(
  calculateClan({ hambre: "5", picante: "3", ocasion: "almuerzo-obrero" }),
  "Legión de Acero",
);
assert.equal(
  calculateClan({ hambre: "3", picante: "1", ocasion: "after-rumba" }),
  "Tripulación del After",
);
assert.equal(
  calculateClan({ hambre: "1", picante: "0", ocasion: "familia" }),
  "Iluminado de la Fórmula",
);

console.log("Loyalty model checks passed");
