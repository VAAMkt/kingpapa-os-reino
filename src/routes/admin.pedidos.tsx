import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos — Admin" }] }),
  component: AdminPedidosPage,
});

type OrderStatus =
  | "enviado"
  | "recibido"
  | "en_preparacion"
  | "en_camino"
  | "entregado"
  | "cancelado"
  | "error";

type OrderRow = {
  id: string;
  status: OrderStatus;
  rp_pedido_id: string | null;
  tipo: "delivery" | "pickup";
  pago: string;
  total: number;
  cliente: { nombre?: string; telefono?: string; direccion?: string | null } | null;
  created_at: string;
  sede_id: string;
};

const STATUS_OPTIONS: { value: OrderStatus; label: string; tone: "yellow" | "lime" | "red" | "black" }[] = [
  { value: "enviado", label: "Enviado", tone: "yellow" },
  { value: "recibido", label: "Recibido", tone: "yellow" },
  { value: "en_preparacion", label: "En preparación", tone: "yellow" },
  { value: "en_camino", label: "En camino", tone: "lime" },
  { value: "entregado", label: "Entregado", tone: "lime" },
  { value: "cancelado", label: "Cancelado", tone: "red" },
  { value: "error", label: "Error", tone: "red" },
];

const cop = (n: number) => "$" + Number(n).toLocaleString("es-CO");
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });

function AdminPedidosPage() {
  const queryClient = useQueryClient();

  const pedidosQuery = useQuery({
    queryKey: ["admin", "pedidos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, rp_pedido_id, tipo, pago, total, cliente, created_at, sede_id")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
    refetchInterval: 20_000,
  });

  // Realtime: refrescar al insertar/actualizar pedidos.
  useEffect(() => {
    const channel = supabase
      .channel("admin-pedidos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => queryClient.invalidateQueries({ queryKey: ["admin", "pedidos"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      const { error } = await supabase
        .from("orders")
        .update({ status } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status actualizado");
      queryClient.invalidateQueries({ queryKey: ["admin", "pedidos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (pedidosQuery.isLoading) {
    return <p className="font-display uppercase text-sm">Cargando pedidos…</p>;
  }
  if (pedidosQuery.isError) {
    return (
      <p className="text-kp-red font-display uppercase text-sm">
        {(pedidosQuery.error as Error).message}
      </p>
    );
  }
  const pedidos = pedidosQuery.data ?? [];

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display uppercase text-3xl md:text-4xl">Pedidos</h1>
        <span className="text-xs text-kp-ink/60">
          {pedidos.length} recientes · se actualiza solo
        </span>
      </div>

      {pedidos.length === 0 ? (
        <BrutalCard tone="cheese" className="p-6 text-center">
          <p className="font-display uppercase">Sin pedidos aún</p>
        </BrutalCard>
      ) : (
        <div className="space-y-3">
          {pedidos.map((o) => {
            const opt = STATUS_OPTIONS.find((s) => s.value === o.status) ?? STATUS_OPTIONS[0];
            return (
              <BrutalCard key={o.id} tone="cheese" className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <BrutalBadge tone={opt.tone}>{opt.label}</BrutalBadge>
                      {o.rp_pedido_id ? (
                        <BrutalBadge tone="black">#{o.rp_pedido_id}</BrutalBadge>
                      ) : (
                        <BrutalBadge tone="black">UUID</BrutalBadge>
                      )}
                      <BrutalBadge tone="yellow">{o.tipo}</BrutalBadge>
                      <span className="text-xs text-kp-ink/60">{fmtTime(o.created_at)}</span>
                    </div>
                    <p className="font-display uppercase mt-2">
                      {o.cliente?.nombre ?? "Cliente"} · {o.cliente?.telefono ?? ""}
                    </p>
                    {o.tipo === "delivery" && o.cliente?.direccion ? (
                      <p className="text-xs text-kp-ink/70 truncate max-w-md">
                        {o.cliente.direccion}
                      </p>
                    ) : null}
                    <p className="text-xs text-kp-ink/60 mt-1 font-mono break-all">
                      {o.id}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="font-display text-2xl">{cop(o.total)}</span>
                    <select
                      value={o.status}
                      disabled={updateStatus.isPending}
                      onChange={(e) =>
                        updateStatus.mutate({
                          id: o.id,
                          status: e.target.value as OrderStatus,
                        })
                      }
                      className="px-3 py-2 bg-kp-cheese border-2 border-kp-ink shadow-brutal-sm font-display uppercase text-xs"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </BrutalCard>
            );
          })}
        </div>
      )}
    </section>
  );
}
