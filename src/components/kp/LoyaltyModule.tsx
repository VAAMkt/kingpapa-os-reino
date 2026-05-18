import { useState } from "react";
import { BrutalCard, BrutalBadge, BrutalInput } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import { quiz, calcularArquetipo } from "@/data/quiz";
import type { Subdito } from "@/types/kp";

/**
 * LoyaltyModule — registro de "súbditos del Reino" + quiz teaser.
 * Captura zero-party data y emails/WhatsApp.
 * TODO: POST /api/subditos { ...subdito } al backend de loyalty.
 */
export function LoyaltyModule() {
  const [openQuiz, setOpenQuiz] = useState(false);

  return (
    <BrutalCard tone="purple" className="p-5 md:p-8">
      <div className="grid md:grid-cols-2 gap-6 items-center">
        <div>
          <BrutalBadge tone="yellow">Súbditos del Reino</BrutalBadge>
          <h2 className="font-display text-4xl md:text-5xl uppercase mt-3 leading-none">
            Hazte súbdito del Reino y come más por menos
          </h2>
          <ul className="mt-5 space-y-2 text-sm font-medium">
            <li>👑 Retos solo para miembros</li>
            <li>🤫 Combos secretos cada mes</li>
            <li>🎁 Premios por frecuencia</li>
            <li>🤝 Beneficios por invitar al parche</li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <BrutalButton variant="primary" size="lg" onClick={() => setOpenQuiz(true)}>
              Crear mi corona digital
            </BrutalButton>
            <BrutalButton variant="ghost" size="lg" onClick={() => setOpenQuiz(true)}>
              Hacer el test de súbdito
            </BrutalButton>
          </div>
        </div>

        <BrutalCard tone="cheese" className="p-5">
          <h3 className="font-display text-2xl uppercase">¿Qué tipo de súbdito eres?</h3>
          <p className="text-sm mt-2 text-kp-ink/80">
            Descúbrelo en 30 segundos. 6 preguntas. Sin sermón.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="border-2 border-kp-ink p-2">🍻<br/>Rumbero</div>
            <div className="border-2 border-kp-ink p-2">👷<br/>Obrero</div>
            <div className="border-2 border-kp-ink p-2">👑<br/>Cabezón</div>
          </div>
          <BrutalButton block className="mt-4" onClick={() => setOpenQuiz(true)}>
            Empezar test
          </BrutalButton>
        </BrutalCard>
      </div>

      {openQuiz && <QuizModal onClose={() => setOpenQuiz(false)} />}
    </BrutalCard>
  );
}

function QuizModal({ onClose }: { onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [done, setDone] = useState(false);

  const total = quiz.length;
  const q = quiz[idx];

  function answer(value: string) {
    const next = { ...respuestas, [q.campo]: value };
    setRespuestas(next);
    if (idx + 1 < total) setIdx(idx + 1);
    else setIdx(total); // pasa a captura de contacto
  }

  function submit() {
    const arquetipo = calcularArquetipo(respuestas);
    const subdito: Subdito = {
      email,
      whatsapp,
      arquetipo,
      respuestas,
      ciudad: respuestas.ciudad as Subdito["ciudad"],
      createdAt: new Date().toISOString(),
    };
    // TODO: POST /api/subditos
    try {
      localStorage.setItem("kp_subdito", JSON.stringify(subdito));
    } catch {/* ignore */}
    setDone(true);
  }

  const arquetipo = done ? calcularArquetipo(respuestas) : null;

  return (
    <div className="fixed inset-0 z-50 bg-kp-ink/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <BrutalCard tone="yellow" className="p-5 md:p-7">
          <div className="flex items-center justify-between mb-4">
            <BrutalBadge tone="black">
              {done ? "Coronado" : idx < total ? `Pregunta ${idx + 1}/${total}` : "Casi listo"}
            </BrutalBadge>
            <button onClick={onClose} className="font-display text-lg" aria-label="Cerrar">✕</button>
          </div>

          {!done && idx < total && (
            <>
              <h3 className="font-display text-2xl uppercase">{q.pregunta}</h3>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {q.opciones.map((o) => (
                  <BrutalButton key={o.id} variant="ghost" onClick={() => answer(o.id)}>
                    {o.emoji ? `${o.emoji} ` : ""}{o.label}
                  </BrutalButton>
                ))}
              </div>
            </>
          )}

          {!done && idx === total && (
            <>
              <h3 className="font-display text-2xl uppercase">Última cosa, papi</h3>
              <p className="text-sm mt-1">Para coronarte y enviarte los combos secretos.</p>
              <div className="mt-4 space-y-3">
                <BrutalInput
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <BrutalInput
                  type="tel"
                  placeholder="WhatsApp (3xx xxx xxxx)"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
                <BrutalButton block onClick={submit} disabled={!email && !whatsapp}>
                  Coronarme
                </BrutalButton>
              </div>
            </>
          )}

          {done && arquetipo && (
            <div className="text-center">
              <div className="text-6xl">👑</div>
              <h3 className="font-display text-3xl uppercase mt-2">{arquetipo}</h3>
              <p className="text-sm mt-2 max-w-sm mx-auto">
                Bienvenido al Reino. Vamos a mandarte combos hechos pa’ ti.
              </p>
              <BrutalButton block className="mt-5" variant="dark" onClick={onClose}>
                Entrar al Reino
              </BrutalButton>
            </div>
          )}
        </BrutalCard>
      </div>
    </div>
  );
}
