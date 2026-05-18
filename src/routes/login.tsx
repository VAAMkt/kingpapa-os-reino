import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { LoginForm } from "@/components/auth/AuthForms";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "/mi-reino",
  }),
  head: () => ({
    meta: [
      { title: "Iniciar sesión — KINGPAPA OS" },
      { name: "description", content: "Entra al Reino: pide, acumula puntos y desbloquea combos secretos." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { isAuthenticated, loading } = useAuth();
  const { redirect } = useSearch({ from: "/login" });
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated) navigate({ to: redirect });
  }, [loading, isAuthenticated, redirect, navigate]);

  return (
    <section className="mx-auto max-w-md px-4 py-12">
      <LoginForm redirectTo={redirect} />
    </section>
  );
}
