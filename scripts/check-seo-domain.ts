import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

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

console.log("SEO canonical domain checks passed");
