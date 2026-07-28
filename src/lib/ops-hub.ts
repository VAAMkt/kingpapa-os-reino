// Client ligero para el backend público del Ops Hub (Perfect Operations Hub).
// La edge function `franchise-lead-intake` acepta 2 pasos: crea el lead parcial
// (step 1) y luego completa cualificación + franchise_application (step 2).
//
// URL + anon key vienen de env vars (VITE_OPS_HUB_SUPABASE_URL / _ANON_KEY).
// Son claves PUBLICAS (publishable/anon) → seguro embeberlas si el env falla,
// pero preferimos env para poder repuntar staging vs prod sin redeploy.

const FALLBACK_URL = "https://wjgfozxecslnujwhvmrm.supabase.co";
const FALLBACK_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZ2ZvenhlY3NsbnVqd2h2bXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NjI0MzEsImV4cCI6MjA4MTIzODQzMX0._P8Ow3TdNMu3soKjR4fxw_Y_LyGK-cdZhaxHkISX6MA";

const OPS_URL = (import.meta.env.VITE_OPS_HUB_SUPABASE_URL as string) || FALLBACK_URL;
const OPS_ANON = (import.meta.env.VITE_OPS_HUB_SUPABASE_ANON_KEY as string) || FALLBACK_ANON;

export interface FranchiseStep1Payload {
  step: 1;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  country?: string;
  source?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

export interface FranchiseStep2Payload {
  step: 2;
  lead_id: string;
  barrio?: string;
  ha_probado_producto: boolean;
  motivacion: string;
  participa_operacion: "si" | "no" | "tal_vez";
  current_occupation?: string;
  has_food_industry_exp: boolean;
  declared_investment_cop?: number;
  has_proof_of_funds: boolean;
}

export type FranchiseIntakePayload = FranchiseStep1Payload | FranchiseStep2Payload;

export interface FranchiseIntakeStep1Response {
  lead_id: string;
}
export interface FranchiseIntakeStep2Response {
  ok?: boolean;
  application_id?: string;
  // score/is_high_priority también los devuelve el backend pero NO se exponen al usuario.
}

export async function postFranchiseIntake<T>(payload: FranchiseIntakePayload): Promise<T> {
  const res = await fetch(`${OPS_URL}/functions/v1/franchise-lead-intake`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: OPS_ANON,
      Authorization: `Bearer ${OPS_ANON}`,
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(json?.error || `Ops Hub intake failed (${res.status})`);
  }
  return json as T;
}
