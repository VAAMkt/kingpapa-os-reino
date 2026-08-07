import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordForm } from "@/components/auth/AuthForms";
import { BrutalCard } from "@/components/ui-kp/Brutal";
import { BrutalLink } from "@/components/ui-kp/BrutalButton";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nueva contraseña — KINGPAPA OS" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { loading, isAuthenticated } = useAuth();
  if (loading) {
    return (
      <section className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="font-display uppercase">Validando enlace…</p>
      </section>
    );
  }
  if (!isAuthenticated) {
    return (
      <section className="mx-auto max-w-md px-4 py-12">
        <BrutalCard tone="yellow" className="p-6 text-center">
          <h1 className="font-display text-3xl uppercase">Enlace inválido o vencido</h1>
          <p className="mt-2 text-sm">Solicita un enlace nuevo para recuperar tu cuenta.</p>
          <BrutalLink href="/login" className="mt-4">
            Solicitar otro enlace
          </BrutalLink>
        </BrutalCard>
      </section>
    );
  }
  return (
    <section className="mx-auto max-w-md px-4 py-12">
      <ResetPasswordForm />
    </section>
  );
}
