import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import {
  addUserRole,
  listUsersWithRoles,
  removeUserRole,
  type UserRow,
} from "@/lib/users.functions";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
const ROLES: AppRole[] = ["super_admin", "editor", "marketing", "franquiciado", "cliente"];

const ROLE_TONE: Record<AppRole, "yellow" | "lime" | "purple" | "red" | "black"> = {
  super_admin: "red",
  editor: "purple",
  marketing: "yellow",
  franquiciado: "lime",
  cliente: "black",
};

export const Route = createFileRoute("/admin/usuarios")({
  head: () => ({ meta: [{ title: "Usuarios — Admin KINGPAPA" }] }),
  component: UsuariosPage,
});

function UsuariosPage() {
  const list = useServerFn(listUsersWithRoles);
  const add = useServerFn(addUserRole);
  const remove = useServerFn(removeUserRole);
  const qc = useQueryClient();

  const {
    data: users,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin", "usuarios"],
    queryFn: () => list({}),
  });

  const addMut = useMutation({
    mutationFn: (v: { user_id: string; role: AppRole }) => add({ data: v }),
    onSuccess: () => {
      toast.success("Rol asignado");
      qc.invalidateQueries({ queryKey: ["admin", "usuarios"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeMut = useMutation({
    mutationFn: (v: { user_id: string; role: AppRole }) => remove({ data: v }),
    onSuccess: () => {
      toast.success("Rol eliminado");
      qc.invalidateQueries({ queryKey: ["admin", "usuarios"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <header>
        <BrutalBadge tone="yellow">Súbditos</BrutalBadge>
        <h1 className="font-display text-4xl uppercase mt-2 leading-none">Usuarios & Roles</h1>
        <p className="text-sm text-kp-ink/70 mt-1">
          Asigna o retira roles. Solo <b>super_admin</b> ve esta sección.
        </p>
      </header>

      {isLoading && <p className="font-display uppercase text-sm">Cargando súbditos…</p>}
      {error && (
        <BrutalCard tone="red" className="p-4">
          <p className="font-display uppercase text-sm">Error: {(error as Error).message}</p>
        </BrutalCard>
      )}

      <div className="grid gap-3">
        {(users ?? []).map((u) => (
          <UserRowCard
            key={u.id}
            user={u}
            onAdd={(role) => addMut.mutate({ user_id: u.id, role })}
            onRemove={(role) => removeMut.mutate({ user_id: u.id, role })}
            busy={addMut.isPending || removeMut.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function UserRowCard({
  user,
  onAdd,
  onRemove,
  busy,
}: {
  user: UserRow;
  onAdd: (r: AppRole) => void;
  onRemove: (r: AppRole) => void;
  busy: boolean;
}) {
  const available = ROLES.filter((r) => !user.roles.includes(r));
  return (
    <BrutalCard tone="cheese" className="p-4">
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-display uppercase text-base truncate">
            {user.display_name || user.email?.split("@")[0] || "—"}
          </p>
          <p className="text-xs text-kp-ink/70 truncate">{user.email}</p>
          <p className="text-[10px] text-kp-ink/50 font-mono mt-1">
            Último ingreso:{" "}
            {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "nunca"}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 md:max-w-[50%]">
          {user.roles.length === 0 && (
            <span className="text-xs text-kp-ink/50 italic">sin roles</span>
          )}
          {user.roles.map((r) => (
            <button
              key={r}
              type="button"
              disabled={busy}
              onClick={() => {
                if (confirm(`¿Quitar rol "${r}" a ${user.email}?`)) onRemove(r);
              }}
              className="group inline-flex items-center gap-1"
              title="Click para quitar"
            >
              <BrutalBadge tone={ROLE_TONE[r]}>
                {r} <span className="ml-1 group-hover:text-kp-red">×</span>
              </BrutalBadge>
            </button>
          ))}
        </div>

        {available.length > 0 && (
          <select
            disabled={busy}
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value as AppRole | "";
              if (v) onAdd(v);
              e.currentTarget.value = "";
            }}
            className="font-display uppercase text-xs px-2 py-2 border-2 border-kp-ink bg-white"
          >
            <option value="">+ Asignar rol…</option>
            {available.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}
      </div>
    </BrutalCard>
  );
}
