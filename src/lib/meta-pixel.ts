/**
 * Meta (Facebook) Pixel — KINGPAPA
 *
 * Alineado con "Specifications for Meta Pixel standard events".
 * - SSR-safe: todo se protege con `typeof window`.
 * - Nunca lanza: si un bloqueador impide cargar `fbevents.js`, la app sigue igual.
 * - PII: sólo Advanced Matching, hasheada con SHA-256 en el navegador.
 */

export const META_PIXEL_ID = "1348178064148165";

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[] };
    _fbq?: unknown;
  }
}

/** Snippet oficial de carga + PageView inmediato (lo que Meta detecta al verificar). */
export const META_PIXEL_SNIPPET = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');window.__kpPixelInitialPageView=true;`;

export const META_PIXEL_NOSCRIPT_SRC = `https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`;

function fbq(...args: unknown[]): void {
  if (typeof window === "undefined") return;
  try {
    window.fbq?.(...args);
  } catch {
    /* nunca romper UX por analytics */
  }
}

export function pixelPageView(): void {
  if (typeof window === "undefined") return;
  // El snippet del head ya dispara el primer PageView: evitamos duplicarlo.
  const w = window as Window & { __kpPixelInitialPageView?: boolean };
  if (w.__kpPixelInitialPageView) {
    w.__kpPixelInitialPageView = false;
    return;
  }
  fbq("track", "PageView", {}, { eventID: eventId("PageView") });
}

type StandardEvent =
  | "ViewContent"
  | "Search"
  | "ViewCategory"
  | "AddToCart"
  | "InitiateCheckout"
  | "AddPaymentInfo"
  | "Purchase"
  | "Lead";

const COP = "COP";

/** ID único por evento: base para deduplicar cuando activemos Conversions API. */
function eventId(name: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `kp-${name}-${rand}`;
}

type ContentLine = { id: string; quantity: number; item_price?: number };

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}
function ids(...v: unknown[]): string[] {
  return v.map(str).filter((x): x is string => !!x);
}

/** Normaliza `items` del payload interno al arreglo `contents` de Meta. */
function toContents(v: unknown): ContentLine[] {
  if (!Array.isArray(v)) return [];
  const out: ContentLine[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const id = str(o.productoId) ?? str(o.id);
    if (!id) continue;
    out.push({
      id,
      quantity: num(o.cantidad) ?? num(o.quantity) ?? 1,
      item_price: num(o.precio) ?? num(o.item_price),
    });
  }
  return out;
}

function lineFor(p: Record<string, unknown>, price?: number): ContentLine[] {
  const id = str(p.producto_id);
  if (!id) return [];
  return [{ id, quantity: num(p.cantidad) ?? 1, item_price: price }];
}

/** Mapea eventos internos de `track()` a eventos estándar de Meta. */
function mapEvent(
  event: string,
  p: Record<string, unknown>,
): { name: StandardEvent; params: Record<string, unknown> } | null {
  switch (event) {
    case "product_view":
    case "customizer_opened": {
      const value = num(p.precio_base) ?? num(p.precio_final);
      return {
        name: "ViewContent",
        params: {
          content_type: "product",
          content_ids: ids(p.producto_id),
          contents: lineFor(p, value),
          content_name: str(p.producto_nombre),
          content_category: str(p.categoria),
          value,
          currency: COP,
        },
      };
    }
    case "menu_search":
      return {
        name: "Search",
        params: {
          search_string: str(p.query),
          content_category: str(p.categoria),
          content_ids: Array.isArray(p.resultados_ids) ? p.resultados_ids : undefined,
        },
      };
    case "category_clicked":
      return {
        name: "ViewCategory",
        params: {
          content_type: "product_group",
          content_category: str(p.categoria_nombre) ?? str(p.categoria_id),
          content_ids: ids(p.categoria_id),
        },
      };
    case "add_to_cart":
    case "upsell_added": {
      const value = (num(p.precio_final) ?? 0) * (num(p.cantidad) ?? 1);
      return {
        name: "AddToCart",
        params: {
          content_type: "product",
          content_ids: ids(p.producto_id),
          contents: lineFor(p, num(p.precio_final)),
          content_name: str(p.producto_nombre),
          content_category: str(p.categoria),
          value: value || num(p.precio_final),
          currency: COP,
        },
      };
    }
    case "checkout_started": {
      const contents = toContents(p.items);
      return {
        name: "InitiateCheckout",
        params: {
          content_type: "product",
          content_ids: contents.map((c) => c.id),
          contents,
          num_items: num(p.items_count),
          value: num(p.subtotal),
          currency: COP,
        },
      };
    }
    case "payment_method_selected":
      return {
        name: "AddPaymentInfo",
        params: {
          content_category: str(p.metodo),
          value: num(p.total) ?? num(p.subtotal),
          currency: COP,
        },
      };
    case "franquicia_step1_submit":
    case "franquicia_step2_submit":
      return {
        name: "Lead",
        params: {
          content_name: "franquicia",
          content_category: event === "franquicia_step1_submit" ? "datos_basicos" : "cualificacion",
        },
      };
    default:
      return null;
  }
}

