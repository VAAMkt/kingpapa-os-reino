import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const blocked = [
  "/admin",
  "/checkout",
  "/dashboard",
  "/mi-reino",
  "/reset-password",
  "/no-autorizado",
  "/gracias",
];
const noindexFiles = [
  "admin.tsx",
  "checkout.tsx",
  "dashboard.tsx",
  "mi-reino.tsx",
  "reset-password.tsx",
  "no-autorizado.tsx",
  "gracias.tsx",
];
const robots = read("public/robots.txt");
const sitemap = read("src/routes/sitemap[.]xml.tsx");

for (const path of blocked) assert.match(robots, new RegExp(`Disallow: ${path}(?:\\n|\\r)`));
for (const file of noindexFiles) {
  assert.match(read(`src/routes/${file}`), /name: "robots", content: "noindex/);
}
for (const path of [...blocked, "/login", "/registro", "/tracking"]) {
  assert.equal(sitemap.includes(`path: "${path}"`), false, `${path} no debe estar en sitemap`);
}

console.log("SEO indexing controls checks passed");
