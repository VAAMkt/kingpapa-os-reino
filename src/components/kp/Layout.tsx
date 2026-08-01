import { useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { BrutalLink, BrutalButton } from "@/components/ui-kp/BrutalButton";
import { UserMenu } from "@/components/auth/UserMenu";
import { useActiveSede } from "@/lib/active-sede";
import { openLocationGate } from "@/components/kp/LocationGate";
import logoDark from "@/assets/kingpapa-logo.png.asset.json";
import logoLight from "@/assets/kingpapa-logo-white.png.asset.json";

const nav = [
  { to: "/menu", label: "Menú" },
  { to: "/", label: "El Reino" },
  { to: "/sedes", label: "Sedes" },
  { to: "/tracking", label: "Rastrear" },
  { to: "/franquicias", label: "Franquicias" },
  { to: "/historias", label: "Historias" },
] as const;

function LocationPill({ className = "" }: { className?: string }) {
  const sede = useActiveSede();
  const hasReal = !!sede && sede.source !== "exploring";
  const label = hasReal ? sede!.direccionTexto || sede!.label : "Selecciona tu ubicación";
  return (
    <button
      onClick={openLocationGate}
      title={label}
      aria-label={`Ubicación: ${label}. Tocar para cambiar`}
      className={
        "inline-flex items-center gap-2 min-h-11 w-full lg:w-auto lg:max-w-[280px] px-3 py-1.5 bg-kp-cheese border-2 border-kp-ink shadow-brutal-sm font-display uppercase text-[11px] md:text-xs hover:-translate-y-[1px] " +
        className
      }
    >
      <span className="shrink-0" aria-hidden>
        📍
      </span>
      <span className="flex-1 min-w-0 truncate text-left">{label}</span>
      <span className="shrink-0 text-[10px] underline underline-offset-2 decoration-2 opacity-70">
        Cambiar
      </span>
    </button>
  );
}

export function TopAppBar() {
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Publica la altura real del app bar como variable CSS para que barras
  // sticky (ej. categorías de /menu) se posicionen debajo sin solaparse.
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const apply = () => {
      document.documentElement.style.setProperty(
        "--kp-appbar-h",
        `${Math.round(el.getBoundingClientRect().height)}px`,
      );
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <header ref={headerRef} className="sticky top-0 z-40 bg-kp-yellow border-b-4 border-kp-ink">
      {/* Una sola instancia de la píldora: en móvil salta a su propia línea
          (order-last + w-full), en desktop vuelve a la fila del logo. */}
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link to="/" className="flex items-center shrink-0" aria-label="KINGPAPA — Inicio">
          <img src={logoDark.url} alt="KINGPAPA" className="h-8 md:h-9 w-auto" />
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="font-display uppercase text-sm tracking-wider px-3 py-2 hover:bg-kp-ink hover:text-kp-yellow transition-colors data-[status=active]:underline data-[status=active]:underline-offset-4 data-[status=active]:decoration-4"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 ml-auto shrink-0 lg:order-2">
          <UserMenu />
          <BrutalButton
            variant="dark"
            size="sm"
            className="lg:hidden"
            aria-label="Abrir menú"
            onClick={() => setOpen(!open)}
          >
            {open ? "Cerrar" : "Menú"}
          </BrutalButton>
        </div>

        <div className="order-last w-full lg:order-1 lg:w-auto lg:ml-auto min-w-0">
          <LocationPill />
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t-4 border-kp-ink bg-kp-yellow">
          <nav className="px-4 py-4 flex flex-col gap-2">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="font-display uppercase text-xl tracking-wider py-2 border-b-2 border-kp-ink/20 last:border-0"
              >
                {n.label}
              </Link>
            ))}
            <BrutalLink href="#pedir" variant="dark" size="md" block>
              Pedir Ahora
            </BrutalLink>
          </nav>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 bg-kp-ink text-kp-cheese border-t-4 border-kp-ink">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2">
            <div className="mb-3">
              <img src={logoLight.url} alt="KINGPAPA" className="h-10 w-auto" />
            </div>
            <p className="text-sm text-kp-cheese/80 max-w-sm">
              Los REYES de esta pendeja’. Salchipapas monstruosas, bowls coronados y retos pa’ toda
              la banda. Cero dieta, cero drama. 👑🔥
            </p>
          </div>
          <div>
            <h4 className="font-display text-kp-yellow text-lg mb-3">El Reino</h4>
            <ul className="space-y-1 text-sm">
              <li>
                <Link to="/menu">Menú</Link>
              </li>
              <li>
                <Link to="/sedes">Sedes</Link>
              </li>
              <li>
                <Link to="/franquicias">Franquicias</Link>
              </li>
              <li>
                <Link to="/historias">Historias</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-display text-kp-yellow text-lg mb-3">Trabaja con la banda</h4>
            <ul className="space-y-1 text-sm">
              <li>
                <a href="https://wa.me/573172455336" target="_blank" rel="noopener noreferrer">
                  WhatsApp · 317 245 5336
                </a>
              </li>
              <li>
                <a href="https://wa.me/573150272030" target="_blank" rel="noopener noreferrer">
                  Hojas de vida · 315 027 2030
                </a>
              </li>
              <li>
                <a href="https://wa.me/573164317572" target="_blank" rel="noopener noreferrer">
                  Proveedores · 316 431 7572
                </a>
              </li>
              <li>
                <a href="mailto:contabilidadmvk@gmail.com">Factura electrónica</a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/kingpapaco"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href="https://www.tiktok.com/@kingpapaco"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  TikTok
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-kp-cheese/20 flex flex-col md:flex-row gap-3 md:items-center md:justify-between text-xs text-kp-cheese/70">
          <span>© {new Date().getFullYear()} KINGPAPA — Reino registrado.</span>
          <span className="font-display text-kp-yellow text-base uppercase">
            Si estás a dieta, NO nos sigas.
          </span>
        </div>
      </div>
    </footer>
  );
}
