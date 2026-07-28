## Objetivo

Que el formulario de `/franquicias` en KINGPAPA envíe la postulación directamente al backend del Ops Hub (Perfect Operations Hub), en el mismo flujo de 2 pasos que hoy vive en `https://kingpapaops.com/postula-tu-franquicia/`, para que los leads caigan en el CRM único que ya administras allá.

## Cómo funciona el flujo del Ops Hub (contexto)

El Ops Hub expone una edge function pública `franchise-lead-intake` (Supabase project `wjgfozxecslnujwhvmrm`), llamada con `apikey` = anon key (pública, seguro exponerla). El contrato:

- **Paso 1 — datos básicos** → `POST { step: 1, full_name, email, phone, city, country: "CO", source, utm_source?, utm_medium?, utm_campaign? }` → devuelve `{ lead_id }`. Crea un lead parcial en el CRM y dispara notificaciones internas.
- **Paso 2 — cualificación** → `POST { step: 2, lead_id, barrio?, ha_probado_producto, motivacion, participa_operacion: 'si'|'no'|'tal_vez', current_occupation?, has_food_industry_exp, declared_investment_cop, has_proof_of_funds }` → devuelve `{ score, is_high_priority }`. Crea el `franchise_application` real y dispara el correo con brochure/NDA cuando aplica.

Si el usuario abandona tras el paso 1, ya queda como lead parcial y el Ops Hub envía correo de "retoma tu postulación" con un link `?lead=<uuid>` que salta al paso 2.

## Solución propuesta

Reemplazar el `LeadFormFranquicia` actual (que solo guarda en `localStorage`) por un formulario nativo de 2 pasos en `/franquicias` que consume la edge function del Ops Hub. Mantenemos el look brutalist (amarillo/negro, `BrutalCard`, `BrutalInput`, `BrutalButton`) — el usuario NO sale a `kingpapaops.com`, todo pasa dentro de `kingpapa.co`.

### Cambios de archivos

1. `**src/lib/ops-hub.ts` (nuevo)** — cliente ligero para la edge function:
  - Constantes `OPS_SUPABASE_URL` y `OPS_SUPABASE_ANON_KEY` (hardcoded — son claves públicas y viven en el bundle del Ops Hub también).
  - `postFranchiseIntake(payload)` con `fetch` a `${OPS_SUPABASE_URL}/functions/v1/franchise-lead-intake` con headers `apikey` + `Content-Type`.
  - Tipos `Step1Payload`, `Step2Payload`, `IntakeStep1Response`, `IntakeStep2Response`.
2. `**src/components/kp/LeadFormFranquicia.tsx` (rework)** — mismo componente, misma ubicación en `/franquicias`, misma estética brutalist, pero:
  - Estado `step: 1 | 2`, `leadId`, `s1`, `s2`, `errors`, `submitting`, `serverError`, `success`.
  - Validación con `zod` (schemas equivalentes a los del Ops Hub).
  - Paso 1: `Nombre completo`, `Email`, `WhatsApp`, `Ciudad` + captura de `utm_*` desde `window.location.search`. Botón `Continuar →`.
  - Paso 2: `Barrio (opcional)`, `Rango de inversión` (mismo listado del Ops Hub: <$50M, $50–100M, $101–300M, $301–500M, >$500M), `¿Acreditación de fondos?` (Sí/No), `¿Experiencia en F&B?` (Sí/No), `¿A qué te dedicas?` (opcional), `¿Participarías en la operación?` (Sí/Tal vez/No), `¿Has probado el producto?` (Sí/No), `Motivación` (textarea, min 20 chars). Botón `Enviar postulación` + `← Atrás`.
  - Stepper visual "1 · Datos básicos → 2 · Cualificación" con los pills brutalist (amarillo activo, gris inactivo).
  - Manejo de `?lead=<uuid>` en la URL: si viene, saltar directo al paso 2 (idéntico al Ops Hub; para el correo de recuperación funcione tanto si el link apunta a `kingpapaops.com` como a `kingpapa.co/franquicias?lead=...`). El pre-fill de nombre/email lo hace el Ops Hub usando `get_partial_lead`; en KP no exponemos ese RPC — mostramos solo el mensaje "Retomando tu postulación, solo falta un paso" con el paso 2 activo. (Opción: dejar el link del correo apuntando al Ops Hub como hoy y no manejar `?lead=` acá.)
  - Estado `success`: pantalla brutalist con `SuccessTimeline` propio (badge "¡Recibimos tu postulación!", 5 pasos: Revisión inicial 24–48h, Información detallada, NDA digital, Cita 1:1, Decisión y onboarding). Si `is_high_priority` → badge rojo "Perfil prioritario" y copys "HOY / ~1 semana".
  - Ya no se escribe nada en `localStorage`.
3. `**src/types/kp.ts**` — quitar `LeadFranquicia` (o marcarlo deprecated) porque ya no representa el payload real.
4. `**src/routes/franquicias.tsx**` — sin cambios de contenido; sigue montando `<LeadFormFranquicia />` en la sección `#aplicar`.

### Analytics

Añadir eventos en `src/lib/analytics.ts`:

- `franquicia_form_view` (mount del form).
- `franquicia_step1_submit` (éxito paso 1, con `lead_id`).
- `franquicia_step2_submit` (éxito paso 2, con `score`, `high_priority`).
- `franquicia_form_error` (con `step` y `message`).

### Seguridad y validaciones

- Anon key del Ops Hub embebida en cliente = OK (es publishable, ya está expuesta en su propio bundle).
- Validación con `zod` en cliente antes del POST + la edge function revalida server-side con los mismos schemas.
- `trim` + `maxLength` en todos los inputs (nombre 120, email 255, phone 40, city 120, barrio 120, motivación 2000).
- Sin `dangerouslySetInnerHTML`, sin logging de datos del formulario a consola.

### Fuera de alcance (para no meter cambios no pedidos)

- No tocamos routing del Ops Hub ni su edge function.
- No creamos tablas nuevas en el Supabase de KP.
- No migramos leads viejos guardados en `localStorage` (no había forma real de recuperarlos).
- No cambiamos el diseño visual del resto de `/franquicias`.

## Decisión abierta

¿Cómo quieres manejar el link de "retoma tu postulación" que el Ops Hub manda por correo?

- **A)** Dejarlo apuntando a `kingpapaops.com/postula-tu-franquicia?lead=...` (más simple, no requiere exponer `get_partial_lead` en KP). R/ SI

Si no indicas, voy con **A** por defecto (cero cambios en el Ops Hub, cero exposición de RPCs nuevos).

**Además tener en cuenta:**

1. Variables de entorno.
2. Turnstile y rate limiting.
3. Paso 2 idempotente.
4. Consentimiento de privacidad.
5. Booleanos sin selección predeterminada.
6. No exponer score ni prioridad.
7. Mantener por ahora la recuperación en Ops Hub.
8. Identificar el origen como `kingpapa.co/franquicias`, no simplemente `web`.

Con esos cambios, la integración sería suficientemente sólida para convertirse en el canal público principal de captación de franquiciados.