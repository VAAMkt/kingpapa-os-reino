// SERVER-ONLY: cotización de domicilio (distancia vial + tarifa por sede).
// Usa la Routes API de Google Maps a través del gateway de Lovable.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export type SedeFeeConfig = {
  delivery_base_fee: number;
  delivery_base_distance_km: number;
  delivery_extra_km_fee: number;
};

export type QuoteResult =
  | {
      ok: true;
      deliveryFee: number;
      distanceKm: number;
      currency: "COP";
      sedeId: string;
      sedeNombre: string;
      ciudad: string;
      base: number;
      extraKmFee: number;
      baseDistanceKm: number;
    }
  | {
      ok: false;
      code:
        | "OUT_OF_COVERAGE"
        | "ROUTES_UNAVAILABLE"
        | "SEDE_NOT_FOUND"
        | "SEDE_NO_DELIVERY"
        | "SEDE_NO_COORDS"
        | "SEDE_NO_FEE"
        | "INVALID_DEST";
      message: string;
      distanceKm?: number;
    };

function computeFee(distanceKm: number, s: SedeFeeConfig): number {
  const extra = Math.max(0, Math.ceil(distanceKm - s.delivery_base_distance_km));
  const raw = Number(s.delivery_base_fee) + extra * Number(s.delivery_extra_km_fee);
  return Math.round(raw / 100) * 100; // redondeo a $100 más cercano
}

export function computeDeliveryFee(distanceKm: number, s: SedeFeeConfig): number {
  return computeFee(distanceKm, s);
}

async function routeDistanceKm(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
): Promise<number | null> {
  const lovable = process.env.LOVABLE_API_KEY;
  const conn = process.env.GOOGLE_MAPS_API_KEY_1 || process.env.GOOGLE_MAPS_API_KEY;
  if (!lovable || !conn) return null;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 4_000);
  try {
    const res = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": conn,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: {
          location: { latLng: { latitude: dest.lat, longitude: dest.lng } },
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
      }),
    });
    if (!res.ok) {
      console.error(
        `[delivery-quote] Routes API ${res.status}: ${await res.text().catch(() => "")}`,
      );
      return null;
    }
    const json = (await res.json()) as {
      routes?: Array<{ distanceMeters?: number }>;
    };
    const meters = json.routes?.[0]?.distanceMeters;
    if (typeof meters !== "number" || meters <= 0) return null;
    return meters / 1000;
  } catch (err) {
    console.error("[delivery-quote] Routes API error:", err);
    return null;
  } finally {
    clearTimeout(t);
  }
}

export type QuoteInput = {
  sedeId: string;
  tipo: "delivery" | "pickup";
  destino: { lat: number; lng: number };
};

type SedeQuoteRow = {
  id: string;
  nombre: string;
  ciudad: string;
  lat: number | string | null;
  lng: number | string | null;
  cobertura_radio_km: number | string | null;
  delivery: boolean | null;
  kill_switch: boolean | null;
  delivery_base_fee: number | string | null;
  delivery_base_distance_km: number | string | null;
  delivery_extra_km_fee: number | string | null;
  delivery_max_distance_km: number | string | null;
};

export async function quoteDeliveryInternal(input: QuoteInput): Promise<QuoteResult> {
  const { data: raw, error } = await supabaseAdmin
    .from("sedes")
    .select(
      "id, nombre, ciudad, lat, lng, cobertura_radio_km, delivery, kill_switch, delivery_base_fee, delivery_base_distance_km, delivery_extra_km_fee, delivery_max_distance_km",
    )
    .eq("id", input.sedeId)
    .maybeSingle();
  if (error || !raw) {
    return { ok: false, code: "SEDE_NOT_FOUND", message: "Sede no encontrada" };
  }
  const sede = raw as unknown as SedeQuoteRow;

  if (input.tipo === "pickup") {
    return {
      ok: true,
      deliveryFee: 0,
      distanceKm: 0,
      currency: "COP",
      sedeId: sede.id,
      sedeNombre: sede.nombre,
      ciudad: sede.ciudad,
      base: 0,
      extraKmFee: 0,
      baseDistanceKm: 0,
    };
  }

  if (sede.delivery === false || sede.kill_switch === true) {
    return {
      ok: false,
      code: "SEDE_NO_DELIVERY",
      message: `"${sede.nombre}" no ofrece domicilio hoy.`,
    };
  }
  if (sede.lat == null || sede.lng == null) {
    return {
      ok: false,
      code: "SEDE_NO_COORDS",
      message: `"${sede.nombre}" no tiene ubicación configurada.`,
    };
  }
  if (sede.delivery_base_fee == null || Number(sede.delivery_base_fee) <= 0) {
    return {
      ok: false,
      code: "SEDE_NO_FEE",
      message: `"${sede.nombre}" no tiene tarifa de domicilio configurada.`,
    };
  }
  if (
    !Number.isFinite(input.destino.lat) ||
    !Number.isFinite(input.destino.lng) ||
    Math.abs(input.destino.lat) < 0.0001
  ) {
    return { ok: false, code: "INVALID_DEST", message: "Dirección no válida." };
  }

  const config: SedeFeeConfig = {
    delivery_base_fee: Number(sede.delivery_base_fee),
    delivery_base_distance_km: Number(sede.delivery_base_distance_km ?? 1),
    delivery_extra_km_fee: Number(sede.delivery_extra_km_fee ?? 1200),
  };

  const distanceKm = await routeDistanceKm(
    { lat: Number(sede.lat), lng: Number(sede.lng) },
    input.destino,
  );
  if (distanceKm == null) {
    return {
      ok: false,
      code: "ROUTES_UNAVAILABLE",
      message: "No pudimos calcular el domicilio. Intenta nuevamente.",
    };
  }

  const maxKm =
    sede.delivery_max_distance_km != null
      ? Number(sede.delivery_max_distance_km)
      : Number(sede.cobertura_radio_km ?? 5);
  if (distanceKm > maxKm) {
    return {
      ok: false,
      code: "OUT_OF_COVERAGE",
      message: `Esta dirección está a ~${distanceKm.toFixed(1)} km de "${sede.nombre}" (máx ${maxKm} km).`,
      distanceKm,
    };
  }

  const deliveryFee = computeFee(distanceKm, config);
  return {
    ok: true,
    deliveryFee,
    distanceKm,
    currency: "COP",
    sedeId: sede.id,
    sedeNombre: sede.nombre,
    ciudad: sede.ciudad,
    base: config.delivery_base_fee,
    extraKmFee: config.delivery_extra_km_fee,
    baseDistanceKm: config.delivery_base_distance_km,
  };
}
