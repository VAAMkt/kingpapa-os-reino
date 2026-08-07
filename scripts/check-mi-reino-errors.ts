import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const count = (source: string, value: string) => source.split(value).length - 1;

assert.equal(count(read("src/lib/mi-reino.functions.ts"), ".throwOnError()"), 8);
assert.equal(count(read("src/lib/loyalty.functions.ts"), ".throwOnError()"), 4);

for (const route of ["index", "pedidos", "favoritos", "datos", "puntos"]) {
  assert.match(read(`src/routes/mi-reino.${route}.tsx`), /MiReinoQueryError/);
}

console.log("Mi Reino Supabase error handling: OK");
