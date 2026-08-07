import { useEffect, useState } from "react";
import { z } from "zod";
import { BrutalCard, BrutalBadge, BrutalInput } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import {
  postFranchiseIntake,
  type FranchiseIntakeStep1Response,
  type FranchiseIntakeStep2Response,
} from "@/lib/ops-hub";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * LeadFormFranquicia — flujo de 2 pasos integrado con el Ops Hub.
 * Paso 1 (datos básicos) crea un lead parcial en el CRM del Ops Hub aunque
 * el usuario abandone; el correo de "retoma tu postulación" que envía el
 * Ops Hub sigue apuntando a kingpapaops.com (decisión aprobada: opción A).
 */

const step1Schema = z.object({
  full_name: z.string().trim().min(2, "Nombre muy corto").max(120),
  email: z.string().trim().email("Email inválido").max(255),
  phone: z.string().trim().min(7, "Teléfono inválido").max(40),
  city: z.string().trim().min(2, "Ciudad requerida").max(120),
  privacy: z.literal(true, {
    errorMap: () => ({ message: "Debes aceptar el tratamiento de datos" }),
  }),
});

const INVESTMENT_RANGES = [
  { value: 25_000_000, label: "Menos de $50M COP" },
  { value: 75_000_000, label: "$50M – $100M COP" },
  { value: 200_000_000, label: "$101M – $300M COP" },
  { value: 400_000_000, label: "$301M – $500M COP" },
  { value: 600_000_000, label: "Más de $500M COP" },
] as const;

const step2Schema = z.object({
  barrio: z.string().trim().max(120).optional(),
  declared_investment_cop: z
    .number({ invalid_type_error: "Selecciona un rango" })
    .int()
    .min(1, "Selecciona un rango"),
  has_proof_of_funds: z.boolean({
    invalid_type_error: "Responde sí o no",
    required_error: "Responde sí o no",
  }),
  has_food_industry_exp: z.boolean({
    invalid_type_error: "Responde sí o no",
    required_error: "Responde sí o no",
  }),
  current_occupation: z.string().trim().max(120).optional(),
  participa_operacion: z.enum(["si", "no", "tal_vez"], {
    errorMap: () => ({ message: "Selecciona una opción" }),
  }),
  ha_probado_producto: z.boolean({
    invalid_type_error: "Responde sí o no",
    required_error: "Responde sí o no",
  }),
  motivacion: z
    .string()
    .trim()
    .min(20, "Cuéntanos un poco más (mín. 20 caracteres)")
    .max(2000),
});

type Step1State = {
  full_name: string;
  email: string;
  phone: string;
  city: string;
  privacy: boolean;
};

type Step2State = {
  barrio: string;
  declared_investment_cop: number | undefined;
  has_proof_of_funds: boolean | undefined;
  has_food_industry_exp: boolean | undefined;
  current_occupation: string;
  participa_operacion: "si" | "no" | "tal_vez" | undefined;
  ha_probado_producto: boolean | undefined;
  motivacion: string;
};

