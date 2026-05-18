import { Link } from "@tanstack/react-router";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalButton, BrutalLink } from "@/components/ui-kp/BrutalButton";

// Formato estable SSR/CSR (evita hydration mismatch por locale del runtime).
const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
export function formatFecha(iso: string): string {
  const [y, m] = iso.split("-");
  const idx = Math.max(0, Math.min(11, parseInt(m, 10) - 1));
  return `${MESES[idx]} ${y}`;
}
import type { Sede, Historia } from "@/types/kp";

export function LocationCard({ sede }: { sede: Sede }) {
  const services = [
    sede.delivery && "Delivery",
    sede.pickup && "Pick-up",
    sede.qrMesa && "QR mesa",
  ].filter(Boolean) as string[];

  return (
    <BrutalCard tone="cheese" className="p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-2xl uppercase leading-none">{sede.nombre}</h3>
          <p className="text-sm mt-1">{sede.direccion}</p>
          <p className="text-xs text-kp-ink/70">{sede.ciudad}{sede.barrio ? ` · ${sede.barrio}` : ""}</p>
        </div>
        <BrutalBadge tone={sede.abiertaAhora ? "lime" : "black"}>
          {sede.abiertaAhora ? "Abierto" : "Cerrado"}
        </BrutalBadge>
      </div>
      <p className="text-xs font-display uppercase">{sede.horario}</p>
      <div className="flex flex-wrap gap-1">
        {services.map((s) => (
          <span key={s} className="text-[10px] font-display uppercase bg-kp-ink text-kp-cheese px-2 py-1">
            {s}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <BrutalLink
          href={sede.whatsapp ? `https://wa.me/${sede.whatsapp}` : "#"}
          external={!!sede.whatsapp}
          size="sm"
          variant="primary"
        >
          Pedir aquí
        </BrutalLink>
        <BrutalLink
          href={sede.mapsUrl || `https://www.google.com/maps/search/${encodeURIComponent(sede.direccion + " " + sede.ciudad)}`}
          external
          size="sm"
          variant="ghost"
        >
          Cómo llegar
        </BrutalLink>
      </div>
    </BrutalCard>
  );
}

export function EventCard({ historia }: { historia: Historia }) {
  return (
    <BrutalCard tone="cheese" className="overflow-hidden flex flex-col">
      <div className="aspect-[4/3] bg-kp-ink">
        <img
          src={historia.imagen}
          alt={historia.titulo}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-center justify-between">
          <BrutalBadge tone="purple">{historia.categoria}</BrutalBadge>
          <span className="text-xs text-kp-ink/60">{formatFecha(historia.fecha)}</span>
        </div>
        <h3 className="font-display text-xl uppercase leading-tight">{historia.titulo}</h3>
        <p className="text-sm text-kp-ink/80 line-clamp-3">{historia.extracto}</p>
        <div className="flex gap-2 mt-auto pt-2">
          <Link
            to="/historias/$slug"
            params={{ slug: historia.slug }}
            className="inline-block px-3 py-2 bg-kp-ink text-kp-yellow font-display uppercase text-sm border-2 border-kp-ink shadow-brutal-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition"
          >
            Leer historia
          </Link>
          {historia.videoUrl && (
            <BrutalLink href={historia.videoUrl} external size="sm" variant="fire">
              Ver video
            </BrutalLink>
          )}
        </div>
      </div>
    </BrutalCard>
  );
}
