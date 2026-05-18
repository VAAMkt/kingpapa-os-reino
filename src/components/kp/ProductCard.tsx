import { useEffect } from "react";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import type { Producto } from "@/types/kp";
import { addItem } from "@/lib/cart";
import { useActiveSede } from "@/lib/active-sede";
import { openLocationGate } from "@/components/kp/LocationGate";
import {
  setPendingIntent,
  GATE_CONFIRMED_EVENT,
  runPendingIntent,
} from "@/lib/pending-intent";
import { toast } from "sonner";

const cop = (n: number) => "$" + n.toLocaleString("es-CO");

// Listener global único: cualquier gate confirmado dispara la intención pendiente.
let listenerInstalled = false;
function ensureListener() {
  if (typeof window === "undefined" || listenerInstalled) return;
  listenerInstalled = true;
  window.addEventListener(GATE_CONFIRMED_EVENT, () => {
    runPendingIntent();
  });
}

export function ProductCard({
  producto,
  compact = false,
  destacado = false,
}: {
  producto: Producto;
  compact?: boolean;
  /** Variante "hero" — card más grande, prioritaria en el grid (col-span-2). */
  destacado?: boolean;
}) {
  const sede = useActiveSede();
  useEffect(() => { ensureListener(); }, []);

  function onPedir() {
    const tieneUbicacionReal = !!sede && sede.source !== "exploring";
    if (!tieneUbicacionReal) {
      setPendingIntent({
        type: "add",
        productoId: producto.id,
        nombre: producto.nombre,
        precio: producto.precioDesde,
        imagen: producto.imagen,
      });
      openLocationGate();
      toast.message("Dinos a dónde te lo llevamos");
      return;
    }
    addItem({
      productoId: producto.id,
      nombre: producto.nombre,
      precio: producto.precioDesde,
      imagen: producto.imagen,
    });
    toast.success(`${producto.nombre} al carrito`);
  }

  const isHero = destacado || producto.destacado;

  return (
    <BrutalCard
      tone={isHero ? "yellow" : "cheese"}
      className="overflow-hidden flex flex-col h-full"
    >
      <div className={`relative ${isHero ? "aspect-[16/10]" : "aspect-square"} bg-kp-ink`}>
        <img
          src={producto.imagen}
          alt={producto.nombre}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
          {producto.esNuevo && <BrutalBadge tone="lime">Nuevo</BrutalBadge>}
          {producto.esMasVendido && <BrutalBadge tone="red">Más vendido</BrutalBadge>}
          {producto.esRecomendado && <BrutalBadge tone="purple">🔥 Recomendado</BrutalBadge>}
          {producto.etiquetaCustom && (
            <BrutalBadge tone="yellow">{producto.etiquetaCustom}</BrutalBadge>
          )}
          {producto.paraCompartir && <BrutalBadge tone="purple">Compartir</BrutalBadge>}
        </div>
        {isHero && (
          <div className="absolute top-3 right-3">
            <BrutalBadge tone="red">★ Corona del rey</BrutalBadge>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3
          className={`font-display uppercase leading-none ${
            isHero ? "text-3xl md:text-4xl" : "text-2xl"
          }`}
        >
          {producto.nombre}
        </h3>
        {!compact && producto.descripcion && (
          <p className="text-sm text-kp-ink/80 line-clamp-3">{producto.descripcion}</p>
        )}

        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          <span className={`font-display ${isHero ? "text-3xl md:text-4xl" : "text-2xl"}`}>
            {cop(producto.precioDesde)}
          </span>
          <BrutalButton size={isHero ? "md" : "sm"} variant="primary" onClick={onPedir}>
            Pedir esta corona
          </BrutalButton>
        </div>
      </div>
    </BrutalCard>
  );
}
