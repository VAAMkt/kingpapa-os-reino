import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { BrutalCard, BrutalBadge, BrutalInput } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import { cn } from "@/lib/utils";
import {
  CIUDADES_SUGERIDAS,
  createSede,
  slugifySede,
  updateSede,
  type SedeRow,
} from "@/lib/sedes";
import { toast } from "sonner";

const SedeSchema = z.object({
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  nombre: z.string().min(2).max(120),
  ciudad: z.string().min(2).max(60),
  direccion: z.string().min(4).max(240),
  barrio: z.string().max(120).optional().nullable(),
  mall: z.string().max(120).optional().nullable(),
  horario: z.string().min(2).max(120),
  abierta_ahora: z.boolean(),
  delivery: z.boolean(),
  pickup: z.boolean(),
  qr_mesa: z.boolean(),
  whatsapp: z
    .string()
    .regex(/^\d{8,15}$/, "Solo dígitos, ej. 573172455336")
    .optional()
    .nullable(),
  maps_url: z.string().url("URL inválida").optional().nullable(),
  orden: z.number().int().min(0).max(9999),
  publicado: z.boolean(),
  rp_local_id: z.number().int().min(0).max(999999).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  cobertura_radio_km: z.number().min(0).max(50),
});

type FormState = z.input<typeof SedeSchema>;

const emptyState: FormState = {
  slug: "",
  nombre: "",
  ciudad: "Cali",
  direccion: "",
  barrio: "",
  mall: "",
  horario: "12:00pm – 10:00pm",
  abierta_ahora: true,
  delivery: true,
  pickup: true,
  qr_mesa: false,
  whatsapp: "",
  maps_url: "",
  orden: 0,
  publicado: true,
  rp_local_id: null,
  lat: null,
  lng: null,
  cobertura_radio_km: 5,
};

const labelCls = "block font-display uppercase text-xs mb-1";
const fieldCls = "space-y-1";
const inputBaseCls = cn(
  "w-full px-4 py-3 bg-kp-cheese border-2 border-kp-ink shadow-brutal-sm",
  "font-body text-kp-ink placeholder:text-kp-ink/50",
  "focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-none",
);

