import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { SignupForm } from "@/components/auth/AuthForms";

export const Route = createFileRoute("/registro")({
  head: () => ({
    meta: [
      { title: "Coronarme — KINGPAPA OS" },
      {
        name: "description",
        content: "Hazte súbdito del Reino: combos secretos, retos y premios por frecuencia.",
      },
      { property: "og:title", content: "Coronarme — KINGPAPA OS" },
      {
        property: "og:description",
        content: "Creá tu cuenta KINGPAPA y empezá a sumar puntos, retos y premios del Reino.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RegistroPage,
});

function RegistroPage() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated) navigate({ to: "/mi-reino" });
  }, [loading, isAuthenticated, navigate]);

  return (
    <section className="mx-auto max-w-md px-4 py-12">
      <SignupForm />
    </section>
  );
}
