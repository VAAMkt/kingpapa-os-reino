import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { BrutalCard, BrutalBadge, BrutalInput } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import { GateMap } from "@/components/kp/GateMap";
import { PlacesAutocomplete } from "@/components/kp/PlacesAutocomplete";
import { listPublicSedes } from "@/lib/sedes";
import {
  useActiveSede,
  setActiveSede,
  setExploringSede,
  pickNearestSede,
  type NearestResult,
} from "@/lib/active-sede";
import { reverseGeocode } from "@/lib/geocode.functions";
import { emitGateConfirmed } from "@/lib/pending-intent";

type LatLng = { lat: number; lng: number };

export function LocationGate() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  // NO auto-open. Solo abre por evento explícito.
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("kp:open-location-gate", handler);
    return () => window.removeEventListener("kp:open-location-gate", handler);
  }, []);

  if (!mounted) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto border-2 border-kp-ink bg-kp-yellow p-0">
        <DialogTitle className="sr-only">Elige tu ubicación</DialogTitle>
        <DialogDescription className="sr-only">
          Busca tu dirección, usa tu GPS o arrastra el pin en el mapa para precisar.
        </DialogDescription>
        <GateBody onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function openLocationGate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("kp:open-location-gate"));
  }
}

function GateBody({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const sedesQ = useQuery({
    queryKey: ["sedes", "public"],
    queryFn: listPublicSedes,
    staleTime: 60_000,
  });
  const sedes = sedesQ.data ?? [];

  const reverseFn = useServerFn(reverseGeocode);

  const [loadingGps, setLoadingGps] = useState(false);

  const [pin, setPin] = useState<LatLng | null>(null);
  const [pinLabel, setPinLabel] = useState<string>("");
  const [detalles, setDetalles] = useState<string>("");
  const [reversing, setReversing] = useState(false);

  const [pendingPickup, setPendingPickup] = useState<NearestResult | null>(null);

  function explorar() {
    if (sedes.length === 0) {
      toast.error("Aún no hay sedes publicadas");
      return;
    }
    setExploringSede(sedes[0]);
    qc.invalidateQueries({ queryKey: ["menu"] });
    onDone();
  }

  function confirm(
    result: NearestResult,
    source: "gps" | "address" | "manual",
    label: string,
    pinPos: LatLng,
  ) {
    setActiveSede({
      sedeId: result.sede.id,
      slug: result.sede.slug,
      label,
      source,
      distanciaKm: Math.round(result.distanciaKm * 10) / 10,
      enCobertura: result.enCobertura,
      ts: Date.now(),
      lat: pinPos.lat,
      lng: pinPos.lng,
      direccionTexto: pinLabel || label,
      detalles: detalles || undefined,
    });
    qc.invalidateQueries({ queryKey: ["menu"] });
    setPendingPickup(null);
    onDone();
    emitGateConfirmed();
    toast.success(
      result.enCobertura
        ? `Listo: tu sede es ${result.sede.nombre}`
        : `Recogerás en ${result.sede.nombre}`,
    );
  }

  function pickupOnly(source: "gps" | "address" | "manual", pinPos: LatLng) {
    if (sedes.length === 0) {
      toast.error("No hay sedes disponibles");
      return;
    }
    const nearest = pickNearestSede(pinPos, sedes);
    const fallback = nearest?.sede ?? sedes[0];
    setActiveSede({
      sedeId: fallback.id,
      slug: fallback.slug,
      label: `Recoger en ${fallback.nombre}`,
      source,
      distanciaKm: nearest ? Math.round(nearest.distanciaKm * 10) / 10 : undefined,
      enCobertura: false,
      ts: Date.now(),
      lat: pinPos.lat,
      lng: pinPos.lng,
      direccionTexto: pinLabel,
      detalles: detalles || undefined,
    });
    qc.invalidateQueries({ queryKey: ["menu"] });
    onDone();
    emitGateConfirmed();
    toast.success(`Recogerás en ${fallback.nombre}`);
  }

  async function updatePin(p: LatLng) {
    setPin(p);
    setReversing(true);
    try {
      const r = await reverseFn({ data: p });
      if (r.ok) {
        setPinLabel(r.label);
      } else {
        toast.error("No pudimos detectar la dirección, escríbela manualmente");
      }
    } finally {
      setReversing(false);
    }
  }

  function confirmCurrentPin(source: "gps" | "address" | "manual") {
    if (!pin) return;
    const r = pickNearestSede(pin, sedes);
    if (!r) {
      pickupOnly(source, pin);
      return;
    }
    if (r.enCobertura) confirm(r, source, pinLabel || "Mi ubicación", pin);
    else setPendingPickup(r);
  }

  function useGps() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización");
      return;
    }
    setLoadingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoadingGps(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        updatePin(p);
      },
      (err) => {
        setLoadingGps(false);
        toast.error(`No pudimos leer tu ubicación: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  if (pendingPickup) {
    return (
      <div className="p-6">
        <BrutalBadge tone="red">Fuera de cobertura</BrutalBadge>
        <h2 className="font-display text-3xl uppercase leading-none mt-3">
          Aún no llegamos a tu reino
        </h2>
        <p className="mt-2 text-sm">
          La sede más cercana es <strong>{pendingPickup.sede.nombre}</strong> a{" "}
          {pendingPickup.distanciaKm.toFixed(1)} km. Puedes recoger ahí o probar otra dirección.
        </p>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BrutalButton
            variant="dark"
            onClick={() =>
              pin &&
              confirm(pendingPickup, "manual", `Recoger en ${pendingPickup.sede.nombre}`, pin)
            }
            block
          >
            Pedir para recoger
          </BrutalButton>
          <BrutalButton variant="ghost" onClick={() => setPendingPickup(null)} block>
            Cambiar dirección
          </BrutalButton>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <BrutalBadge tone="black">Tu ubicación</BrutalBadge>
        <h2 className="font-display text-3xl md:text-4xl uppercase leading-none mt-2">
          ¿Dónde te llevamos la corona?
        </h2>
        <p className="mt-1 text-sm">
          Te asignamos la sede más cercana para precios reales y tiempos.
        </p>
      </div>

      <div className="space-y-2">
        <label className="block font-display uppercase text-xs">Busca tu dirección</label>
        <PlacesAutocomplete
          onPick={(p) => {
            setPinLabel(p.label);
            setPin({ lat: p.lat, lng: p.lng });
          }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <BrutalButton variant="fire" size="lg" onClick={useGps} disabled={loadingGps} block>
          {loadingGps ? "Leyendo GPS…" : "📍 Usar mi GPS"}
        </BrutalButton>
        <BrutalButton variant="ghost" size="lg" onClick={explorar} block>
          Solo explorar la carta
        </BrutalButton>
      </div>

      {loadingGps && <Skeleton className="w-full h-56 border-2 border-kp-ink" />}

      {pin && !loadingGps && (
        <>
          <GateMap center={pin} onPinChange={updatePin} />
          <div className="space-y-2">
            <label className="block font-display uppercase text-xs">
              Dirección detectada {reversing && <span className="opacity-60">· actualizando…</span>}
            </label>
            <BrutalInput
              value={pinLabel}
              onChange={(e) => setPinLabel(e.target.value)}
              placeholder="Dirección"
            />
            <BrutalInput
              value={detalles}
              onChange={(e) => setDetalles(e.target.value)}
              placeholder="Detalles (Apto 302, casa esquinera, torre B…)"
            />
          </div>
          <BrutalButton variant="fire" size="lg" block onClick={() => confirmCurrentPin("manual")}>
            Confirmar ubicación
          </BrutalButton>
        </>
      )}

      {!pin && (
        <BrutalCard tone="cheese" className="p-3">
          <p className="text-xs">
            Tenemos {sedes.length} sede{sedes.length === 1 ? "" : "s"} activas. Busca tu dirección,
            usa GPS o sigue explorando la carta.
          </p>
        </BrutalCard>
      )}
    </div>
  );
}
