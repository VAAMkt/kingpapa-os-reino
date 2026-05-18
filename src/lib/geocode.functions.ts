// Server functions: geocoding + reverse geocoding con Google Maps.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function getKey(): string | null {
  return (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY_1 ||
    null
  );
}

export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ address: z.string().min(3).max(255) }).parse(input),
  )
  .handler(async ({ data }) => {
    const key = getKey();
    if (!key) {
      return { ok: false as const, error: "Google Maps no configurado" };
    }
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", data.address);
    url.searchParams.set("region", "co");
    url.searchParams.set("language", "es");
    url.searchParams.set("key", key);
    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        return { ok: false as const, error: `Geocoding ${res.status}` };
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
    const key = getKey();
    if (!key) {
      return { ok: false as const, error: "Google Maps no configurado" };
    }
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${data.lat},${data.lng}`);
    url.searchParams.set("language", "es");
    url.searchParams.set("region", "co");
    url.searchParams.set("key", key);
    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        return { ok: false as const, error: `Reverse ${res.status}` };
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
