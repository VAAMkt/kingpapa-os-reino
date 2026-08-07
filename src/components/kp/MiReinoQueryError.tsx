import { BrutalCard } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";

export function MiReinoQueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <BrutalCard tone="yellow" className="p-6 text-center">
      <p className="font-display text-xl uppercase">No pudimos cargar tu Reino</p>
      <p className="mt-1 text-sm">Tus datos siguen seguros. Intenta conectarte de nuevo.</p>
      <BrutalButton className="mt-4" onClick={onRetry}>
        Reintentar
      </BrutalButton>
    </BrutalCard>
  );
}
