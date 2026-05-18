import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BrutalCard, BrutalBadge, BrutalInput } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import { listPublicSedes } from "@/lib/sedes";
import {
  useActiveSede,
  setActiveSede,
  pickNearestSede,
  type NearestResult,
} from "@/lib/active-sede";
import { geocodeAddress } from "@/lib/geocode.functions";

export function LocationGate() {
  const active = useActiveSede();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && !active) setOpen(true);
  }, [mounted, active]);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("kp:open-location-gate", handler);
    return () => window.removeEventListener("kp:open-location-gate", handler);
  }, []);

  if (!mounted) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (active) setOpen(v); }}>
      <DialogContent
        className="max-w-lg border-2 border-kp-ink bg-kp-yellow p-0 shadow-brutal [&>button]:hidden"
        onPointerDownOutside={(e) => { if (!active) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (!active) e.preventDefault(); }}
      >
        <DialogTitle className="sr-only">Elige tu ubicación</DialogTitle>
        <DialogDescription className="sr-only">
          Necesitamos tu ubicación para mostrarte la sede más cercana y el menú disponible.
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
  const sedesQ = useQuery({ queryKey: ["sedes", "public"], queryFn: listPublicSedes, staleTime: 60_000 });
  const sedes = sedesQ.data ?? [];

  const geocodeFn = useServerFn(geocodeAddress);
  const [loadingGps, setLoadingGps] = useState(false);
  const [address, setAddress] = useState("");
  const [loadingAddr, setLoadingAddr] = useState(false);
  const [pendingPickup, setPendingPickup] = useState<NearestResult | null>(null);

  function confirm(result: NearestResult, source: "gps" | "address", label: string) {
    setActiveSede({
      sedeId: result.sede.id,
      slug: result.sede.slug,
      label,
      source,
      distanciaKm: Math.round(result.distanciaKm * 10) / 10,
      enCobertura: result.enCobertura,
      ts: Date.now(),
    });
    qc.invalidateQueries({ queryKey: ["menu"] });
    setPendingPickup(null);
    onDone();
    toast.success(result.enCobertura
      ? `Listo: tu sede es ${result.sede.nombre}`
      : `Recogerás en ${result.sede.nombre}`);
  }

  function handlePoint(point: { lat: number; lng: number }, source: "gps" | "address", label: string) {
    const r = pickNearestSede(point, sedes);
    if (!r) {
      toast.error("No tenemos sedes con ubicación cargada todavía");
      return;
    }
    if (r.enCobertura) confirm(r, source, label);
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
        handlePoint(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          "gps",
          "Mi ubicación actual",
        );
      },
      (err) => {
        setLoadingGps(false);
        toast.error(`No pudimos leer tu ubicación: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function searchAddress() {
    if (address.trim().length < 3) return;
    setLoadingAddr(true);
    try {
      const r = await geocodeFn({ data: { address: address.trim() } });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      handlePoint({ lat: r.lat, lng: r.lng }, "address", r.label);
    } finally {
      setLoadingAddr(false);
    }
  }

  if (pendingPickup) {
    return (
      <div className="p-6">
        <BrutalBadge tone="red">Fuera de cobertura</BrutalBadge>
        <h2 className="font-display text-3xl uppercase leading-none mt-3">
          Aún no llegamos a tu reino
        </h2>
        <p className="mt-2 text-sm">
          La sede más cercana es <strong>{pendingPickup.sede.nombre}</strong>
          {" "}a {pendingPickup.distanciaKm.toFixed(1)} km. Puedes recoger ahí o probar otra dirección.
        </p>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BrutalButton
            variant="dark"
            onClick={() => confirm(pendingPickup, "address", `Recoger en ${pendingPickup.sede.nombre}`)}
            block
          >
            Recoger en sede
          </BrutalButton>
          <BrutalButton variant="ghost" onClick={() => setPendingPickup(null)} block>
            Cambiar dirección
          </BrutalButton>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <BrutalBadge tone="black">Paso 1 de 1</BrutalBadge>
      <h2 className="font-display text-3xl md:text-4xl uppercase leading-none mt-3">
        ¿Dónde estás parchando?
      </h2>
      <p className="mt-2 text-sm">
        Te asignamos la sede más cercana para que veas precios reales y tiempos de entrega.
      </p>

      <div className="mt-5 space-y-4">
        <BrutalButton variant="fire" size="lg" onClick={useGps} disabled={loadingGps} block>
          {loadingGps ? "Leyendo GPS…" : "📍 Usar mi ubicación"}
        </BrutalButton>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-[2px] bg-kp-ink" />
          <span className="font-display uppercase text-xs">o</span>
          <div className="flex-1 h-[2px] bg-kp-ink" />
        </div>

        <div className="space-y-2">
          <label className="block font-display uppercase text-xs">Tu dirección</label>
          <BrutalInput
            placeholder="Ej. Av 9N #15-30, Cali"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") searchAddress(); }}
          />
          <BrutalButton
            variant="dark"
            onClick={searchAddress}
            disabled={loadingAddr || address.trim().length < 3}
            block
          >
            {loadingAddr ? "Buscando…" : "Buscar"}
          </BrutalButton>
        </div>
      </div>

      {sedes.length > 0 && (
        <BrutalCard tone="cheese" className="p-3 mt-5">
          <p className="text-xs">
            Tenemos {sedes.length} sede{sedes.length === 1 ? "" : "s"} activas.
          </p>
        </BrutalCard>
      )}
    </div>
  );
}
