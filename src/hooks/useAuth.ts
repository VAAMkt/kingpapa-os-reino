import { useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  roleError: string | null;
  loading: boolean;
}

const ADMIN_ROLES: AppRole[] = ["super_admin", "editor", "marketing", "franquiciado"];

/**
 * Hook centralizado de auth para KINGPAPA OS.
 * - Suscribe a onAuthStateChange (no llamadas async dentro del callback).
 * - Carga roles desde public.user_roles cuando hay sesión.
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    roles: [],
    roleError: null,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;

    const loadRoles = async (userId: string) => {
      setState((prev) => ({ ...prev, loading: true, roleError: null }));

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (!mounted) return;
      setState((prev) => ({
        ...prev,
        roles: error ? [] : (data ?? []).map((r) => r.role as AppRole),
        roleError: error ? error.message : null,
        loading: false,
      }));
    };

    // 1) Listener primero (síncrono dentro del callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState((prev) => ({
        ...prev,
        user: session?.user ?? null,
        session,
        roles: session ? [] : [],
        roleError: null,
        loading: session ? true : false,
      }));
      if (session?.user) {
        // Defer async fuera del callback
        setTimeout(() => loadRoles(session.user.id), 0);
      }
    });

    // 2) Luego sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setState((prev) => ({
        ...prev,
        user: session?.user ?? null,
        session,
        roles: session ? [] : [],
        roleError: null,
        loading: session ? true : false,
      }));
      if (session?.user) loadRoles(session.user.id);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const hasRole = useCallback(
    (role: AppRole) => state.roles.includes(role),
    [state.roles],
  );

  const hasAnyRole = useCallback(
    (roles: AppRole[]) => roles.some((r) => state.roles.includes(r)),
    [state.roles],
  );

  const isAdmin = useCallback(
    () => state.roles.some((r) => ADMIN_ROLES.includes(r)),
    [state.roles],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    ...state,
    isAuthenticated: !!state.session,
    hasRole,
    hasAnyRole,
    isAdmin,
    signOut,
  };
}
