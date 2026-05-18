import { createFileRoute, Link } from "@tanstack/react-router";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalLink } from "@/components/ui-kp/BrutalButton";

export const Route = createFileRoute("/no-autorizado")({
  head: () => ({
    meta: [{ title: "Sin acceso al Reino — KINGPAPA OS" }],
  }),
  component: NoAutorizadoPage,
});

function NoAutorizadoPage() {
  return (
    <section className="mx-auto max-w-md px-4 py-16 text-center">
      <BrutalCard tone="red" className="p-8">
        <BrutalBadge tone="black">403</BrutalBadge>
        <h1 className="font-display text-5xl uppercase mt-3 leading-none">No tienes corona</h1>
        <p className="mt-3 text-sm">
          Esta zona del Reino es solo para la nobleza. Si crees que es un error,
          dile al super_admin que te asigne rol.
        </p>
        <div className="mt-6 grid gap-2">
          <BrutalLink href="/mi-reino" variant="primary" block>Ir a Mi Reino</BrutalLink>
          <Link to="/" className="font-display uppercase text-sm underline">Volver al inicio</Link>
        </div>
      </BrutalCard>
    </section>
  );
}
