import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";

const testimonios = [
  {
    name: "Andrea P.",
    city: "Cali",
    text: "Me tatué la corona y me dieron papas de por vida. Brutal, 10/10.",
  },
  {
    name: "Camilo R.",
    city: "Bogotá",
    text: "El KINGCHARRÓN es una vuelta. Brutal nivel de queso, mi so.",
  },
  {
    name: "Vale M.",
    city: "Medellín",
    text: "Llegué al after rumba y salí coronada. Cero drama, pura chimba.",
  },
  {
    name: "Sebas L.",
    city: "Jamundí",
    text: "Pedimos la gigante pa’ toda la banda, sobró hasta pa’ el pana. Locura.",
  },
];

export function Testimonios() {
  return (
    <div>
      <div className="flex items-end justify-between mb-5">
        <div>
          <BrutalBadge tone="lime">La banda habla por sí sola</BrutalBadge>
          <h2 className="font-display text-4xl md:text-5xl uppercase mt-2">La banda habla</h2>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {testimonios.map((t) => (
          <BrutalCard key={t.name} tone="cheese" className="p-4">
            <p className="text-sm font-medium">“{t.text}”</p>
            <p className="mt-3 font-display uppercase text-xs tracking-wider">
              {t.name} — {t.city}
            </p>
          </BrutalCard>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <a
          href="https://www.instagram.com/kingpapaco"
          target="_blank"
          rel="noopener noreferrer"
          className="font-display uppercase text-sm underline underline-offset-4 decoration-4 decoration-kp-yellow"
        >
          Ver a la banda en Instagram →
        </a>
        <a
          href="https://www.tiktok.com/@kingpapaco"
          target="_blank"
          rel="noopener noreferrer"
          className="font-display uppercase text-sm underline underline-offset-4 decoration-4 decoration-kp-purple"
        >
          Ver a la banda en TikTok →
        </a>
      </div>
    </div>
  );
}