export function LeadFormFranquicia() {
  const [step, setStep] = useState<1 | 2>(1);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [s1, setS1] = useState<Step1State>({
    full_name: "",
    email: "",
    phone: "",
    city: "",
    privacy: false,
  });
  const [s2, setS2] = useState<Step2State>({
    barrio: "",
    declared_investment_cop: undefined,
    has_proof_of_funds: undefined,
    has_food_industry_exp: undefined,
    current_occupation: "",
    participa_operacion: undefined,
    ha_probado_producto: undefined,
    motivacion: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    track("franquicia_form_view");
  }, []);

  function flatten(err: z.ZodError): Record<string, string> {
    const out: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      if (!out[key]) out[key] = issue.message;
    }
    return out;
  }

  async function submitStep1(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const parsed = step1Schema.safeParse(s1);
    if (!parsed.success) {
      setErrors(flatten(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const params =
        typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const r = await postFranchiseIntake<FranchiseIntakeStep1Response>({
        step: 1,
        full_name: parsed.data.full_name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        city: parsed.data.city,
        country: "CO",
        source: "kingpapa.co/franquicias",
        utm_source: params?.get("utm_source") || undefined,
        utm_medium: params?.get("utm_medium") || undefined,
        utm_campaign: params?.get("utm_campaign") || undefined,
      });
      setLeadId(r.lead_id);
      setStep(2);
      track("franquicia_step1_submit", { lead_id: r.lead_id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setServerError("No pudimos guardar tus datos. Intenta de nuevo en un momento.");
      track("franquicia_form_error", { step: 1, message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitStep2(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!leadId) {
      setServerError("Sesión de postulación no encontrada. Recarga y vuelve a empezar.");
      return;
    }
    const parsed = step2Schema.safeParse(s2);
    if (!parsed.success) {
      setErrors(flatten(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await postFranchiseIntake<FranchiseIntakeStep2Response>({
        step: 2,
        lead_id: leadId,
        barrio: parsed.data.barrio || undefined,
        ha_probado_producto: parsed.data.ha_probado_producto,
        motivacion: parsed.data.motivacion,
        participa_operacion: parsed.data.participa_operacion,
        current_occupation: parsed.data.current_occupation || undefined,
        has_food_industry_exp: parsed.data.has_food_industry_exp,
        declared_investment_cop: parsed.data.declared_investment_cop,
        has_proof_of_funds: parsed.data.has_proof_of_funds,
      });
      setSent(true);
      track("franquicia_step2_submit");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setServerError("No pudimos enviar tu postulación. Intenta de nuevo.");
      track("franquicia_form_error", { step: 2, message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <BrutalCard tone="yellow" className="p-7 text-center">
        <div className="text-5xl">👑</div>
        <h2 className="font-display text-3xl uppercase mt-2">Postulación recibida</h2>
        <p className="mt-3 text-kp-ink/90">
          Nuestro equipo de Expansión revisa tu perfil y te contacta en los próximos días
          hábiles por email o WhatsApp.
        </p>
        <ol className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-left text-sm">
          <li className="border-2 border-kp-ink bg-kp-cheese p-3">
            <p className="font-display uppercase text-xs">01 · Revisión</p>
            <p className="mt-1">Validamos coherencia y perfil (24–48h).</p>
          </li>
          <li className="border-2 border-kp-ink bg-kp-cheese p-3">
            <p className="font-display uppercase text-xs">02 · Brochure + NDA</p>
            <p className="mt-1">Si avanzas, te enviamos info detallada.</p>
          </li>
          <li className="border-2 border-kp-ink bg-kp-cheese p-3">
            <p className="font-display uppercase text-xs">03 · Cita 1:1</p>
            <p className="mt-1">Modelo, inversión y próximos pasos.</p>
          </li>
        </ol>
      </BrutalCard>
    );
  }

  return (
    <BrutalCard tone="cheese" className="p-5 md:p-7">
      <BrutalBadge tone="red">Franquicia</BrutalBadge>
      <h2 className="font-display text-3xl md:text-4xl uppercase mt-3">
        Postula tu franquicia
      </h2>
      <p className="text-sm mt-2 text-kp-ink/80">
        Dos pasos. En el primero quedas registrado, así que si te sales retomamos después.
      </p>

      {/* Stepper */}
      <div className="mt-5 flex items-center gap-2 text-xs">
        <span
          className={cn(
            "font-display uppercase tracking-wide px-3 py-1 border-2 border-kp-ink",
            step === 1 ? "bg-kp-yellow text-kp-ink" : "bg-kp-cheese text-kp-ink/60",
          )}
        >
          1 · Datos básicos
        </span>
        <span aria-hidden className="text-kp-ink/60">
          →
        </span>
        <span
          className={cn(
            "font-display uppercase tracking-wide px-3 py-1 border-2 border-kp-ink",
            step === 2 ? "bg-kp-yellow text-kp-ink" : "bg-kp-cheese text-kp-ink/60",
          )}
        >
          2 · Cualificación
        </span>
      </div>

      {step === 1 && (
        <form onSubmit={submitStep1} className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <FieldWrap error={errors.full_name} className="md:col-span-2">
            <BrutalInput
              placeholder="Nombre completo"
              autoComplete="name"
              value={s1.full_name}
              onChange={(e) => setS1((p) => ({ ...p, full_name: e.target.value }))}
            />
          </FieldWrap>
          <FieldWrap error={errors.email}>
            <BrutalInput
              placeholder="Email"
              type="email"
              autoComplete="email"
              value={s1.email}
              onChange={(e) => setS1((p) => ({ ...p, email: e.target.value }))}
            />
          </FieldWrap>
          <FieldWrap error={errors.phone}>
            <BrutalInput
              placeholder="WhatsApp"
              autoComplete="tel"
              value={s1.phone}
              onChange={(e) => setS1((p) => ({ ...p, phone: e.target.value }))}
            />
          </FieldWrap>
          <FieldWrap error={errors.city} className="md:col-span-2">
            <BrutalInput
              placeholder="Ciudad de interés (Bogotá, Medellín…)"
              value={s1.city}
              onChange={(e) => setS1((p) => ({ ...p, city: e.target.value }))}
            />
          </FieldWrap>

          <label className="md:col-span-2 flex items-start gap-2 text-xs text-kp-ink/80">
            <input
              type="checkbox"
              className="mt-1 w-4 h-4 border-2 border-kp-ink"
              checked={s1.privacy}
              onChange={(e) => setS1((p) => ({ ...p, privacy: e.target.checked }))}
            />
            <span>
              Autorizo a KINGPAPA a tratar mis datos para contactarme sobre esta
              postulación, conforme a la política de tratamiento de datos personales.
            </span>
          </label>
          {errors.privacy && (
            <p className="md:col-span-2 -mt-2 text-xs text-kp-red font-body">
              {errors.privacy}
            </p>
          )}

          {serverError && (
            <p className="md:col-span-2 text-sm text-kp-red font-body">{serverError}</p>
          )}

          <BrutalButton
            type="submit"
            variant="primary"
            size="lg"
            block
            disabled={submitting}
            className="md:col-span-2"
          >
            {submitting ? "Guardando…" : "Continuar →"}
          </BrutalButton>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={submitStep2} className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          {s1.full_name && (
            <div className="md:col-span-2 border-2 border-kp-ink bg-kp-yellow px-3 py-2 text-xs font-body">
              Hola <strong>{s1.full_name.split(" ")[0]}</strong>, solo falta este paso para
              enviar tu postulación.
            </div>
          )}

          <FieldWrap error={errors.barrio} className="md:col-span-2">
            <BrutalInput
              placeholder="Barrio o zona específica (opcional)"
              value={s2.barrio}
              onChange={(e) => setS2((p) => ({ ...p, barrio: e.target.value }))}
            />
          </FieldWrap>

          <FieldWrap error={errors.declared_investment_cop} className="md:col-span-2">
            <label className="block text-xs font-display uppercase mb-1">
              ¿Cuánto estás dispuesto a invertir?
            </label>
            <select
              aria-label="Rango de inversión"
              value={s2.declared_investment_cop ?? ""}
              onChange={(e) =>
                setS2((p) => ({
                  ...p,
                  declared_investment_cop: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
              className="w-full px-4 py-3 bg-kp-cheese border-2 border-kp-ink shadow-brutal-sm font-body"
            >
              <option value="">Selecciona un rango…</option>
              {INVESTMENT_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </FieldWrap>

          <YesNoField
            label="¿Tienes acreditación o respaldo de los fondos?"
            value={s2.has_proof_of_funds}
            onChange={(v) => setS2((p) => ({ ...p, has_proof_of_funds: v }))}
            error={errors.has_proof_of_funds}
          />
          <YesNoField
            label="¿Tienes experiencia en restaurantes o food service?"
            value={s2.has_food_industry_exp}
            onChange={(v) => setS2((p) => ({ ...p, has_food_industry_exp: v }))}
            error={errors.has_food_industry_exp}
          />

          <FieldWrap error={errors.current_occupation} className="md:col-span-2">
            <BrutalInput
              placeholder="¿A qué te dedicas actualmente? (opcional)"
              value={s2.current_occupation}
              onChange={(e) => setS2((p) => ({ ...p, current_occupation: e.target.value }))}
            />
          </FieldWrap>

          <FieldWrap error={errors.participa_operacion} className="md:col-span-2">
            <label className="block text-xs font-display uppercase mb-1">
              ¿Participarías directamente en la operación?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["si", "tal_vez", "no"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setS2((p) => ({ ...p, participa_operacion: v }))}
                  className={cn(
                    "py-2 border-2 border-kp-ink font-display uppercase text-sm",
                    s2.participa_operacion === v
                      ? "bg-kp-ink text-kp-cheese"
                      : "bg-kp-cheese text-kp-ink shadow-brutal-sm",
                  )}
                >
                  {v === "si" ? "Sí" : v === "no" ? "No" : "Tal vez"}
                </button>
              ))}
            </div>
          </FieldWrap>

          <YesNoField
            label="¿Has probado nuestro producto?"
            value={s2.ha_probado_producto}
            onChange={(v) => setS2((p) => ({ ...p, ha_probado_producto: v }))}
            error={errors.ha_probado_producto}
            className="md:col-span-2"
          />

          <FieldWrap error={errors.motivacion} className="md:col-span-2">
            <label className="block text-xs font-display uppercase mb-1">
              ¿Por qué quieres ser franquiciado de KINGPAPA?
            </label>
            <textarea
              aria-label="Motivación para franquicia"
              rows={4}
              maxLength={2000}
              value={s2.motivacion}
              onChange={(e) => setS2((p) => ({ ...p, motivacion: e.target.value }))}
              placeholder="Cuéntanos tu motivación, expectativas y qué te entusiasma de la marca…"
              className="w-full px-4 py-3 bg-kp-cheese border-2 border-kp-ink shadow-brutal-sm font-body"
            />
          </FieldWrap>

          {serverError && (
            <p className="md:col-span-2 text-sm text-kp-red font-body">{serverError}</p>
          )}

          <div className="md:col-span-2 flex flex-col md:flex-row gap-3">
            <BrutalButton
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => setStep(1)}
              disabled={submitting}
            >
              ← Atrás
            </BrutalButton>
            <BrutalButton
              type="submit"
              variant="primary"
              size="lg"
              block
              disabled={submitting}
              className="flex-1"
            >
              {submitting ? "Enviando…" : "Enviar postulación"}
            </BrutalButton>
          </div>
        </form>
      )}
    </BrutalCard>
  );
}

function FieldWrap({
  children,
  error,
  className,
}: {
  children: React.ReactNode;
  error?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {children}
      {error && <p className="mt-1 text-xs text-kp-red font-body">{error}</p>}
    </div>
  );
}

function YesNoField({
  label,
  value,
  onChange,
  error,
  className,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (v: boolean) => void;
  error?: string;
  className?: string;
}) {
  return (
    <FieldWrap error={error} className={className}>
      <label className="block text-xs font-display uppercase mb-1">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        {[
          { v: true, label: "Sí" },
          { v: false, label: "No" },
        ].map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange(opt.v)}
            className={cn(
              "py-2 border-2 border-kp-ink font-display uppercase text-sm",
              value === opt.v
                ? "bg-kp-ink text-kp-cheese"
                : "bg-kp-cheese text-kp-ink shadow-brutal-sm",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </FieldWrap>
  );
}
