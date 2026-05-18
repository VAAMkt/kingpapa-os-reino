import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BrutalCard, BrutalChip } from "@/components/ui-kp/Brutal";
import { BrutalButton, BrutalLink } from "@/components/ui-kp/BrutalButton";
import { listPublicSedes } from "@/lib/sedes";

/**
 * OrderRouter
 * Captura ciudad/sede/canal y dispara deeplink (Rappi/DiDi/WhatsApp).
 */
export function OrderRouter({ compact = false }: { compact?: boolean }) {
  const { data: sedes = [] } = useQuery({
    queryKey: ["sedes", "public"],
    queryFn: listPublicSedes,
    staleTime: 60_000,
  });

  const ciudades = Array.from(new Set(sedes.map((s) => s.ciudad))).sort();
  const [ciudad, setCiudad] = useState<string>("Cali");
  const sedesCiudad = sedes.filter((s) => s.ciudad === ciudad);
  const [sedeId, setSedeId] = useState<string>("");

  useEffect(() => {
    if (sedesCiudad.length && !sedesCiudad.some((s) => s.id === sedeId)) {
      setSedeId(sedesCiudad[0].id);
    }
  }, [sedesCiudad, sedeId]);

  const sede = sedes.find((s) => s.id === sedeId) || sedesCiudad[0];

  const waNumber = sede?.whatsapp || "573172455336";
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(
    `Quiero pedir en ${sede?.nombre ?? "KINGPAPA"}. Soy súbdito del Reino.`,
  )}`;

  const rappiUrl = "https://www.rappi.com.co/restaurantes/kingpapa";
  const didiUrl = "https://web.didi-food.com/co";

  return (
    <BrutalCard tone="yellow" className={compact ? "p-4" : "p-5 md:p-7"}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-2xl md:text-3xl uppercase">
          ¿Dónde estás parchando hoy?
        </h3>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {ciudades.map((c) => (
          <BrutalChip key={c} active={ciudad === c} onClick={() => setCiudad(c)}>
            {c}
          </BrutalChip>
        ))}
      </div>

      <label className="block text-xs font-display uppercase tracking-wider mb-2">Sede</label>
      <select
        value={sedeId}
        onChange={(e) => setSedeId(e.target.value)}
        className="w-full px-3 py-3 bg-kp-cheese border-2 border-kp-ink shadow-brutal-sm font-body mb-4"
      >
        {sedesCiudad.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre} — {s.barrio || s.mall || s.direccion}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <BrutalLink href={rappiUrl} external variant="fire" size="md" block>
          Pedir por Rappi
        </BrutalLink>
        <BrutalLink href={didiUrl} external variant="neon" size="md" block>
          Pedir por DiDi
        </BrutalLink>
        <BrutalLink href={waUrl} external variant="dark" size="md" block>
          WhatsApp al Reino
        </BrutalLink>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <BrutalButton variant="ghost" size="md" block>
          Pedir directo al Reino
        </BrutalButton>
        <BrutalButton variant="ghost" size="md" block>
          Recoger en sede
        </BrutalButton>
      </div>
    </BrutalCard>
  );
}
