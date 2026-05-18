import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import type { Producto } from "@/types/kp";
import { addItem } from "@/lib/cart";
import { useActiveSede } from "@/lib/active-sede";
import { openLocationGate } from "@/components/kp/LocationGate";
import { toast } from "sonner";

const cop = (n: number) => "$" + n.toLocaleString("es-CO");

function Chili({ n }: { n: number }) {
  return (
    <span aria-label={`Picante ${n}/3`} className="text-xs">
      {"🌶️".repeat(Math.max(n, 0))}
      <span className="opacity-30">{"🌶️".repeat(Math.max(3 - n, 0))}</span>
    </span>
  );
}

function HambreBar({ n }: { n: number }) {
  return (
    <div className="flex gap-1" aria-label={`Hambre ${n}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-2 w-3 border border-kp-ink ${i <= n ? "bg-kp-red" : "bg-kp-cheese"}`}
        />
      ))}
    </div>
  );
}

export function ProductCard({ producto, compact = false }: { producto: Producto; compact?: boolean }) {
  const sede = useActiveSede();
  const ocasionLabel: Record<string, string> = {
    parche: "parche",
    "after-rumba": "after rumba",
    "almuerzo-obrero": "almuerzo obrero",
    familia: "familia",
    "antojo-mortal": "antojo mortal",
    solo: "solo",
  };

  return (
    <BrutalCard tone="cheese" className="overflow-hidden flex flex-col">
      <div className="relative aspect-square bg-kp-ink">
        <img
          src={producto.imagen}
          alt={producto.nombre}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
          {producto.esNuevo && <BrutalBadge tone="lime">Nuevo</BrutalBadge>}
          {producto.esMasVendido && <BrutalBadge tone="red">Más vendido</BrutalBadge>}
          {producto.paraCompartir && <BrutalBadge tone="purple">Compartir</BrutalBadge>}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="font-display text-2xl uppercase leading-none">{producto.nombre}</h3>
        {!compact && (
          <p className="text-sm text-kp-ink/80 line-clamp-3">{producto.descripcion}</p>
        )}

        <div className="flex items-center justify-between text-xs mt-1">
          <span className="font-display uppercase">{producto.pesoAprox}</span>
          <Chili n={producto.nivelPicante} />
        </div>
        <HambreBar n={producto.nivelHambre} />

        {!compact && (
          <p className="text-xs uppercase font-display tracking-wider text-kp-ink/70 mt-1">
            Perfecta pa’: {producto.ocasiones.map((o) => ocasionLabel[o] || o).join(", ")}
          </p>
        )}

        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          <span className="font-display text-2xl">{cop(producto.precioDesde)}</span>
          <BrutalButton
            size="sm"
            variant="primary"
            onClick={() => {
              if (!sede || sede.source === "exploring") {
                openLocationGate();
                toast.message("Confírmanos tu ubicación primero");
                return;
              }
              addItem({
                productoId: producto.id,
                nombre: producto.nombre,
                precio: producto.precioDesde,
                imagen: producto.imagen,
              });
              toast.success(`${producto.nombre} al carrito`);
            }}
          >
            Pedir esta corona
          </BrutalButton>
        </div>
      </div>
    </BrutalCard>
  );
}
