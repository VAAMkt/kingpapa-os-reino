import { BrutalBadge } from "@/components/ui-kp/Brutal";

/**
 * FAQ del Reino — respuestas verbatim tomadas de la Guía KINGPAPA 360.
 * No inventar copy: si algo falta, se agrega desde la guía oficial.
 */

type FaqItem = { q: string; a: React.ReactNode };

const FAQS: FaqItem[] = [
  {
    q: "¿Hacen domicilios?",
    a: (
      <>
        Siza. Pedí directo a nuestra línea nacional{" "}
        <a
          href="https://wa.me/573172455336"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-4 decoration-kp-yellow"
        >
          317 245 5336
        </a>{" "}
        📲 o desde la web y evitá comisiones de apps.
      </>
    ),
  },
  {
    q: "¿Puedo recoger en punto?",
    a: (
      <>
        Podés llegar al punto por el pedido sin mente. Regalános <strong>nombre, teléfono, pedido y sede</strong>, y arrimate en unos 45 min. Si sale antes te tiramos un call 👑
      </>
    ),
  },
  {
    q: "¿Manejan reservas?",
    a: (
      <>
        Que pena omme, pilla que no manejamos reservas porque la afluencia es mucha y el lugar no es tan grande… Pero llegate que acá <strong>sí o sí</strong> la vas a pasar melito.
      </>
    ),
  },
  {
    q: "¿Tienen opciones vegetarianas?",
    a: (
      <>
        Sí. Podés pedirla <strong>sin proteína animal</strong> y meterle queso, maíz, cebolla crispy o aguacate. 🥑
      </>
    ),
  },
  {
    q: "¿Qué salsas manejan?",
    a: (
      <>
        En el Reino siempre hay pa' todos los gustos: <strong>Salsa de la casa, BBQ, Salsa KING con pepinillos, Picante y de Ajo</strong> 😎
      </>
    ),
  },
  {
    q: "¿Cómo funciona el Reto Kingpapa?",
    a: (
      <>
        Llegate a cualquier sede y pedí la del reto ($139.900). Tenés que terminar <strong>4.1 kilos</strong> en menos de <strong>30 minutos</strong>. ¡Ya es 1 palo! Aplica sólo para mayores de edad. 💪🏻🏰
      </>
    ),
  },
  {
    q: "¿Tienen algo pa' cumpleaños?",
    a: (
      <>
        Tenemos el combo cumpleaños por <strong>$55.000</strong> 🥳: Show de chicharrón a la mesa, show de queso a la mesa, 1 corona, 1 vela volcán y 1 brownie.
      </>
    ),
  },
  {
    q: "¿Y si no hay cobertura en mi zona?",
    a: (
      <>
        Lamentablemente hoy no llegamos hasta tu zona, pero nos podés encontrar en <strong>Rappi o DiDi</strong> — seguro que con los parceros llegamos. O si preferís, te esperamos en una de nuestras sedes, estamos ready pa' atenderte 💪🏻🏰
      </>
    ),
  },
  {
    q: "Estoy buscando trabajo, ¿a dónde mando la HV?",
    a: (
      <>
        En el Reino siempre estamos buscando cracks 💪👑. Mandá la hoja de vida al{" "}
        <a
          href="https://wa.me/573150272030"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-4 decoration-kp-yellow"
        >
          +57 315 027 2030
        </a>
        .
      </>
    ),
  },
  {
    q: "Soy proveedor y me gustaría trabajar con ustedes",
    a: (
      <>
        Píllate de nuestra líder de compras:{" "}
        <a
          href="https://wa.me/573164317572"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-4 decoration-kp-yellow"
        >
          +57 316 431 7572
        </a>{" "}
        👑🤩
      </>
    ),
  },
  {
    q: "Necesito factura electrónica",
    a: (
      <>
        Escribinos a{" "}
        <a
          href="mailto:contabilidadmvk@gmail.com"
          className="underline decoration-4 decoration-kp-yellow"
        >
          contabilidadmvk@gmail.com
        </a>{" "}
        adjuntando el <strong>RUT y la foto de la factura</strong>. 💪👑
      </>
    ),
  },
  {
    q: "Soy influencer / foodie / tengo comunidad digital",
    a: (
      <>
        ¡Qué chimba que quieras hacer parte de la banda! 🤘🔥 Registrate acá:{" "}
        <a
          href="https://forms.gle/7j5cmvwGSZfbeJnd7"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-4 decoration-kp-yellow"
        >
          formulario oficial
        </a>
        .
      </>
    ),
  },
];

export function FaqKing({ title = "Preguntas de la banda" }: { title?: string }) {
  return (
    <div>
      <div className="mb-5">
        <BrutalBadge tone="yellow">FAQ</BrutalBadge>
        <h2 className="font-display text-4xl md:text-5xl uppercase mt-2 leading-none">
          {title}
        </h2>
        <p className="mt-2 text-sm text-kp-ink/70">
          Lo que más nos preguntan, respondido como te lo diría The King.
        </p>
      </div>

      <div className="border-2 border-kp-ink bg-kp-cheese divide-y-2 divide-kp-ink/20 shadow-brutal">
        {FAQS.map((f, i) => (
          <details key={i} className="group">
            <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 hover:bg-kp-yellow/40">
              <span className="font-display uppercase text-sm md:text-base">
                {f.q}
              </span>
              <span
                aria-hidden
                className="text-lg font-display transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <div className="px-4 pb-4 text-sm text-kp-ink/90 leading-relaxed">
              {f.a}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
