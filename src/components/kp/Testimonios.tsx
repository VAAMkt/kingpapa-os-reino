import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";

const testimonios = [
  {
    name: "Andrea P.",
    city: "Cali",
    text: "Me tatué la corona y me dieron papas de por vida. 10/10.",
  },
  {
    name: "Camilo R.",
    city: "Bogotá",
    text: "El KINGCHARRÓN es una vuelta. Brutal nivel de queso.",
  },
  {
    name: "Vale M.",
    city: "Medellín",
    text: "Llegué al after rumba y salí coronada. Recomendadísimo.",
  },
  { name: "Sebas L.", city: "Jamundí", text: "Pedimos la gigante pa' 6, sobró pa' 2 más. Locura." },
];

export function Testimonios() {
  return (
    <div>
      <div className="flex items-end justify-between mb-5">
        <div>
          <BrutalBadge tone="lime">El Reino habla por sí solo</BrutalBadge>
          <h2 className="font-display text-4xl md:text-5xl uppercase mt-2">Voces del Reino</h2>
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
          href="https://instagram.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-display uppercase text-sm underline underline-offset-4 decoration-4 decoration-kp-yellow"
        >
          Ver el Reino en Instagram →
        </a>
        <a
          href="https://tiktok.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-display uppercase text-sm underline underline-offset-4 decoration-4 decoration-kp-purple"
        >
          Ver el Reino en TikTok →
        </a>
      </div>
    </div>
  );
}
