import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { LoginForm } from "@/components/auth/AuthForms";
import { authRedirect, type AuthRedirect } from "@/lib/auth-validation";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect: AuthRedirect } => ({
    redirect: authRedirect(search.redirect),
  }),
  head: () => ({
    meta: [
      { title: "Iniciar sesión — KINGPAPA OS" },
      {
        name: "description",
        content: "Entra al Reino: pide, acumula puntos y desbloquea combos secretos.",
      },
      { property: "og:title", content: "Iniciar sesión — KINGPAPA OS" },
      {
        property: "og:description",
        content: "Entra a tu cuenta KINGPAPA para pedir más rápido y sumar puntos del Reino.",
      },
      { name: "robots", content: "noindex" },
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
