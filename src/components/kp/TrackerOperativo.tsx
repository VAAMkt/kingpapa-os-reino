import { useEffect, useState } from "react";
import { BrutalCard } from "@/components/ui-kp/Brutal";

const pasos = [
  { label: "Freímos tus papas", emoji: "🍟" },
  { label: "Bañamos en queso", emoji: "🧀" },
  { label: "Coronamos con chicharrón", emoji: "👑" },
  { label: "El motorizado salió del Reino", emoji: "🛵" },
];

/**
 * TrackerOperativo — demo visual del Pizza Tracker style.
 * TODO: alimentar con estado real del pedido vía WS o polling.
 */
export function TrackerOperativo() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setStep((s) => (s + 1) % (pasos.length + 1)), 1800);
    return () => clearInterval(i);
  }, []);

  const progreso = Math.min((step / pasos.length) * 100, 100);

  return (
    <BrutalCard tone="black" className="p-5 md:p-7">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-2xl md:text-3xl text-kp-yellow uppercase">
          Tu Reino en camino
        </h3>
        <span className="text-xs font-display uppercase text-kp-cheese/70">
          demo en vivo
        </span>
      </div>

      <div className="h-4 bg-kp-cheese border-2 border-kp-cheese mb-5 overflow-hidden">
        <div
          className="h-full bg-kp-yellow transition-all duration-700"
          style={{ width: `${progreso}%` }}
        />
      </div>

      <ol className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {pasos.map((p, idx) => {
          const done = idx < step;
          const active = idx === step - 1;
          return (
            <li
              key={p.label}
              className={`border-2 p-3 text-center transition-colors ${
                done || active
                  ? "bg-kp-yellow text-kp-ink border-kp-yellow"
                  : "bg-transparent text-kp-cheese border-kp-cheese/40"
              }`}
            >
              <div className="text-2xl mb-1">{p.emoji}</div>
              <span className="block font-display uppercase text-xs leading-tight">
                {p.label}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-kp-cheese/70 mt-4">
        Tranquilo papi, el motorizado ya está coronando tu cuadra.
      </p>
    </BrutalCard>
  );
}
