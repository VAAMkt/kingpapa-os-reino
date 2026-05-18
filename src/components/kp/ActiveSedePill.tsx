import { useActiveSede } from "@/lib/active-sede";
import { openLocationGate } from "@/components/kp/LocationGate";

export function ActiveSedePill() {
  const sede = useActiveSede();
  if (!sede) return null;
  return (
    <button
      onClick={openLocationGate}
      className="inline-flex items-center gap-2 max-w-[280px] px-3 py-1.5 bg-kp-cheese border-2 border-kp-ink shadow-brutal-sm font-display uppercase text-xs hover:-translate-y-[1px] truncate"
      title={sede.label}
    >
      <span>📍</span>
      <span className="truncate">{sede.label}</span>
      <span className="opacity-60">· cambiar</span>
    </button>
  );
}
