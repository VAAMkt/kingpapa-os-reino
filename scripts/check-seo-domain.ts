import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { sedesItemListJsonLd } from "../src/lib/seo-schema.ts";

const routes = readdirSync("src/routes")
  .filter((file) => file.endsWith(".tsx") && file !== "routeTree.gen.ts")
  .map((file) => readFileSync(`src/routes/${file}`, "utf8"))
  .join("\n");
const seoSchema = readFileSync("src/lib/seo-schema.ts", "utf8");

assert.match(seoSchema, /SITE_URL = "https:\/\/kingpapa\.co"/);
assert.doesNotMatch(routes, /const SITE_URL\s*=/);
assert.doesNotMatch(routes, /VITE_SITE_URL/);
assert.doesNotMatch(routes, /rel: "canonical", href: "\//);
assert.doesNotMatch(routes, /property: "og:url", content: "\//);
assert.equal(routes.match(/JSON\.stringify\(faqPageJsonLd\(\)\)/g)?.length, 1);

const sedeList = sedesItemListJsonLd([{ nombre: "KINGPAPA Test", slug: "test" }]);
assert.deepEqual(sedeList.itemListElement[0], {
  "@type": "ListItem",
  position: 1,
  name: "KINGPAPA Test",
  url: "https://kingpapa.co/sedes/test",
});
assert.doesNotMatch(JSON.stringify(sedeList), /"@type":"Restaurant"/);

console.log("SEO canonical domain and structured-data checks passed");
