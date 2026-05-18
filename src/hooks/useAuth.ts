import { useEffect, useState, useCallback, useSyncExternalStore } from "react";
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

// ---------- Singleton store: una sola suscripción para toda la app ----------
let state: AuthState = {
  user: null,
  session: null,
  roles: [],
  roleError: null,
  loading: true,
};

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const emit = () => listeners.forEach((l) => l());
const setState = (patch: Partial<AuthState>) => {
  state = { ...state, ...patch };
  emit();
};

let initialized = false;
let rolesUserId: string | null = null;

async function loadRoles(userId: string) {
  rolesUserId = userId;
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  // Si la sesión cambió mientras cargábamos, ignorar
  if (rolesUserId !== userId) return;
  setState({
    roles: error ? [] : (data ?? []).map((r) => r.role as AppRole),
    roleError: error ? error.message : null,
    loading: false,
  });
}

function initAuth() {
  if (initialized) return;
  initialized = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    setState({
      user: session?.user ?? null,
      session,
      roles: [],
      roleError: null,
      loading: !!session,
    });
    if (session?.user) {
      setTimeout(() => loadRoles(session.user.id), 0);
    } else {
      rolesUserId = null;
    }
  });

  supabase.auth.getSession().then(({ data: { session } }) => {
    setState({
      user: session?.user ?? null,
      session,
      loading: !!session,
    });
    if (session?.user) loadRoles(session.user.id);
  });
}

const getSnapshot = () => state;
const getServerSnapshot = () => state;

/**
 * Hook centralizado de auth para KINGPAPA OS.
 * Comparte una única suscripción y una única carga de roles entre todos los consumidores.
 */
export function useAuth() {
  // Inicializa una sola vez (lazy)
  if (!initialized) initAuth();

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const hasRole = useCallback(
    (role: AppRole) => snapshot.roles.includes(role),
    [snapshot.roles],
  );
  const hasAnyRole = useCallback(
    (roles: AppRole[]) => roles.some((r) => snapshot.roles.includes(r)),
    [snapshot.roles],
  );
  const isAdmin = useCallback(
    () => snapshot.roles.some((r) => ADMIN_ROLES.includes(r)),
    [snapshot.roles],
  );
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // mantener compat con código existente que usa useState/useEffect
  void useState;
  void useEffect;

  return {
    ...snapshot,
    isAuthenticated: !!snapshot.session,
    hasRole,
    hasAnyRole,
    isAdmin,
    signOut,
  };
}
