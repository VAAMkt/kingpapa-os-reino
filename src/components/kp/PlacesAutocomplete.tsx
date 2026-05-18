// Autocomplete con Places API (New) — usa AutocompleteSuggestion + sessionToken.
// Devuelve {lat, lng, label} al seleccionar una sugerencia.
import { useEffect, useMemo, useRef, useState } from "react";
import { BrutalInput } from "@/components/ui-kp/Brutal";
import { loadGoogleMaps } from "@/lib/google-maps";

type Suggestion = {
  placeId: string;
  text: string;
};

export function PlacesAutocomplete({
  onPick,
  placeholder = "Ej. Av 9N #15-30, Cali",
}: {
  onPick: (p: { lat: number; lng: number; label: string }) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const sessionTokenRef = useRef<any>(null);
  const debounceRef = useRef<number | null>(null);
  const placesLibRef = useRef<any>(null);

  // Carga + sessionToken
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(async () => {
        if (cancelled || !window.google) return;
        const places = await window.google.maps.importLibrary("places");
        if (cancelled) return;
        placesLibRef.current = places;
        sessionTokenRef.current = new places.AutocompleteSessionToken();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchSuggestions = useMemo(
    () => async (q: string) => {
      const places = placesLibRef.current;
      if (!places || q.trim().length < 3) {
        setSuggestions([]);
        return;
      }
      setLoading(true);
      try {
        const { suggestions: res } =
          await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: q,
            sessionToken: sessionTokenRef.current,
            includedRegionCodes: ["co"],
            language: "es",
          });
        const list: Suggestion[] = (res ?? [])
          .map((s: any) => s.placePrediction)
          .filter(Boolean)
          .map((p: any) => ({
            placeId: p.placeId,
            text: p.text?.text ?? "",
          }));
        setSuggestions(list);
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  function onChange(v: string) {
    setInput(v);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => fetchSuggestions(v), 250);
  }

  async function pickSuggestion(s: Suggestion) {
    const places = placesLibRef.current;
    if (!places) return;
    setInput(s.text);
    setOpen(false);
    try {
      const place = new places.Place({ id: s.placeId });
      await place.fetchFields({
        fields: ["location", "formattedAddress"],
      });
      const loc = place.location;
      if (!loc) return;
      onPick({
        lat: typeof loc.lat === "function" ? loc.lat() : loc.lat,
        lng: typeof loc.lng === "function" ? loc.lng() : loc.lng,
        label: place.formattedAddress ?? s.text,
      });
      // Reciclar sessionToken tras un pick
      sessionTokenRef.current = new places.AutocompleteSessionToken();
    } catch {
      /* silencio */
    }
  }

  return (
    <div className="relative">
      <BrutalInput
        value={input}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && (loading || suggestions.length > 0) && (
        <ul className="absolute z-20 mt-1 left-0 right-0 bg-kp-cheese border-2 border-kp-ink shadow-brutal-sm max-h-64 overflow-auto">
          {loading && suggestions.length === 0 && (
            <li className="px-3 py-2 text-xs opacity-60">Buscando…</li>
          )}
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickSuggestion(s)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-kp-yellow border-b border-kp-ink/10 last:border-0"
              >
                {s.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
