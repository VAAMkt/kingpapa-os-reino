import { useEffect, useState } from "react";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import type { Producto } from "@/types/kp";
import { addItem } from "@/lib/cart";
import { useActiveSede } from "@/lib/active-sede";
import { openLocationGate } from "@/components/kp/LocationGate";
import { setPendingIntent, GATE_CONFIRMED_EVENT, runPendingIntent } from "@/lib/pending-intent";
import { ProductCustomizerSheet } from "@/components/kp/ProductCustomizerSheet";
import { track } from "@/lib/analytics";
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

/** Máximo 2 badges, por prioridad, y sólo con atributos reales del producto. */
function badgesDe(producto: Producto) {
  const out: { key: string; tone: "red" | "lime" | "yellow" | "purple"; label: string }[] = [];
  if (producto.esMasVendido) out.push({ key: "top", tone: "red", label: "Más vendido" });
  if (producto.esNuevo) out.push({ key: "new", tone: "lime", label: "Nuevo" });
  if (producto.etiquetaCustom)
    out.push({ key: "custom", tone: "yellow", label: producto.etiquetaCustom });
  if (producto.paraCompartir)
    out.push({ key: "share", tone: "purple", label: "Ideal para compartir" });
  return out.slice(0, 2);
}

export function ProductCard({
  producto,
  compact = false,
  destacado = false,
  priority = false,
}: {
  producto: Producto;
  compact?: boolean;
  /** Variante "hero" — card más grande, prioritaria en el grid. */
  destacado?: boolean;
  /** Imagen above-the-fold: carga eager con prioridad alta. */
  priority?: boolean;
}) {
  const sede = useActiveSede();
  const [openCustomizer, setOpenCustomizer] = useState(false);
  useEffect(() => {
    ensureListener();
  }, []);

  const tieneMods = (producto.modificadores?.length ?? 0) > 0;
  const badges = badgesDe(producto);

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
    if (tieneMods) {
      track("customizer_opened", {
        producto_id: producto.id,
        grupos: producto.modificadores?.length ?? 0,
      });
      setOpenCustomizer(true);
      return;
    }
    // Producto simple: 1 toque. NO abrimos el carrito.
    addItem({
      productoId: producto.id,
      nombre: producto.nombre,
      precio: producto.precioDesde,
      imagen: producto.imagen,
      silent: true,
    });
    track("add_to_cart", {
      producto_id: producto.id,
      producto_nombre: producto.nombre,
      precio_final: producto.precioDesde,
      tiene_modificadores: false,
    });
    track("simple_product_added", {
      producto_id: producto.id,
      precio_final: producto.precioDesde,
    });
    toast.success(`${producto.nombre} al carrito`);
  }

  const isHero = destacado || producto.destacado;
  const ctaLabel = tieneMods ? "Personalizar" : "Agregar";

  return (
    <>
      <BrutalCard
        tone={isHero ? "yellow" : "cheese"}
        className="overflow-hidden flex flex-row sm:flex-col h-full"
      >
        {/* Imagen: derecha en móvil, arriba en tablet/desktop */}
        <div
          className={`relative shrink-0 order-2 sm:order-none w-28 self-start m-3 sm:m-0 sm:w-full ${
            isHero ? "sm:aspect-[16/10]" : "sm:aspect-square"
          } aspect-square bg-kp-ink border-2 border-kp-ink sm:border-0 sm:border-b-2`}
        >
          {producto.imagen ? (
            <img
              src={producto.imagen}
              alt={producto.nombre}
              width={640}
              height={640}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "auto"}
              decoding={priority ? "sync" : "async"}
              sizes="(max-width: 640px) 112px, (max-width: 1024px) 50vw, 33vw"
              className="w-full h-full object-cover"
              style={{ aspectRatio: "1 / 1" }}
            />
          ) : (
            <div
              aria-hidden
              className="w-full h-full grid place-items-center font-display text-kp-yellow text-2xl"
            >
              👑
            </div>
          )}
        </div>

        <div className="order-1 sm:order-none p-3 sm:p-4 flex flex-col gap-1.5 sm:gap-2 flex-1 min-w-0">
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {badges.map((b) => (
                <BrutalBadge key={b.key} tone={b.tone} className="text-[10px] px-1.5 py-0.5">
                  {b.label}
                </BrutalBadge>
              ))}
            </div>
          )}
          <h3
            className={`font-display uppercase leading-tight ${
              isHero ? "text-xl sm:text-3xl md:text-4xl" : "text-[18px] sm:text-2xl"
            }`}
          >
            {producto.nombre}
          </h3>
          {!compact && producto.descripcion && (
            <p className="text-sm text-kp-ink/80 line-clamp-2 sm:line-clamp-3">
              {producto.descripcion}
            </p>
          )}

          <div className="mt-auto pt-2 sm:pt-3 flex items-center justify-between gap-2">
            <span className={`font-display ${isHero ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"}`}>
              {cop(producto.precioDesde)}
            </span>
            <BrutalButton
              size="sm"
              variant="primary"
              onClick={onPedir}
              aria-label={`${ctaLabel} ${producto.nombre}`}
              className="min-h-12 min-w-12 px-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kp-ink"
            >
              {ctaLabel}
            </BrutalButton>
          </div>
        </div>
      </BrutalCard>

      {tieneMods && (
        <ProductCustomizerSheet
          producto={producto}
          open={openCustomizer}
          onOpenChange={setOpenCustomizer}
        />
      )}
    </>
  );
}