export function SedeForm({ initial }: { initial?: SedeRow }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const editing = !!initial;

  const [form, setForm] = useState<FormState>(
    initial
      ? {
          slug: initial.slug,
          nombre: initial.nombre,
          ciudad: initial.ciudad,
          direccion: initial.direccion,
          barrio: initial.barrio ?? "",
          mall: initial.mall ?? "",
          horario: initial.horario,
          abierta_ahora: initial.abierta_ahora,
          delivery: initial.delivery,
          pickup: initial.pickup,
          qr_mesa: initial.qr_mesa,
          whatsapp: initial.whatsapp ?? "",
          maps_url: initial.maps_url ?? "",
          orden: initial.orden,
          publicado: initial.publicado,
          rp_local_id: initial.rp_local_id ?? null,
          lat: initial.lat != null ? Number(initial.lat) : null,
          lng: initial.lng != null ? Number(initial.lng) : null,
          cobertura_radio_km: initial.cobertura_radio_km != null ? Number(initial.cobertura_radio_km) : 5,
        }
      : emptyState,
  );
  const [slugTouched, setSlugTouched] = useState(editing);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!slugTouched) setForm((f) => ({ ...f, slug: slugifySede(f.nombre) }));
  }, [form.nombre, slugTouched]);

  const upsert = useMutation({
    mutationFn: async () => {
      const cleaned = {
        ...form,
        barrio: form.barrio?.trim() ? form.barrio.trim() : null,
        mall: form.mall?.trim() ? form.mall.trim() : null,
        whatsapp: form.whatsapp?.trim() ? form.whatsapp.replace(/\D/g, "") : null,
        maps_url: form.maps_url?.trim() ? form.maps_url.trim() : null,
        orden: Number(form.orden) || 0,
        rp_local_id:
          form.rp_local_id != null && String(form.rp_local_id).length > 0
            ? Number(form.rp_local_id)
            : null,
        lat: form.lat != null && String(form.lat).length > 0 ? Number(form.lat) : null,
        lng: form.lng != null && String(form.lng).length > 0 ? Number(form.lng) : null,
        cobertura_radio_km: Number(form.cobertura_radio_km) || 5,
      };
      const parsed = SedeSchema.safeParse(cleaned);
      if (!parsed.success) {
        const map: Record<string, string> = {};
        for (const issue of parsed.error.issues) map[issue.path.join(".")] = issue.message;
        setErrors(map);
        throw new Error("Revisa los campos marcados");
      }
      setErrors({});
      if (editing && initial) return updateSede(initial.id, parsed.data);
      return createSede(parsed.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sedes"] });
      toast.success(editing ? "Sede actualizada" : "Sede creada");
      navigate({ to: "/admin/sedes" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        upsert.mutate();
      }}
      className="space-y-5"
    >
      <BrutalCard tone="cheese" className="p-5 space-y-4">
        <div className={fieldCls}>
          <label className={labelCls}>Nombre de la sede</label>
          <BrutalInput
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="KINGPAPA Granada"
            required
          />
          {errors.nombre && <p className="text-xs text-kp-red">{errors.nombre}</p>}
        </div>

        <div className={fieldCls}>
          <label className={labelCls}>Slug (URL)</label>
          <BrutalInput
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setForm({ ...form, slug: e.target.value });
            }}
            placeholder="se-genera-automatico"
          />
          {errors.slug && <p className="text-xs text-kp-red">{errors.slug}</p>}
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div className={fieldCls}>
            <label className={labelCls}>Ciudad</label>
            <input
              list="ciudades-list"
              value={form.ciudad}
              onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
              className={inputBaseCls}
              required
            />
            <datalist id="ciudades-list">
              {CIUDADES_SUGERIDAS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Horario</label>
            <BrutalInput
              value={form.horario}
              onChange={(e) => setForm({ ...form, horario: e.target.value })}
              placeholder="12:00pm – 10:00pm"
            />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Orden (menor = primero)</label>
            <BrutalInput
              type="number"
              value={form.orden}
              onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className={fieldCls}>
          <label className={labelCls}>Dirección</label>
          <BrutalInput
            value={form.direccion}
            onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            placeholder="Cl. 5 #66-25"
            required
          />
          {errors.direccion && <p className="text-xs text-kp-red">{errors.direccion}</p>}
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className={fieldCls}>
            <label className={labelCls}>Barrio (opcional)</label>
            <BrutalInput
              value={form.barrio ?? ""}
              onChange={(e) => setForm({ ...form, barrio: e.target.value })}
            />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Centro comercial (opcional)</label>
            <BrutalInput
              value={form.mall ?? ""}
              onChange={(e) => setForm({ ...form, mall: e.target.value })}
            />
          </div>
        </div>
      </BrutalCard>

      <BrutalCard tone="cheese" className="p-5 space-y-3">
        <h3 className="font-display uppercase text-lg">Contacto y mapa</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <div className={fieldCls}>
            <label className={labelCls}>WhatsApp (solo dígitos, con país)</label>
            <BrutalInput
              value={form.whatsapp ?? ""}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              placeholder="573172455336"
            />
            {errors.whatsapp && <p className="text-xs text-kp-red">{errors.whatsapp}</p>}
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Google Maps URL</label>
            <BrutalInput
              value={form.maps_url ?? ""}
              onChange={(e) => setForm({ ...form, maps_url: e.target.value })}
              placeholder="https://maps.app.goo.gl/…"
            />
            {errors.maps_url && <p className="text-xs text-kp-red">{errors.maps_url}</p>}
          </div>
        </div>
      </BrutalCard>

      <BrutalCard tone="cheese" className="p-5 space-y-3">
        <h3 className="font-display uppercase text-lg">Restaurant.pe & ubicación</h3>
        <div className="grid md:grid-cols-4 gap-3">
          <div className={fieldCls}>
            <label className={labelCls}>local_id Restaurant.pe</label>
            <BrutalInput
              type="number"
              value={form.rp_local_id ?? ""}
              onChange={(e) =>
                setForm({ ...form, rp_local_id: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="1"
            />
            {errors.rp_local_id && <p className="text-xs text-kp-red">{errors.rp_local_id}</p>}
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Latitud</label>
            <BrutalInput
              type="number"
              step="any"
              value={form.lat ?? ""}
              onChange={(e) =>
                setForm({ ...form, lat: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="3.4516"
            />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Longitud</label>
            <BrutalInput
              type="number"
              step="any"
              value={form.lng ?? ""}
              onChange={(e) =>
                setForm({ ...form, lng: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="-76.5320"
            />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Cobertura (km)</label>
            <BrutalInput
              type="number"
              step="0.5"
              value={form.cobertura_radio_km}
              onChange={(e) =>
                setForm({ ...form, cobertura_radio_km: Number(e.target.value) })
              }
            />
          </div>
        </div>
        <p className="text-xs text-kp-ink/70">
          local_id es el ID numérico de la sede en Restaurant.pe. Necesario para sincronizar menú
          y crear pedidos. Lat/Lng se usan para sugerir sede por ubicación del usuario.
        </p>
      </BrutalCard>

      <BrutalCard tone="cheese" className="p-5 space-y-3">
        <h3 className="font-display uppercase text-lg">Servicios y estado</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {([
            ["abierta_ahora", "Abierta ahora"],
            ["delivery", "Delivery"],
            ["pickup", "Pick-up"],
            ["qr_mesa", "QR en mesa"],
            ["publicado", "Publicado"],
          ] as const).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-2 h-[50px] px-3 border-2 border-kp-ink bg-kp-cheese shadow-brutal-sm cursor-pointer"
            >
              <input
                type="checkbox"
                checked={form[key] as boolean}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked } as FormState)}
              />
              <span className="font-display uppercase text-[11px]">{label}</span>
            </label>
          ))}
        </div>
        <div>
          {form.publicado ? (
            <BrutalBadge tone="lime">publicada</BrutalBadge>
          ) : (
            <BrutalBadge tone="black">oculta</BrutalBadge>
          )}
        </div>
      </BrutalCard>

      <div className="flex items-center gap-3">
        <BrutalButton type="submit" variant="primary" disabled={upsert.isPending}>
          {upsert.isPending ? "Guardando…" : editing ? "Guardar cambios" : "Crear sede"}
        </BrutalButton>
        <BrutalButton type="button" variant="ghost" onClick={() => navigate({ to: "/admin/sedes" })}>
          Cancelar
        </BrutalButton>
      </div>
    </form>
  );
}
