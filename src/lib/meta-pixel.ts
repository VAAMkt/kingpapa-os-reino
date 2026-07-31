/**
 * Meta (Facebook) Pixel — KINGPAPA
 *
 * - SSR-safe: todo se protege con `typeof window`.
 * - Nunca lanza: si un bloqueador impide cargar `fbevents.js`, la app sigue igual.
 * - No se envía PII (nombre, teléfono, dirección, email) al pixel.
 */

export const META_PIXEL_ID = "1348178064148165";

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[] };
    _fbq?: unknown;
  }
}

/** Snippet oficial de carga, sin el PageView (lo dispara el router). */
export const META_PIXEL_SNIPPET = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');`;

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
  fbq("track", "PageView");
}

type StandardEvent =
  | "ViewContent"
  | "AddToCart"
  | "InitiateCheckout"
  | "AddPaymentInfo"
  | "Purchase"
  | "Lead";

const COP = "COP";

/** Mapea eventos internos de `track()` a eventos estándar de Meta. */
function mapEvent(
  event: string,
  p: Record<string, unknown>,
): { name: StandardEvent; params: Record<string, unknown> } | null {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

  switch (event) {
    case "product_view":
      return {
        name: "ViewContent",
        params: {
          content_type: "product",
          content_ids: [str(p.producto_id)].filter(Boolean),
          content_name: str(p.producto_nombre),
          value: num(p.precio_base),
          currency: COP,
        },
      };
    case "add_to_cart":
      return {
        name: "AddToCart",
        params: {
          content_type: "product",
          content_ids: [str(p.producto_id)].filter(Boolean),
          content_name: str(p.producto_nombre),
          value: num(p.precio_final),
          currency: COP,
        },
      };
    case "upsell_added":
      return {
        name: "AddToCart",
        params: {
          content_type: "product",
          content_ids: [str(p.producto_id)].filter(Boolean),
          value: num(p.precio_final),
          currency: COP,
        },
      };
    case "checkout_started":
      return {
        name: "InitiateCheckout",
        params: {
          num_items: num(p.items_count),
          value: num(p.subtotal),
          currency: COP,
        },
      };
    case "payment_method_selected":
      return {
        name: "AddPaymentInfo",
        params: { content_category: str(p.metodo), currency: COP },
      };
    case "franquicia_step1_submit":
    case "franquicia_step2_submit":
      return { name: "Lead", params: { content_category: "franquicia" } };
    default:
      return null;
  }
}

/** Reenvía un evento interno al pixel si tiene equivalente estándar. */
export function pixelTrack(event: string, payload?: Record<string, unknown>): void {
  const mapped = mapEvent(event, payload ?? {});
  if (!mapped) return;
  fbq("track", mapped.name, clean(mapped.params));
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
  contentIds?: string[];
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
  fbq(
    "track",
    "Purchase",
    clean({
      value: args.value,
      currency: COP,
      content_type: "product",
      content_ids: args.contentIds ?? [],
      num_items: args.numItems,
    }),
    { eventID: `kp-order-${args.orderId}` },
  );
}
