import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import { useCart, setOrderType, type OrderType } from "@/lib/cart";
import { useActiveSede } from "@/lib/active-sede";
import { toast } from "sonner";

const EVENT = "kp:open-order-intent";

export function openOrderIntent() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT));
}

/**
 * Pregunta una sola vez al usuario si su pedido es delivery o pickup.
 * Se dispara automáticamente cuando ya hay sede real (no "exploring") y
 * todavía no hay `orderType` definido en el carrito.
 */
export function OrderIntentDialog() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const sede = useActiveSede();
  const { orderType } = useCart();

  useEffect(() => setMounted(true), []);

  // Auto-pick: hay sede real + no hay orderType.
  // 98% de pedidos web son a domicilio → preseleccionamos delivery siempre.
  // Si está fuera de cobertura, el checkout muestra un aviso amigable —
  // pero NO bloqueamos la UI ni forzamos pickup silenciosamente.
  useEffect(() => {
    if (!mounted) return;
    const haySedeReal = !!sede && sede.source !== "exploring";
    if (haySedeReal && !orderType) {
      setOrderType("delivery");
    }
  }, [mounted, sede, orderType]);

  // Apertura manual via evento.
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  if (!mounted) return null;

  function pick(t: OrderType) {
    setOrderType(t);
    setOpen(false);
    if (t === "delivery") {
      if (sede && !sede.enCobertura) {
        toast.message(
          `Estás un poco lejos para nuestro domicilio (fuera de la zona de ${sede.distanciaKm ? sede.distanciaKm.toFixed(1) + " km" : "cobertura"}). Confirmaremos por WhatsApp.`,
        );
      } else {
        toast.success("Te lo llevamos 🛵");
      }
    } else {
      toast.success("Te esperamos en la sede 🏃");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg border-2 border-kp-ink bg-kp-yellow p-0">
        <DialogTitle className="sr-only">¿Cómo quieres tu corona?</DialogTitle>
        <DialogDescription className="sr-only">
          Elige si quieres que te llevemos el pedido a domicilio o si vas a recogerlo en la sede.
        </DialogDescription>
        <div className="p-6 space-y-5">
          <div>
            <BrutalBadge tone="black">Tu pedido</BrutalBadge>
            <h2 className="font-display text-4xl uppercase leading-none mt-2">
              ¿Cómo quieres tu corona?
            </h2>
            <p className="mt-2 text-sm">
              Sede asignada: <strong>{sede?.label}</strong>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <BrutalButton variant="fire" size="lg" block onClick={() => pick("delivery")}>
              <span className="text-2xl">🛵</span>
              <span>Domicilio</span>
            </BrutalButton>
            <BrutalButton variant="dark" size="lg" block onClick={() => pick("pickup")}>
              <span className="text-2xl">🏃</span>
              <span>Recoger en sede</span>
            </BrutalButton>
          </div>

          <p className="text-xs opacity-70">Puedes cambiar esto luego desde el carrito.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