/** Reenvía un evento interno al pixel si tiene equivalente estándar. */
export function pixelTrack(event: string, payload?: Record<string, unknown>): void {
  const mapped = mapEvent(event, payload ?? {});
  if (!mapped) return;
  fbq("track", mapped.name, clean(mapped.params), { eventID: eventId(mapped.name) });
}

function clean(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Purchase con deduplicación por pedido: si el usuario recarga /gracias
 * el evento no se cuenta dos veces (mismo eventID + guardia en sessionStorage).
 */
export function pixelPurchase(args: {
  orderId: string;
  value: number;
  contents?: ContentLine[];
  numItems?: number;
}): void {
  if (typeof window === "undefined") return;
  const key = `kp.fbq.purchase.${args.orderId}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    /* modo privado: seguimos, el eventID igual deduplica del lado de Meta */
  }
  const contents = args.contents ?? [];
  fbq(
    "track",
    "Purchase",
    clean({
      value: args.value,
      currency: COP,
      content_type: "product",
      content_ids: contents.map((c) => c.id),
      contents,
      num_items: args.numItems ?? contents.reduce((n, c) => n + c.quantity, 0),
    }),
    { eventID: `kp-order-${args.orderId}` },
  );
}

/* ------------------------------------------------------------------ */
/* Advanced Matching (hash SHA-256 en el navegador, nunca en claro)    */
/* ------------------------------------------------------------------ */

async function sha256(value: string): Promise<string | undefined> {
  try {
    const data = new TextEncoder().encode(value);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return undefined;
  }
}

/** Teléfono colombiano -> E.164 sin `+` (formato que espera Meta). */
function normalizePhone(raw: string): string | undefined {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("57")) return digits;
  if (digits.length === 10) return `57${digits}`;
  return digits;
}

/**
 * Re-inicializa el pixel con datos de contacto hasheados para subir el
 * "Event Match Quality". Sólo teléfono, nombre, ciudad y país.
 */
export async function pixelAdvancedMatch(user: {
  nombre?: string | null;
  telefono?: string | null;
  ciudad?: string | null;
}): Promise<void> {
  if (typeof window === "undefined" || typeof crypto?.subtle === "undefined") return;
  const partes = (user.nombre ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const phone = user.telefono ? normalizePhone(user.telefono) : undefined;
  const ciudad = (user.ciudad ?? "").trim().toLowerCase().replace(/\s+/g, "");

  const [ph, fn, ln, ct, country] = await Promise.all([
    phone ? sha256(phone) : Promise.resolve(undefined),
    partes[0] ? sha256(partes[0]) : Promise.resolve(undefined),
    partes.length > 1 ? sha256(partes[partes.length - 1]!) : Promise.resolve(undefined),
    ciudad ? sha256(ciudad) : Promise.resolve(undefined),
    sha256("co"),
  ]);

  const data = clean({ ph, fn, ln, ct, country });
  if (Object.keys(data).length === 0) return;
  fbq("init", META_PIXEL_ID, data);
}
