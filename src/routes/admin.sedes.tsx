import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/admin/sedes")({
  head: () => ({
    meta: [{ title: "Sedes — Admin KINGPAPA" }],
  }),
  component: SedesLayout,
});

function SedesLayout() {
  const { hasAnyRole, loading, roleError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || roleError) return;
    if (!hasAnyRole(["super_admin", "editor"])) {
      navigate({ to: "/no-autorizado" });
    }
  }, [loading, roleError, hasAnyRole, navigate]);

  return <Outlet />;
}
