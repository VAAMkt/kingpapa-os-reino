import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { BrutalBadge } from "@/components/ui-kp/Brutal";

export const Route = createFileRoute("/mi-reino")({
  head: () => ({
    meta: [{ title: "Mi Reino — KINGPAPA OS" }],
  }),
  component: MiReinoLayout,
});

const tabs = [
  { to: "/mi-reino", label: "Inicio", exact: true },
  { to: "/mi-reino/pedidos", label: "Pedidos" },
  { to: "/mi-reino/puntos", label: "Puntos" },
  { to: "/mi-reino/datos", label: "Datos" },
  { to: "/mi-reino/favoritos", label: "Favoritos" },
] as const;

function MiReinoLayout() {
  const { isAuthenticated, loading, user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate({ to: "/login", search: { redirect: "/mi-reino" } });
    }
  }, [loading, isAuthenticated, navigate]);

  if (loading || !isAuthenticated) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="font-display uppercase text-sm">Cargando tu Reino…</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <BrutalBadge tone="yellow">Mi Reino</BrutalBadge>
        <h1 className="font-display text-4xl md:text-5xl uppercase mt-2 leading-none">
          Hola, {user?.user_metadata?.display_name || user?.email?.split("@")[0]} 👑
        </h1>
      </header>

      <nav className="flex flex-wrap gap-2 mb-6 border-b-4 border-kp-ink pb-3">
        {tabs.map((t) => {
          const active = "exact" in t && t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`font-display uppercase text-sm px-3 py-2 border-2 border-kp-ink ${
                active ? "bg-kp-ink text-kp-yellow" : "bg-kp-cheese text-kp-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </section>
  );
}
