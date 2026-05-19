// Server functions: geocoding + reverse geocoding via Lovable Google Maps gateway.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

function getCreds(): { lovable: string; conn: string } | null {
  const lovable = process.env.LOVABLE_API_KEY;
  const conn = process.env.GOOGLE_MAPS_API_KEY_1 || process.env.GOOGLE_MAPS_API_KEY;
  if (!lovable || !conn) return null;
  return { lovable, conn };
}

function authHeaders(c: { lovable: string; conn: string }) {
  return {
    Authorization: `Bearer ${c.lovable}`,
    "X-Connection-Api-Key": c.conn,
  };
}

async function gatewayError(prefix: string, res: Response) {
  if (res.status === 401 || res.status === 403) {
    return `${prefix}: credencial de Google Maps no autorizada (${res.status})`;
  }
  return `${prefix} ${res.status}`;
}

export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ address: z.string().min(3).max(255) }).parse(input),
  )
  .handler(async ({ data }) => {
    const c = getCreds();
    if (!c) return { ok: false as const, error: "Google Maps no configurado" };
    const url = new URL(`${GATEWAY_URL}/maps/api/geocode/json`);
    url.searchParams.set("address", data.address);
    url.searchParams.set("region", "co");
    url.searchParams.set("language", "es");
    try {
      const res = await fetch(url.toString(), { headers: authHeaders(c) });
      if (!res.ok) {
        return { ok: false as const, error: await gatewayError("Geocoding", res) };
      }
      const json = (await res.json()) as {
        status: string;
        results: Array<{
          geometry: { location: { lat: number; lng: number } };
          formatted_address: string;
        }>;
      };
      if (json.status !== "OK" || !json.results.length) {
        return { ok: false as const, error: `Sin resultados (${json.status})` };
      }
      const r = json.results[0];
      return {
        ok: true as const,
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
        label: r.formatted_address,
      };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Error de red",
      };
    }
  });

export const reverseGeocode = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const c = getCreds();
    if (!c) return { ok: false as const, error: "Google Maps no configurado" };
    const url = new URL(`${GATEWAY_URL}/maps/api/geocode/json`);
    url.searchParams.set("latlng", `${data.lat},${data.lng}`);
    url.searchParams.set("language", "es");
    url.searchParams.set("region", "co");
    try {
      const res = await fetch(url.toString(), { headers: authHeaders(c) });
      if (!res.ok) {
        return { ok: false as const, error: await gatewayError("Reverse", res) };
      }
      const json = (await res.json()) as {
        status: string;
        results: Array<{ formatted_address: string }>;
      };
      if (json.status !== "OK" || !json.results.length) {
        return { ok: false as const, error: `Sin resultados (${json.status})` };
      }
      return {
        ok: true as const,
        label: json.results[0].formatted_address,
        lat: data.lat,
        lng: data.lng,
      };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Error de red",
      };
    }
  });
