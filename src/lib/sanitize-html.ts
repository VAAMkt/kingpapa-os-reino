import sanitizeHtml from "sanitize-html";

const SAFE_HTML = {
  allowedTags: [
    "p",
    "br",
    "h2",
    "h3",
    "h4",
    "strong",
    "b",
    "em",
    "i",
    "s",
    "blockquote",
    "ul",
    "ol",
    "li",
    "a",
    "img",
    "figure",
    "figcaption",
    "hr",
    "code",
    "pre",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
} satisfies sanitizeHtml.IOptions;

// Limpia HTML legacy de WordPress/Divi y elimina contenido ejecutable.
export function sanitizeLegacyHtml(input: string): string {
  if (!input) return "";
  let html = input;

  // 1) Eliminar shortcodes de Divi: [et_pb_xxx ...], [/et_pb_xxx]
  html = html.replace(/\[\/?et_pb_[^\]]*\]/gi, "");

  // 2) Eliminar atributos de Lovable / Divi de tracking
  html = html.replace(/\s+data-(path-to-node|index-in-node|hash|wf-[a-z-]+)="[^"]*"/gi, "");

  // 3) Decodificar entidades comunes mal escapadas (&#8243; = ", &#8217; = ')
  const entities: Record<string, string> = {
    "&#8243;": '"',
    "&#8242;": "'",
    "&#8217;": "'",
    "&#8216;": "'",
    "&#8220;": '"',
    "&#8221;": '"',
    "&#8211;": "–",
    "&#8212;": "—",
    "&#8230;": "…",
    "&nbsp;": " ",
    "&amp;": "&",
  };
  for (const [k, v] of Object.entries(entities)) {
    html = html.replaceAll(k, v);
  }

  // 4) Colapsar párrafos vacíos y espacios consecutivos
  html = html.replace(/<p>\s*<\/p>/gi, "");
  html = html.replace(/\n{3,}/g, "\n\n");

  return sanitizeHtml(html, SAFE_HTML).trim();
}

export function htmlToPlainText(html: string): string {
  if (!html) return "";
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|h[1-6]|li|br)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

export function autoExcerpt(html: string, maxLen = 155): string {
  const text = htmlToPlainText(html);
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}

export function readingTimeMin(html: string): number {
  const words = htmlToPlainText(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
