// Server function: geocodificar dirección con Google Maps Geocoding API.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ address: z.string().min(3).max(255) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
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
