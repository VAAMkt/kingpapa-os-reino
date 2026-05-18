import { useState } from "react";
import { BrutalCard, BrutalChip } from "@/components/ui-kp/Brutal";
import { BrutalButton, BrutalLink } from "@/components/ui-kp/BrutalButton";
import { sedes, ciudades } from "@/data/sedes";
import type { Ciudad } from "@/types/kp";

/**
 * OrderRouter
 * Captura: ciudad, sede, canal de pedido.
 * Dispara: deeplink a Rappi/DiDi, WhatsApp, flujo propio (mock).
 * TODO: reemplazar URLs por deeplinks reales por sede.
 * TODO: enviar evento a analítica { canal, sede, ts }.
 */
export function OrderRouter({ compact = false }: { compact?: boolean }) {
  const [ciudad, setCiudad] = useState<Ciudad>("Cali");
  const sedesCiudad = sedes.filter((s) => s.ciudad === ciudad);
  const [sedeId, setSedeId] = useState<string>(sedesCiudad[0]?.id || "");
  const sede = sedes.find((s) => s.id === sedeId) || sedesCiudad[0];

  const waNumber = sede?.whatsapp || "573000000000";
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(
    `Quiero pedir en ${sede?.nombre}. Soy súbdito del Reino.`,
  )}`;

  // TODO: deeplinks reales
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
          <BrutalChip
            key={c}
            active={ciudad === c}
            onClick={() => {
              setCiudad(c);
              const first = sedes.find((s) => s.ciudad === c);
              if (first) setSedeId(first.id);
            }}
          >
            {c}
          </BrutalChip>
        ))}
      </div>

      <label className="block text-xs font-display uppercase tracking-wider mb-2">
        Sede
      </label>
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
        <BrutalButton variant="ghost" size="md" block onClick={() => {/* TODO: flujo propio */}}>
          Pedir directo al Reino
        </BrutalButton>
        <BrutalButton variant="ghost" size="md" block onClick={() => {/* TODO: pickup */}}>
          Recoger en sede
        </BrutalButton>
      </div>
    </BrutalCard>
  );
}
