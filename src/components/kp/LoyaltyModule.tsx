import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BrutalCard, BrutalBadge, BrutalInput } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import { quiz, calcularArquetipo } from "@/data/quiz";
import { CLAN_COPY } from "@/lib/loyalty-model";
import { saveSubditoQuiz, type QuizAnswers } from "@/lib/loyalty.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const PRIVACY_POLICY_URL =
  "https://kingpapacali.com/wp-content/uploads/2024/02/PO-CM-15-POLITICA-DE-TRATAMIENTO-DE-DATOS.docx.pdf";

/**
 * LoyaltyModule — registro de "creyentes del Reino" + quiz teaser.
 * Captura zero-party data y emails/WhatsApp.
 */
export function LoyaltyModule() {
  const [openQuiz, setOpenQuiz] = useState(false);

  return (
    <BrutalCard id="test-clanes" tone="purple" className="p-5 md:p-8 scroll-mt-24">
      <div className="grid md:grid-cols-2 gap-6 items-center">
        <div>
          <BrutalBadge tone="yellow">Creyentes del Reino</BrutalBadge>
          <h2 className="font-display text-4xl md:text-5xl uppercase mt-3 leading-none">
            Hazte creyente del Reino y come más por menos
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
              Hacer el test de creyente
            </BrutalButton>
          </div>
        </div>

        <BrutalCard tone="cheese" className="p-5">
          <h3 className="font-display text-2xl uppercase">¿Qué tipo de creyente eres?</h3>
          <p className="text-sm mt-2 text-kp-ink/80">
            Descúbrelo en 30 segundos. 6 preguntas. Sin sermón.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="border-2 border-kp-ink p-2">
              🍻
              <br />
              After
            </div>
            <div className="border-2 border-kp-ink p-2">
              👷
              <br />
              Acero
            </div>
            <div className="border-2 border-kp-ink p-2">
              👑
              <br />
              Fórmula
            </div>
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
  const { user, isAuthenticated } = useAuth();
  const saveQuiz = useServerFn(saveSubditoQuiz);
  const [idx, setIdx] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);
  const [saving, setSaving] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [done, setDone] = useState(false);

  const total = quiz.length;
  const q = quiz[idx];

  function answer(value: string) {
    const next = { ...respuestas, [q.campo]: value };
    setRespuestas(next);
    if (idx + 1 < total) setIdx(idx + 1);
    else setIdx(total); // pasa a captura de contacto
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const arquetipo = calcularArquetipo(respuestas);
    const payload = {
      whatsapp,
      arquetipo,
      respuestas: respuestas as QuizAnswers,
      ciudad: respuestas.ciudad,
      habeas_data_accepted: true as const,
    };
    setSaving(true);
    try {
      if (isAuthenticated) {
        await saveQuiz({ data: payload });
      } else if (hasAccount) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        await saveQuiz({ data: payload });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/mi-reino`,
            data: {
              display_name: email.split("@")[0],
              whatsapp,
              ciudad: respuestas.ciudad,
              quiz_clan: arquetipo,
              quiz_respuestas: respuestas,
              habeas_data_accepted: true,
              habeas_data_version: "PO-CM-15/2024-01-31",
            },
          },
        });
        if (error) throw error;
        if (data.session) await saveQuiz({ data: payload });
        else setNeedsConfirmation(true);
      }
      setDone(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No pudimos guardar tu clan";
      toast.error(/already registered|already been registered/i.test(message)
        ? "Ese correo ya tiene cuenta. Elige ‘Ya tengo cuenta’."
        : message);
    } finally {
      setSaving(false);
    }
  }

  const arquetipo = done ? calcularArquetipo(respuestas) : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-kp-ink/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <BrutalCard tone="yellow" className="p-5 md:p-7">
          <div className="flex items-center justify-between mb-4">
            <BrutalBadge tone="black">
              {done ? "Coronado" : idx < total ? `Pregunta ${idx + 1}/${total}` : "Casi listo"}
            </BrutalBadge>
            <button onClick={onClose} className="font-display text-lg" aria-label="Cerrar">
              ✕
            </button>
          </div>

          {!done && idx < total && (
            <>
              <h3 className="font-display text-2xl uppercase">{q.pregunta}</h3>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {q.opciones.map((o) => (
                  <BrutalButton key={o.id} variant="ghost" onClick={() => answer(o.id)}>
                    {o.emoji ? `${o.emoji} ` : ""}
                    {o.label}
                  </BrutalButton>
                ))}
              </div>
            </>
          )}

          {!done && idx === total && (
            <>
              <h3 className="font-display text-2xl uppercase">Última cosa, papi</h3>
              <p className="text-sm mt-1">Para coronarte y enviarte los combos secretos.</p>
              <form className="mt-4 space-y-3" onSubmit={submit}>
                {isAuthenticated ? (
                  <p className="text-sm">Guardaremos tu clan en {user?.email}.</p>
                ) : (
                  <>
                    <BrutalInput
                      type="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <BrutalInput
                      type="password"
                      placeholder={hasAccount ? "Tu contraseña" : "Crea una contraseña"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={8}
                      required
                    />
                  </>
                )}
                <BrutalInput
                  type="tel"
                  placeholder="WhatsApp (3xx xxx xxxx)"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  minLength={7}
                  required
                />
                <label className="flex items-start gap-2 text-xs text-left">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    required
                    className="mt-0.5"
                  />
                  <span>
                    Autorizo a KINGPAPA a tratar mis datos para gestionar mi cuenta, beneficios y
                    comunicaciones, conforme a la{" "}
                    <a
                      href={PRIVACY_POLICY_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="underline font-bold"
                    >
                      política de tratamiento de datos
                    </a>
                    .
                  </span>
                </label>
                <BrutalButton block type="submit" disabled={!accepted || saving}>
                  {saving ? "Guardando…" : isAuthenticated ? "Guardar mi clan" : hasAccount ? "Entrar y guardar mi clan" : "Crear cuenta y coronarme"}
                </BrutalButton>
                {!isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => setHasAccount((value) => !value)}
                    className="block mx-auto text-xs underline font-bold"
                  >
                    {hasAccount ? "Quiero crear mi cuenta" : "Ya tengo cuenta"}
                  </button>
                )}
              </form>
            </>
          )}

          {done && arquetipo && (
            <div className="text-center">
              <div className="text-6xl">👑</div>
              <h3 className="font-display text-3xl uppercase mt-2">{arquetipo}</h3>
              <p className="text-sm mt-2 max-w-sm mx-auto">
                {CLAN_COPY[arquetipo]}
              </p>
              {needsConfirmation && (
                <p className="text-xs mt-3">Revisa tu correo para confirmar la cuenta. Tu clan ya quedó guardado.</p>
              )}
              <BrutalButton
                block
                className="mt-5"
                variant="dark"
                onClick={() => {
                  if (!needsConfirmation) window.location.href = "/mi-reino";
                  else onClose();
                }}
              >
                {needsConfirmation ? "Entendido" : "Entrar a Mi Reino"}
              </BrutalButton>
            </div>
          )}
        </BrutalCard>
      </div>
    </div>
  );
}
