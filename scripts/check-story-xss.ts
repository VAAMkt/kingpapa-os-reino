import assert from "node:assert/strict";
import { sanitizeLegacyHtml } from "../src/lib/sanitize-html.ts";

const dirty = [
  '<script>alert(1)</script><p onclick="alert(2)">Texto</p>',
  '<img src="x" onerror="alert(3)">',
  '<a href="javascript:alert(4)">enlace</a>',
  '<svg><a href="javascript:alert(5)">svg</a></svg>',
  '<math><mtext><img src="x" onerror="alert(6)"></mtext></math>',
].join("");

const clean = sanitizeLegacyHtml(dirty);
assert.equal(/script|onerror|onclick|javascript:|<svg|<math/i.test(clean), false, clean);
assert.equal(clean.includes("<p>Texto</p>"), true, clean);
assert.equal(
  sanitizeLegacyHtml("<h2>Historia</h2><p><strong>Seguro</strong></p>"),
  "<h2>Historia</h2><p><strong>Seguro</strong></p>",
);
assert.equal(
  sanitizeLegacyHtml('<img src="https://kingpapa.co/foto.jpg" alt="">', "Imagen de la historia"),
  '<img src="https://kingpapa.co/foto.jpg" alt="Imagen de la historia" />',
);

console.log("Story HTML XSS checks passed");
