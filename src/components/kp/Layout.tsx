import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { BrutalLink, BrutalButton } from "@/components/ui-kp/BrutalButton";
import { UserMenu } from "@/components/auth/UserMenu";
import crown from "@/assets/crown.png";

const nav = [
  { to: "/menu", label: "Menú" },
  { to: "/", label: "El Reino" },
  { to: "/sedes", label: "Sedes" },
  { to: "/franquicias", label: "Franquicias" },
  { to: "/historias", label: "Historias" },
] as const;

export function TopAppBar() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 bg-kp-yellow border-b-4 border-kp-ink">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-3 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2">
          <img src={crown} alt="KINGPAPA" width={36} height={36} className="w-9 h-9" />
          <span className="font-display text-2xl md:text-3xl tracking-wide">KINGPAPA</span>
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

        <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-2 mb-3">
              <img src={crown} alt="" width={40} height={40} className="w-10 h-10" />
              <span className="font-display text-3xl text-kp-yellow">KINGPAPA</span>
            </div>
            <p className="text-sm text-kp-cheese/80 max-w-sm">
              Los REYES de esta pendeja’. Salchipapas monstruosas, bowls coronados y retos
              que solo un verdadero súbdito del Reino se atreve a probar.
            </p>
          </div>
          <div>
            <h4 className="font-display text-kp-yellow text-lg mb-3">El Reino</h4>
            <ul className="space-y-1 text-sm">
              <li><Link to="/menu">Menú</Link></li>
              <li><Link to="/sedes">Sedes</Link></li>
              <li><Link to="/franquicias">Franquicias</Link></li>
              <li><Link to="/historias">Historias</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display text-kp-yellow text-lg mb-3">Comunidad</h4>
            <ul className="space-y-1 text-sm">
              <li><a href="https://wa.me/573000000000" target="_blank" rel="noopener noreferrer">WhatsApp</a></li>
              <li><a href="https://instagram.com" target="_blank" rel="noopener noreferrer">Instagram</a></li>
              <li><a href="https://tiktok.com" target="_blank" rel="noopener noreferrer">TikTok</a></li>
              <li><a href="#">PQR</a></li>
              <li><a href="#">Trabaja con nosotros</a></li>
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
