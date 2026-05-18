import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordForm } from "@/components/auth/AuthForms";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Nueva contraseña — KINGPAPA OS" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  return (
    <section className="mx-auto max-w-md px-4 py-12">
      <ResetPasswordForm />
    </section>
  );
}
