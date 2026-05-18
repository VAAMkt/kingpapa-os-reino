import { useState } from "react";
import { BrutalCard, BrutalBadge, BrutalInput } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import type { LeadFranquicia } from "@/types/kp";

/**
 * LeadFormFranquicia
 * Captura inversionistas/franquiciados.
 * TODO: POST /api/leads/franquicia → CRM (HubSpot, Pipedrive, etc.)
 */
export function LeadFormFranquicia() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState<LeadFranquicia>({
    nombre: "",
    ciudad: "",
    whatsapp: "",
    email: "",
    rangoInversion: "100-200M",
    experiencia: "",
    comentarios: "",
  });

  function update<K extends keyof LeadFranquicia>(k: K, v: LeadFranquicia[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: POST /api/leads/franquicia
    try {
      const prev = JSON.parse(localStorage.getItem("kp_leads") || "[]");
      localStorage.setItem("kp_leads", JSON.stringify([...prev, { ...form, ts: Date.now() }]));
    } catch {/* ignore */}
    setSent(true);
  }

  if (sent) {
    return (
      <BrutalCard tone="yellow" className="p-7 text-center">
        <div className="text-5xl">👑</div>
        <h3 className="font-display text-3xl uppercase mt-2">Aplicación recibida</h3>
        <p className="mt-2">Te escribimos por WhatsApp en menos de 48 horas, papi.</p>
      </BrutalCard>
    );
  }

  return (
    <BrutalCard tone="cheese" className="p-5 md:p-7">
      <BrutalBadge tone="red">Franquicia</BrutalBadge>
      <h3 className="font-display text-3xl md:text-4xl uppercase mt-3">
        Aplicar para franquicia
      </h3>
      <p className="text-sm mt-2 text-kp-ink/80">
        Cuéntanos quién eres y dónde quieres plantar la corona.
      </p>

      <form onSubmit={submit} className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        <BrutalInput placeholder="Nombre completo" required value={form.nombre} onChange={(e) => update("nombre", e.target.value)} />
        <BrutalInput placeholder="Ciudad" required value={form.ciudad} onChange={(e) => update("ciudad", e.target.value)} />
        <BrutalInput placeholder="WhatsApp" required value={form.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} />
        <BrutalInput placeholder="Email" type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} />
        <select
          value={form.rangoInversion}
          onChange={(e) => update("rangoInversion", e.target.value as LeadFranquicia["rangoInversion"])}
          className="px-4 py-3 bg-kp-cheese border-2 border-kp-ink shadow-brutal-sm font-body md:col-span-2"
        >
          <option value="50-100M">Inversión $50M – $100M</option>
          <option value="100-200M">Inversión $100M – $200M</option>
          <option value="200M+">Inversión $200M+</option>
        </select>
        <textarea
          placeholder="Experiencia en F&B o retail"
          required
          rows={3}
          value={form.experiencia}
          onChange={(e) => update("experiencia", e.target.value)}
          className="px-4 py-3 bg-kp-cheese border-2 border-kp-ink shadow-brutal-sm font-body md:col-span-2"
        />
        <textarea
          placeholder="Comentarios (opcional)"
          rows={2}
          value={form.comentarios}
          onChange={(e) => update("comentarios", e.target.value)}
          className="px-4 py-3 bg-kp-cheese border-2 border-kp-ink shadow-brutal-sm font-body md:col-span-2"
        />
        <BrutalButton type="submit" variant="primary" size="lg" block className="md:col-span-2">
          Aplicar para franquicia
        </BrutalButton>
      </form>
    </BrutalCard>
  );
}
