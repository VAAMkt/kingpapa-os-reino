import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { sedesItemListJsonLd } from "../src/lib/seo-schema.ts";

const routes = readdirSync("src/routes")
  .filter((file) => file.endsWith(".tsx") && file !== "routeTree.gen.ts")
  .map((file) => readFileSync(`src/routes/${file}`, "utf8"))
  .join("\n");
const seoSchema = readFileSync("src/lib/seo-schema.ts", "utf8");
const publicFiles = [
  ...readdirSync("src/routes")
    .filter((file) => file.endsWith(".tsx") && !file.startsWith("admin"))
    .map((file) => `src/routes/${file}`),
  ...readdirSync("src/components/kp")
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => `src/components/kp/${file}`),
];

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

for (const file of publicFiles) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/<img\b[\s\S]*?\/>/g)) {
    const tag = match[0];
    assert.match(tag, /\balt=/, `${file}: <img> sin alt`);
    if (!tag.includes("META_PIXEL_NOSCRIPT_SRC")) {
      assert.doesNotMatch(tag, /\balt\s*=\s*["']\s*["']/, `${file}: alt vacío en imagen de contenido`);
    }
  }
}

const home = readFileSync("src/routes/index.tsx", "utf8");
assert.match(home, /src=\{heroAsset\.url\}[\s\S]{0,300}fetchPriority="high"/);
assert.match(home, /loader: async[\s\S]*ensureQueryData[\s\S]*listPublicSedes[\s\S]*listPublicPosts/);
assert.match(home, /sedesData\.map[\s\S]*to="\/sedes\/\$slug"/);
const historias = readFileSync("src/routes/historias.tsx", "utf8");
assert.match(historias, /loader: async[\s\S]*ensureQueryData[\s\S]*listPublicPosts/);
assert.match(historias, /initialData: initialHistorias/);
assert.match(readFileSync("src/routes/sedes.tsx", "utf8"), /<h2 className="sr-only">Sedes disponibles<\/h2>/);
assert.match(readFileSync("src/routes/historias.tsx", "utf8"), /<h2 className="sr-only">Historias publicadas<\/h2>/);
assert.doesNotMatch(readFileSync("src/components/kp/LeadFormFranquicia.tsx", "utf8"), /<h3\b/);
assert.doesNotMatch(readFileSync("src/components/kp/Layout.tsx", "utf8"), /<h[4-6]\b/);

console.log("SEO domain, structured-data, heading and image checks passed");
