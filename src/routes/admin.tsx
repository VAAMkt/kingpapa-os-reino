import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { BrutalBadge } from "@/components/ui-kp/Brutal";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — KINGPAPA OS" }],
  }),
  component: AdminLayout,
});

const adminNav = [
  { to: "/admin", label: "Dashboard", soon: false, exact: true },
  { to: "/admin/contenidos", label: "Contenidos", soon: false },
  { to: "/admin", label: "Menú", soon: true },
  { to: "/admin", label: "Sedes", soon: true },
  { to: "/admin", label: "Pedidos", soon: true },
  { to: "/admin", label: "Loyalty", soon: true },
  { to: "/admin", label: "Campañas", soon: true },
  { to: "/admin/usuarios", label: "Usuarios", soon: false },
  { to: "/admin", label: "Integraciones", soon: true },
];

function AdminLayout() {
  const { isAuthenticated, loading, isAdmin, roleError } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      navigate({ to: "/login", search: { redirect: "/admin" } });
      return;
    }
    if (roleError) return;
    if (!isAdmin()) {
      navigate({ to: "/no-autorizado" });
    }
  }, [loading, isAuthenticated, roleError, isAdmin, navigate]);

  if (!loading && isAuthenticated && roleError) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="border-2 border-kp-ink bg-kp-red p-6 shadow-brutal-sm">
          <p className="font-display uppercase text-3xl leading-none text-kp-cheese">No pudimos verificar tu corona</p>
          <p className="mt-3 text-sm text-kp-cheese/90">La sesión está activa, pero falló la consulta de roles.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 border-2 border-kp-ink bg-kp-yellow px-5 py-3 font-display text-sm uppercase text-kp-ink shadow-brutal-sm"
          >
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  if (loading || !isAuthenticated || !isAdmin()) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="font-display uppercase text-sm">Verificando corona…</p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 grid md:grid-cols-[220px_1fr] gap-6">
      <aside className="md:sticky md:top-20 self-start">
        <BrutalBadge tone="black">Reino · Admin</BrutalBadge>
        <nav className="mt-3 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
          {adminNav.map((n, i) => {
            const active = !n.soon && (n.exact ? pathname === n.to : pathname.startsWith(n.to));
            return n.soon ? (
              <span
                key={i}
                className="font-display uppercase text-xs px-3 py-2 border-2 border-kp-ink/30 text-kp-ink/40 cursor-not-allowed whitespace-nowrap"
                title="Próximamente"
              >
                {n.label} <span className="text-[9px]">· soon</span>
              </span>
            ) : (
              <Link
                key={i}
                to={n.to}
                className={`font-display uppercase text-xs px-3 py-2 border-2 border-kp-ink whitespace-nowrap ${
                  active ? "bg-kp-ink text-kp-yellow" : "bg-kp-cheese"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div>
        <Outlet />
      </div>
    </div>
  );
}
