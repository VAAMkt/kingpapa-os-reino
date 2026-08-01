// Sincronización de reputación (rating + reseñas) desde la API Places (New)
// de Google hacia la tabla `sedes`.
//
// Server-only: usa el cliente admin y el secret GOOGLE_PLACES_API_KEY.
// Cada sede se procesa de forma aislada: un place_id inválido no tumba el resto.

export type SyncSedeResult = {
  sede_id: string;
  nombre: string;
  ok: boolean;
  rating?: number | null;
  reviews?: number | null;
  error?: string;
};

export type SyncSummary = {
  ok: boolean;
  total: number;
  updated: number;
  failed: number;
  results: SyncSedeResult[];
  synced_at: string | null;
};

const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places";

async function fetchPlaceRating(
  placeId: string,
  apiKey: string,
): Promise<{ rating: number | null; reviews: number | null }> {
  const res = await fetch(`${PLACES_ENDPOINT}/${encodeURIComponent(placeId)}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "rating,userRatingCount",
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Places API ${res.status}: ${text.slice(0, 300)}`);
  }
  let json: { rating?: number; userRatingCount?: number };
  try {
    json = JSON.parse(text) as { rating?: number; userRatingCount?: number };
  } catch {
    throw new Error(`Respuesta no JSON de Places API: ${text.slice(0, 200)}`);
  }
  const rating = typeof json.rating === "number" ? Math.round(json.rating * 10) / 10 : null;
  const reviews = typeof json.userRatingCount === "number" ? Math.round(json.userRatingCount) : null;
  if (rating == null && reviews == null) {
    throw new Error("Places API no devolvió rating ni userRatingCount para este place_id");
  }
  return { rating, reviews };
}

/**
 * Sincroniza la reputación de Google.
 * @param sedeId si se pasa, sólo esa sede; si no, todas las que tengan google_place_id.
 */
export async function syncGoogleRatingsCore(sedeId?: string | null): Promise<SyncSummary> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta el secret GOOGLE_PLACES_API_KEY. Créalo con una API key de Google Cloud con Places API (New) habilitada.",
    );
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let query = supabaseAdmin
    .from("sedes")
    .select("id, nombre, google_place_id")
    .not("google_place_id", "is", null);
  if (sedeId) query = query.eq("id", sedeId);

  const { data: sedes, error } = await query;
  if (error) throw new Error(`No se pudieron leer las sedes: ${error.message}`);

  const rows = (sedes ?? []).filter((s) => (s.google_place_id ?? "").trim().length > 0);
  const results: SyncSedeResult[] = [];
  const syncedAt = new Date().toISOString();

  for (const sede of rows) {
    try {
      const { rating, reviews } = await fetchPlaceRating(
        (sede.google_place_id as string).trim(),
        apiKey,
      );
      const { error: upErr } = await supabaseAdmin
        .from("sedes")
        .update({
          google_rating: rating,
          google_reviews_count: reviews,
          google_rating_synced_at: syncedAt,
        })
        .eq("id", sede.id);
      if (upErr) throw new Error(`No se pudo guardar: ${upErr.message}`);
      results.push({ sede_id: sede.id, nombre: sede.nombre, ok: true, rating, reviews });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[google-places] sede ${sede.nombre} (${sede.id}): ${message}`);
      results.push({ sede_id: sede.id, nombre: sede.nombre, ok: false, error: message });
    }
  }

  const updated = results.filter((r) => r.ok).length;
  const failed = results.length - updated;

  // Bitácora (no bloqueante).
  try {
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "google_places_sync",
      ok: failed === 0,
      mensaje: `Google ratings: ${updated} actualizadas, ${failed} con error`,
      payload: { scope: sedeId ? "sede" : "all", results } as never,
    });
  } catch (e) {
    console.error("[google-places] no se pudo escribir rp_sync_log", e);
  }

  return {
    ok: failed === 0,
    total: results.length,
    updated,
    failed,
    results,
    synced_at: updated > 0 ? syncedAt : null,
  };
}
