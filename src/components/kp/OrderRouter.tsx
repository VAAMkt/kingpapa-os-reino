import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BrutalCard, BrutalChip } from "@/components/ui-kp/Brutal";
import { BrutalLink } from "@/components/ui-kp/BrutalButton";
import { listPublicSedes } from "@/lib/sedes";

/**
 * OrderRouter
 * Jerarquía: pedido directo (CTA principal) > recoger en sede > apps de terceros colapsadas.
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

  const checkoutDirecto = "/checkout";
  const checkoutRecoger = `/checkout?modo=recoger${sede?.slug ? `&sede=${sede.slug}` : ""}`;

  return (
    <BrutalCard tone="yellow" className={compact ? "p-4" : "p-5 md:p-7"}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-2xl md:text-3xl uppercase">¿Dónde estás parchando hoy?</h3>
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

      {/* CTA primario */}
      <BrutalLink href={checkoutDirecto} variant="fire" size="lg" block>
        Pedir directo al Reino
      </BrutalLink>

      {/* CTA secundario */}
      <div className="mt-3">
        <BrutalLink href={checkoutRecoger} variant="ghost" size="md" block>
          Recoger en sede
        </BrutalLink>
      </div>

      {/* Apps de terceros: colapsado, fallback */}
      <details className="mt-5 border-t-2 border-kp-ink/20 pt-3 group">
        <summary className="cursor-pointer font-display uppercase text-xs tracking-wider text-kp-ink/70 list-none flex items-center justify-between">
          <span>También estamos en apps</span>
          <span aria-hidden className="transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
          <BrutalLink href={rappiUrl} external variant="ghost" size="sm" block>
            Rappi
          </BrutalLink>
          <BrutalLink href={didiUrl} external variant="ghost" size="sm" block>
            DiDi
          </BrutalLink>
          <BrutalLink href={waUrl} external variant="ghost" size="sm" block>
            WhatsApp
          </BrutalLink>
        </div>
        <p className="mt-3 text-[10px] font-body text-kp-ink/60 leading-tight">
          Tip: pedir directo te suma puntos del Reino y evita comisiones.
        </p>
      </details>
    </BrutalCard>
  );
}
