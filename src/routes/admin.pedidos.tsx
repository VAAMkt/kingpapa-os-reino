import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cancelOrderFromAdmin } from "@/lib/orders.functions";

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
  rp_numero_comanda: string | null;
  cancel_reason: string | null;
  tipo: "delivery" | "pickup";
  pago: string;
  total: number;
  cliente: { nombre?: string; telefono?: string; direccion?: string | null } | null;
  created_at: string;
  sede_id: string;
};

const STATUS_OPTIONS: {
  value: OrderStatus;
  label: string;
  tone: "yellow" | "lime" | "red" | "black";
}[] = [
  { value: "enviado", label: "Enviado", tone: "yellow" },
  { value: "recibido", label: "Recibido", tone: "yellow" },
  { value: "en_preparacion", label: "En preparación", tone: "yellow" },
  { value: "en_camino", label: "En camino", tone: "lime" },
  { value: "entregado", label: "Entregado", tone: "lime" },
  { value: "cancelado", label: "Cancelado", tone: "red" },
  { value: "error", label: "Error", tone: "red" },
];

const CANCEL_PRESETS = [
  "Fuera de zona",
  "Sin stock",
  "Local cerrado",
  "Cliente no contesta",
  "Otro",
];

const cop = (n: number) => "$" + Number(n).toLocaleString("es-CO");
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });

function AdminPedidosPage() {
  const queryClient = useQueryClient();
  const cancelFn = useServerFn(cancelOrderFromAdmin);
  const [cancelTarget, setCancelTarget] = useState<OrderRow | null>(null);
  const [cancelPreset, setCancelPreset] = useState<string>(CANCEL_PRESETS[0]);
  const [cancelDetail, setCancelDetail] = useState<string>("");

  const pedidosQuery = useQuery({
    queryKey: ["admin", "pedidos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, status, rp_pedido_id, rp_numero_comanda, cancel_reason, tipo, pago, total, cliente, created_at, sede_id",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
    refetchInterval: 20_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-pedidos")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () =>
        queryClient.invalidateQueries({ queryKey: ["admin", "pedidos"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status actualizado");
      queryClient.invalidateQueries({ queryKey: ["admin", "pedidos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ orderId, motivo }: { orderId: string; motivo: string }) => {
      return cancelFn({ data: { orderId, motivo } });
    },
    onSuccess: (res) => {
      if (res.posOk === false) {
        toast.warning(
          `Cancelado en el sistema, pero el POS rechazó la cancelación: ${res.posError ?? "sin detalle"}. Revisa físicamente en el local.`,
        );
      } else {
        toast.success("Pedido cancelado en POS y notificado al cliente");
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "pedidos"] });
      setCancelTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleStatusChange(order: OrderRow, next: OrderStatus) {
    if (next === order.status) return;
    if (next === "cancelado") {
      setCancelTarget(order);
      setCancelPreset(CANCEL_PRESETS[0]);
      setCancelDetail("");
      return;
    }
    updateStatus.mutate({ id: order.id, status: next });
  }

  function confirmCancel() {
    if (!cancelTarget) return;
    const reason =
      cancelPreset === "Otro"
        ? cancelDetail.trim() || "Otro"
        : cancelDetail.trim()
          ? `${cancelPreset} — ${cancelDetail.trim()}`
          : cancelPreset;
    cancelMutation.mutate({ orderId: cancelTarget.id, motivo: reason });
  }

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
            const comanda = o.rp_numero_comanda;
            return (
              <BrutalCard key={o.id} tone="cheese" className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <BrutalBadge tone={opt.tone}>{opt.label}</BrutalBadge>
                      {comanda ? (
                        <BrutalBadge tone="black">#{comanda}</BrutalBadge>
                      ) : o.rp_pedido_id ? (
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
                    {o.status === "cancelado" && o.cancel_reason ? (
                      <p className="text-xs text-kp-red mt-1 font-display uppercase">
                        Cancelado: {o.cancel_reason}
                      </p>
                    ) : null}
                    {comanda && o.rp_pedido_id ? (
                      <p className="text-[10px] text-kp-ink/50 mt-1 font-mono">
                        ref interno: {o.rp_pedido_id}
                      </p>
                    ) : null}
                    <p className="text-xs text-kp-ink/60 mt-1 font-mono break-all">{o.id}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="font-display text-2xl">{cop(o.total)}</span>
                    <select
                      value={o.status}
                      disabled={updateStatus.isPending}
                      onChange={(e) => handleStatusChange(o, e.target.value as OrderStatus)}
                      className="px-3 py-2 bg-kp-cheese border-2 border-kp-ink shadow-brutal-sm font-display uppercase text-xs"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    {/* Polling manual eliminado: el webhook empuja estados desde Restaurant.pe en tiempo real. */}
                  </div>
                </div>
              </BrutalCard>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar pedido</DialogTitle>
            <DialogDescription>
              El cliente verá el motivo en su pantalla de seguimiento al instante.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {CANCEL_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCancelPreset(p)}
                  className={`px-3 py-1.5 border-2 border-kp-ink text-xs font-display uppercase ${
                    cancelPreset === p ? "bg-kp-yellow" : "bg-kp-cheese"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <Textarea
              placeholder={
                cancelPreset === "Otro" ? "Describe el motivo…" : "Detalles adicionales (opcional)…"
              }
              value={cancelDetail}
              onChange={(e) => setCancelDetail(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <BrutalButton variant="ghost" onClick={() => setCancelTarget(null)}>
              Atrás
            </BrutalButton>
            <BrutalButton
              variant="fire"
              onClick={confirmCancel}
              disabled={
                cancelMutation.isPending ||
                (cancelPreset === "Otro" && cancelDetail.trim().length === 0)
              }
            >
              Cancelar pedido
            </BrutalButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
