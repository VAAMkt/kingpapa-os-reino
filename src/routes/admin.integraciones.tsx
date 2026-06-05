import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import { toast } from "sonner";
import { getIntegrationsStatus } from "@/lib/integrations.functions";

export const Route = createFileRoute("/admin/integraciones")({
  head: () => ({ meta: [{ title: "Integraciones — Admin" }] }),
  component: AdminIntegracionesPage,
});

const MAX_ROWS = 200;

type LogRow = {
  id: string;
  created_at: string;
  tipo: string;
  ok: boolean;
  mensaje: string | null;
  payload: unknown;
};

const TIPOS = [
  "todos",
  "webhook_raw",
  "webhook",
  "webhook_ignored_external",
  "order",
  "order_test_mode",
  "cancel",
  "pos_poll",
] as const;

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CO", { hour12: false });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" });
}

function relativeAgo(iso: string | null): string {
  if (!iso) return "nunca";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function AdminIntegracionesPage() {
  const fetchStatus = useServerFn(getIntegrationsStatus);

  const statusQuery = useQuery({
    queryKey: ["integraciones", "status"],
    queryFn: () => fetchStatus({}),
    refetchInterval: 15_000,
  });

  const [rows, setRows] = useState<LogRow[]>([]);
  const [filterTipo, setFilterTipo] = useState<(typeof TIPOS)[number]>("todos");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const refreshTickRef = useRef(0);

  async function load() {
    refreshTickRef.current += 1;
    const { data, error } = await supabase
      .from("rp_sync_log")
      .select("id, created_at, tipo, ok, mensaje, payload")
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as LogRow[]);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-integraciones")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rp_sync_log" },
        (payload) => {
          const row = payload.new as LogRow;
          setRows((prev) => {
            const next = [row, ...prev];
            return next.length > MAX_ROWS ? next.slice(0, MAX_ROWS) : next;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = activeSearch.trim();
    return rows.filter((r) => {
      if (filterTipo !== "todos" && r.tipo !== filterTipo) return false;
      if (onlyErrors && r.ok) return false;
      if (q) {
        const hay = JSON.stringify(r.payload ?? "") + " " + (r.mensaje ?? "");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filterTipo, onlyErrors, activeSearch]);

  const status = statusQuery.data;
  const rpActive = status?.rp.last_webhook_at
    ? Date.now() - new Date(status.rp.last_webhook_at).getTime() < 30 * 60 * 1000
    : false;

  async function copyPayload(p: unknown) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(p, null, 2));
      toast.success("JSON copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <section className="space-y-5">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display uppercase text-3xl md:text-4xl">Integraciones</h1>
        <span className="text-xs text-kp-ink/60">
          {rows.length} eventos · realtime activo
        </span>
      </header>

      {/* Bloque 1 — Estado */}
      <div className="grid md:grid-cols-3 gap-3">
        <BrutalCard tone="cheese" className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-display uppercase text-sm">Restaurant.pe</span>
            <BrutalBadge tone={rpActive ? "lime" : "yellow"}>
              {rpActive ? "activo" : "silencioso"}
            </BrutalBadge>
          </div>
          <p className="text-xs text-kp-ink/70">
            Último webhook: <strong>{relativeAgo(status?.rp.last_webhook_at ?? null)}</strong>
          </p>
          <ul className="text-[11px] font-mono text-kp-ink/70 mt-2 space-y-0.5">
            <li>token api: {status?.rp.token_set ? "✓" : "—"}</li>
            <li>dominio: {status?.rp.dominio_set ? "✓" : "—"}</li>
            <li>webhook secret: {status?.rp.webhook_secret_set ? "✓" : "—"}</li>
            <li>pos cookie: {status?.rp.pos_token_set ? "✓" : "—"}</li>
            <li className="break-all">path: {status?.rp.webhook_path}</li>
          </ul>
        </BrutalCard>

        <BrutalCard tone="cheese" className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-display uppercase text-sm">Lovable AI</span>
            <BrutalBadge tone={status?.lovable_ai.key_set ? "lime" : "red"}>
              {status?.lovable_ai.key_set ? "configurado" : "faltante"}
            </BrutalBadge>
          </div>
          <p className="text-xs text-kp-ink/70">Gateway gestionado por Lovable.</p>
        </BrutalCard>

        <BrutalCard tone="cheese" className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-display uppercase text-sm">Google Maps</span>
            <BrutalBadge
              tone={
                status?.google_maps.browser_key_set && status?.google_maps.server_key_set
                  ? "lime"
                  : "yellow"
              }
            >
              {status?.google_maps.browser_key_set && status?.google_maps.server_key_set
                ? "configurado"
                : "parcial"}
            </BrutalBadge>
          </div>
          <ul className="text-[11px] font-mono text-kp-ink/70 mt-2 space-y-0.5">
            <li>browser key: {status?.google_maps.browser_key_set ? "✓" : "—"}</li>
            <li>server key: {status?.google_maps.server_key_set ? "✓" : "—"}</li>
          </ul>
        </BrutalCard>
      </div>

      {/* Bloque 2 — Buscar */}
      <BrutalCard tone="cheese" className="p-4">
        <label className="text-xs font-display uppercase block mb-2">Buscar pedido</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="rp_pedido_id, UUID, comanda, IP…"
            className="flex-1 px-3 py-2 border-2 border-kp-ink bg-white font-mono text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") setActiveSearch(search);
            }}
          />
          <BrutalButton onClick={() => setActiveSearch(search)}>Buscar</BrutalButton>
          {activeSearch ? (
            <BrutalButton
              variant="ghost"
              onClick={() => {
                setSearch("");
                setActiveSearch("");
              }}
            >
              Limpiar
            </BrutalButton>
          ) : null}
        </div>
        {activeSearch ? (
          <p className="text-xs text-kp-ink/70 mt-2">
            Filtrando por <span className="font-mono">{activeSearch}</span> · {filtered.length}{" "}
            coincidencias
          </p>
        ) : null}
      </BrutalCard>

      {/* Bloque 3 — Stream */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display uppercase text-sm">Webhooks en vivo</span>
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value as (typeof TIPOS)[number])}
            className="px-2 py-1 bg-kp-cheese border-2 border-kp-ink font-display uppercase text-xs"
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-xs font-display uppercase cursor-pointer">
            <input
              type="checkbox"
              checked={onlyErrors}
              onChange={(e) => setOnlyErrors(e.target.checked)}
            />
            sólo errores
          </label>
          <button
            type="button"
            onClick={load}
            className="ml-auto px-2 py-1 border-2 border-kp-ink bg-kp-cheese font-display uppercase text-xs"
          >
            ⟳ recargar
          </button>
        </div>

        {filtered.length === 0 ? (
          <BrutalCard tone="cheese" className="p-6 text-center">
            <p className="font-display uppercase text-sm">Sin eventos</p>
          </BrutalCard>
        ) : (
          <ul className="space-y-1">
            {filtered.map((r) => {
              const open = !!expanded[r.id];
              return (
                <li key={r.id} className="border-2 border-kp-ink bg-white">
                  <button
                    type="button"
                    onClick={() => setExpanded((p) => ({ ...p, [r.id]: !open }))}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-kp-cheese/30"
                  >
                    <span className="font-mono text-xs text-kp-ink/60 w-20 shrink-0">
                      {fmtDate(r.created_at)} {fmtTime(r.created_at)}
                    </span>
                    <BrutalBadge tone={r.ok ? "lime" : "red"}>{r.ok ? "ok" : "err"}</BrutalBadge>
                    <span className="font-display uppercase text-[10px] px-2 py-0.5 border border-kp-ink bg-kp-cheese shrink-0">
                      {r.tipo}
                    </span>
                    <span className="text-xs text-kp-ink/80 truncate flex-1">
                      {r.mensaje ?? "—"}
                    </span>
                    <span className="text-xs text-kp-ink/40 shrink-0">{open ? "▾" : "▸"}</span>
                  </button>
                  {open ? (
                    <div className="border-t-2 border-kp-ink/20 bg-kp-cheese/20 p-2">
                      <div className="flex justify-end mb-1">
                        <button
                          type="button"
                          onClick={() => copyPayload(r.payload)}
                          className="px-2 py-0.5 border border-kp-ink bg-white font-display uppercase text-[10px]"
                        >
                          copiar JSON
                        </button>
                      </div>
                      <pre className="text-[11px] font-mono whitespace-pre-wrap break-all max-h-96 overflow-auto">
                        {JSON.stringify(r.payload, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
