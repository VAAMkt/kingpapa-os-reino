// Micro-store en memoria para "intención pendiente": el usuario hizo click en
// "Pedir" sin tener ubicación. Tras confirmar el LocationGate disparamos el
// evento `kp:gate-confirmed` y la ProductCard re-ejecuta su intención.
import { addItem } from "@/lib/cart";

export type PendingAddIntent = {
  type: "add";
  productoId: string;
  nombre: string;
  precio: number;
  imagen?: string | null;
};

let pending: PendingAddIntent | null = null;

export function setPendingIntent(i: PendingAddIntent | null) {
  pending = i;
}

export function runPendingIntent() {
  const p = pending;
  pending = null;
  if (!p) return;
  if (p.type === "add") {
    addItem({
      productoId: p.productoId,
      nombre: p.nombre,
      precio: p.precio,
      imagen: p.imagen ?? null,
    });
  }
}

export const GATE_CONFIRMED_EVENT = "kp:gate-confirmed";

export function emitGateConfirmed() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(GATE_CONFIRMED_EVENT));
}
