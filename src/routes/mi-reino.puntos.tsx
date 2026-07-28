import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import {
  getMyLoyalty,
  listRewards,
  redeemReward,
  listMyRedemptions,
  NEXT_TIER,
} from "@/lib/loyalty.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/mi-reino/puntos")({
  component: Puntos,
});

function Puntos() {
  const loyFn = useServerFn(getMyLoyalty);
  const rewFn = useServerFn(listRewards);
  const redFn = useServerFn(listMyRedemptions);
  const redeem = useServerFn(redeemReward);
  const qc = useQueryClient();

  const { data: loyalty } = useQuery({ queryKey: ["my-loyalty"], queryFn: () => loyFn() });
  const { data: rewards } = useQuery({ queryKey: ["rewards"], queryFn: () => rewFn() });
  const { data: reds } = useQuery({ queryKey: ["my-redemptions"], queryFn: () => redFn() });

  const canjear = useMutation({
    mutationFn: (reward_id: string) => redeem({ data: { reward_id } }),
    onSuccess: (r) => {
      toast.success(`¡Coronado! Tu código: ${r.codigo}`, { duration: 8000 });
      qc.invalidateQueries({ queryKey: ["my-loyalty"] });
      qc.invalidateQueries({ queryKey: ["my-redemptions"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo canjear"),
  });

  const bal = loyalty?.account.puntos_balance ?? 0;
  const life = loyalty?.account.puntos_lifetime ?? 0;
  const tier = loyalty?.account.tier ?? "parcero";
  const next = NEXT_TIER[tier];
  const pct = next ? Math.min(100, Math.round((life / next.target) * 100)) : 100;

  return (
    <div className="space-y-5">
      <BrutalCard tone="purple" className="p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <BrutalBadge tone="yellow">Puntos del Reino</BrutalBadge>
            <p className="font-display text-6xl leading-none mt-2">{bal}</p>
            <p className="text-xs mt-1">
              Lifetime: {life} pts · Tier: {tier.toUpperCase()}
            </p>
          </div>
          <span className="text-5xl">👑</span>
        </div>
        <div className="mt-4">
          <div className="h-3 border-2 border-kp-ink bg-kp-cheese overflow-hidden">
            <div className="h-full bg-kp-yellow" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs mt-1">
            {next
              ? `${life}/${next.target} pts para ${next.name.toUpperCase()}`
              : "Corona máxima 👑"}
          </p>
        </div>
      </BrutalCard>

      <section>
        <h2 className="font-display text-2xl uppercase mb-3">Canjea tu botín</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {(rewards ?? []).map((r) => {
            const puede = bal >= r.costo_puntos;
            return (
              <BrutalCard key={r.id} tone="cheese" className="p-4 flex flex-col">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="font-display text-lg uppercase leading-tight">{r.nombre}</h3>
                    {r.descripcion && (
                      <p className="text-xs mt-1 text-kp-ink/70">{r.descripcion}</p>
                    )}
                  </div>
                  <BrutalBadge tone="yellow">{r.costo_puntos} pts</BrutalBadge>
                </div>
                <BrutalButton
                  block
                  size="sm"
                  className="mt-3"
                  variant={puede ? "primary" : "ghost"}
                  disabled={!puede || canjear.isPending}
                  onClick={() => canjear.mutate(r.id)}
                >
                  {puede ? "Canjear" : `Te faltan ${r.costo_puntos - bal} pts`}
                </BrutalButton>
              </BrutalCard>
            );
          })}
          {(rewards ?? []).length === 0 && (
            <BrutalCard tone="cheese" className="p-4">
              <p className="text-sm">Pronto habrá premios acá. La banda no se aguanta.</p>
            </BrutalCard>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl uppercase mb-3">Mis códigos</h2>
        <div className="space-y-2">
          {(reds ?? []).length === 0 && (
            <p className="text-sm text-kp-ink/60">Todavía no has canjeado nada.</p>
          )}
          {(reds ?? []).map((r) => (
            <BrutalCard
              key={r.id}
              tone="cheese"
              className="p-3 flex flex-wrap justify-between items-center gap-2"
            >
              <div>
                <p className="font-display uppercase text-sm">{r.reward?.nombre ?? "Recompensa"}</p>
                <p className="text-xs text-kp-ink/60">
                  Vence: {new Date(r.expires_at).toLocaleDateString("es-CO")} · Estado: {r.status}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(r.codigo);
                  toast.success("Código copiado");
                }}
                className="font-mono text-sm border-2 border-kp-ink bg-kp-yellow px-3 py-2 shadow-brutal-sm"
              >
                {r.codigo}
              </button>
            </BrutalCard>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl uppercase mb-3">Movimientos</h2>
        <BrutalCard tone="cheese" className="p-3">
          {(loyalty?.ledger ?? []).length === 0 && (
            <p className="text-sm text-kp-ink/60">Sin movimientos todavía.</p>
          )}
          <ul className="divide-y-2 divide-kp-ink/10">
            {(loyalty?.ledger ?? []).map((l) => (
              <li key={l.id} className="py-2 flex justify-between text-sm">
                <div className="min-w-0">
                  <p className="truncate">{l.motivo}</p>
                  <p className="text-xs text-kp-ink/60">
                    {new Date(l.created_at).toLocaleString("es-CO", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <span
                  className={`font-mono font-bold ${l.puntos < 0 ? "text-kp-red" : "text-green-700"}`}
                >
                  {l.puntos > 0 ? "+" : ""}
                  {l.puntos}
                </span>
              </li>
            ))}
          </ul>
        </BrutalCard>
      </section>
    </div>
  );
}
