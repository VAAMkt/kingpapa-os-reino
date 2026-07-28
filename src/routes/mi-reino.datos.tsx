import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import { useAuth } from "@/hooks/useAuth";
import { getMyProfile, updateMyProfile } from "@/lib/mi-reino.functions";
import { getMyLoyalty } from "@/lib/loyalty.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/mi-reino/datos")({
  component: Datos,
});

function Datos() {
  const { user } = useAuth();
  const profFn = useServerFn(getMyProfile);
  const loyFn = useServerFn(getMyLoyalty);
  const updFn = useServerFn(updateMyProfile);
  const qc = useQueryClient();

  const { data: profile } = useQuery({ queryKey: ["my-profile"], queryFn: () => profFn() });
  const { data: loyalty } = useQuery({ queryKey: ["my-loyalty"], queryFn: () => loyFn() });

  const [name, setName] = useState("");
  const [wa, setWa] = useState("");
  const [ciudad, setCiudad] = useState("");
  useEffect(() => {
    if (profile) {
      setName(profile.display_name ?? "");
      setWa(profile.whatsapp ?? "");
      setCiudad(profile.ciudad ?? "");
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: () => updFn({ data: { display_name: name, whatsapp: wa, ciudad } }),
    onSuccess: () => {
      toast.success("¡Datos coronados!");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
  });

  const code = loyalty?.account.referral_code ?? "";
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/?ref=${code}` : "";

  return (
    <div className="space-y-4">
      <BrutalCard tone="cheese" className="p-6 space-y-3">
        <BrutalBadge tone="lime">Mis datos</BrutalBadge>
        <p className="text-xs text-kp-ink/60">Email: {user?.email}</p>
        <div className="grid gap-3">
          <label className="text-sm font-display uppercase">
            Nombre
            <input
              className="mt-1 w-full border-2 border-kp-ink bg-white px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
          </label>
          <label className="text-sm font-display uppercase">
            WhatsApp
            <input
              className="mt-1 w-full border-2 border-kp-ink bg-white px-3 py-2"
              value={wa}
              onChange={(e) => setWa(e.target.value)}
              placeholder="3xx xxx xxxx"
              maxLength={40}
            />
          </label>
          <label className="text-sm font-display uppercase">
            Ciudad
            <input
              className="mt-1 w-full border-2 border-kp-ink bg-white px-3 py-2"
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              maxLength={80}
            />
          </label>
        </div>
        <BrutalButton onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Guardando…" : "Guardar cambios"}
        </BrutalButton>
      </BrutalCard>

      <BrutalCard tone="purple" className="p-6">
        <BrutalBadge tone="yellow">Referidos</BrutalBadge>
        <h3 className="font-display text-2xl uppercase mt-2">Trae a la banda</h3>
        <p className="text-sm mt-1">Comparte tu código y sumen puntos juntos (próximamente).</p>
        <div className="mt-4 flex gap-2 items-center">
          <span className="font-mono text-2xl border-2 border-kp-ink bg-kp-cheese text-kp-ink px-3 py-2 shadow-brutal-sm">
            {code}
          </span>
          <BrutalButton
            size="sm"
            variant="dark"
            onClick={() => {
              navigator.clipboard?.writeText(shareUrl);
              toast.success("Link copiado");
            }}
          >
            Copiar link
          </BrutalButton>
          <BrutalButton
            size="sm"
            variant="dark"
            onClick={() => {
              const msg = `Hablalooo, cuadra pedido en KINGPAPA con mi código ${code}: ${shareUrl}`;
              window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
            }}
          >
            WhatsApp
          </BrutalButton>
        </div>
      </BrutalCard>
    </div>
  );
}
