/**
 * Meta Conversions API (CAPI) — envío servidor → Meta.
 *
 * Segundo canal de eventos: los mismos eventos del pixel salen también desde
 * el servidor con el MISMO `event_id`, y Meta los deduplica.
 *
 * - Nunca lanza: cualquier fallo se registra en consola y se ignora.
 * - PII siempre hasheada con SHA-256 (Web Crypto, disponible en el Worker).
 */

export const META_DATASET_ID = "1348178064148165";
const GRAPH_VERSION = "v21.0";

function accessToken(): string | undefined {
  // `META_CAPI_ACCESS_TOKEN` permite separar tokens más adelante; por defecto
  // usamos el token de la integración directa (Dataset Quality API).
  return process.env["META_CAPI_ACCESS_TOKEN"] || process.env["DATASET_QUALITY_API"] || undefined;
}

async function sha256Hex(value: string): Promise<string | undefined> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return undefined;
  }
}

/** Teléfono colombiano -> E.164 sin `+` (idéntico al normalizador del cliente). */
function normalizePhone(raw: string): string | undefined {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("57")) return digits;
  if (digits.length === 10) return `57${digits}`;
  return digits;
}

function normText(v: string): string {
  return v.trim().toLowerCase();
}

export type CapiUser = {
  nombre?: string | null;
  telefono?: string | null;
  ciudad?: string | null;
  email?: string | null;
  externalId?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export type CapiEvent = {
  eventName: string;
  eventId: string;
  eventTime?: number;
  eventSourceUrl?: string | null;
  actionSource?: "website" | "phone_call" | "chat" | "other";
  customData?: Record<string, unknown>;
  user?: CapiUser;
};

function clean<T extends Record<string, unknown>>(o: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

async function buildUserData(u: CapiUser | undefined): Promise<Record<string, unknown>> {
  if (!u) return {};
  const partes = normText(u.nombre ?? "").split(/\s+/).filter(Boolean);
  const phone = u.telefono ? normalizePhone(u.telefono) : undefined;
  const ciudad = normText(u.ciudad ?? "").replace(/\s+/g, "");
  const email = u.email ? normText(u.email) : undefined;

  const [ph, fn, ln, ct, country, em, ext] = await Promise.all([
    phone ? sha256Hex(phone) : Promise.resolve(undefined),
    partes[0] ? sha256Hex(partes[0]) : Promise.resolve(undefined),
    partes.length > 1 ? sha256Hex(partes[partes.length - 1]!) : Promise.resolve(undefined),
    ciudad ? sha256Hex(ciudad) : Promise.resolve(undefined),
    sha256Hex("co"),
    email ? sha256Hex(email) : Promise.resolve(undefined),
    u.externalId ? sha256Hex(normText(u.externalId)) : Promise.resolve(undefined),
  ]);

  return clean({
    ph: ph ? [ph] : undefined,
    fn: fn ? [fn] : undefined,
    ln: ln ? [ln] : undefined,
    ct: ct ? [ct] : undefined,
    country: country ? [country] : undefined,
    em: em ? [em] : undefined,
    external_id: ext ? [ext] : undefined,
    fbp: u.fbp ?? undefined,
    fbc: u.fbc ?? undefined,
    client_ip_address: u.ip ?? undefined,
    client_user_agent: u.userAgent ?? undefined,
  });
}

/** Envía uno o varios eventos al dataset. Nunca lanza. */
export async function sendCapiEvents(
  events: CapiEvent[],
): Promise<{ ok: boolean; error?: string; received?: number }> {
  const token = accessToken();
  if (!token) return { ok: false, error: "missing_token" };
  if (events.length === 0) return { ok: true, received: 0 };

  try {
    const data = await Promise.all(
      events.map(async (e) => ({
        event_name: e.eventName,
        event_id: e.eventId,
        event_time: e.eventTime ?? Math.floor(Date.now() / 1000),
        event_source_url: e.eventSourceUrl ?? undefined,
        action_source: e.actionSource ?? "website",
        user_data: await buildUserData(e.user),
        custom_data: e.customData ? clean(e.customData) : undefined,
      })),
    );

    const body: Record<string, unknown> = { data };
    const testCode = process.env["META_TEST_EVENT_CODE"];
    if (testCode) body["test_event_code"] = testCode;

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${META_DATASET_ID}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const json = (await res.json().catch(() => ({}))) as {
      events_received?: number;
      error?: { message?: string };
    };
    if (!res.ok) {
      console.error("[Meta CAPI] error", res.status, json?.error?.message ?? "");
      return { ok: false, error: json?.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, received: json.events_received ?? data.length };
  } catch (err) {
    console.error("[Meta CAPI] fetch failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

/* ------------------------------------------------------------------ */
/* Dataset Quality API — métricas de calidad del dataset               */
/* ------------------------------------------------------------------ */

export type DatasetQuality = {
  configured: boolean;
  error?: string;
  metrics?: Array<{ event: string; emq?: number | string }>;
};

/** GET /dataset_quality?dataset_id=... (Integration Quality API). */
export async function fetchDatasetQuality(): Promise<DatasetQuality> {
  const token = accessToken();
  if (!token) return { configured: false, error: "missing_token" };
  try {
    const params = new URLSearchParams({
      dataset_id: META_DATASET_ID,
      fields: "web{event_match_quality,event_name}",
      access_token: token,
    });
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/dataset_quality?${params}`);
    const json = (await res.json().catch(() => ({}))) as {
      web?: Array<{ event_name?: string; event_match_quality?: unknown }>;
      error?: { message?: string };
    };
    if (!res.ok) return { configured: true, error: json?.error?.message ?? `HTTP ${res.status}` };
    const metrics = (json.web ?? []).map((row) => {
      const raw = row.event_match_quality as
        | number
        | string
        | { event_match_quality_score?: number; description?: string }
        | undefined;
      const emq =
        typeof raw === "number" || typeof raw === "string"
          ? raw
          : (raw?.event_match_quality_score ?? raw?.description);
      return { event: row.event_name ?? "—", emq };
    });
    return { configured: true, metrics };
  } catch (err) {
    return { configured: true, error: err instanceof Error ? err.message : "unknown" };
  }
}
