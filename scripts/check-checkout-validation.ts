import assert from "node:assert/strict";
import { checkoutSchema } from "../src/lib/checkout-validation.ts";
import { phoneSchema } from "../src/lib/form-validation.ts";

const base = {
  sedeId: "11111111-1111-4111-8111-111111111111",
  tipo: "delivery" as const,
  pago: "efectivo" as const,
  cliente: { nombre: "Ana", telefono: "+57 300 123 4567", direccion: "Calle 1" },
  destino: { lat: 3.4516, lng: -76.532 },
  items: [{ productoId: "22222222-2222-4222-8222-222222222222", cantidad: 1 }],
};

assert.equal(checkoutSchema.parse(base).cliente.telefono, "573001234567");
assert.equal(phoneSchema.safeParse("' OR 1=1 --").success, false);
assert.equal(
  checkoutSchema.safeParse({ ...base, cliente: { ...base.cliente, telefono: "abcdefg" } }).success,
  false,
);
assert.equal(
  checkoutSchema.safeParse({ ...base, cliente: { ...base.cliente, nombre: "   " } }).success,
  false,
);
assert.equal(
  checkoutSchema.safeParse({ ...base, cliente: { ...base.cliente, direccion: "   " } }).success,
  false,
);
assert.equal(
  checkoutSchema.safeParse({
    ...base,
    tipo: "pickup",
    cliente: { ...base.cliente, direccion: null },
  }).success,
  true,
);

console.log("Checkout trust-boundary validation: OK");
