# Plan: Aterrizar /franquicias con información veraz de KINGPAPA

**Sin cambios de diseño.** Mantengo exactamente la estructura, los componentes (`BrutalCard`, `BrutalBadge`, `SectionHeading`, `LeadFormFranquicia`), el sistema de tonos y los colores. Solo reemplazo copys, cifras y el formulario para que reflejen la realidad del brochure y los pilares BIC.

---

## 1. Hero (mismo layout, copy nuevo)

- Eyebrow: "Franquicias KINGPAPA"
- H1: **"Expandamos el Reino juntos"** (se mantiene)
- Subtítulo nuevo, anclado al brochure: nacida en un garaje del Limonar en 2021, hoy 15 sedes (10 Cali, 1 Jamundí, 4 Bogotá), meta 50 sedes a 2030.
- CTA: "Quiero ser pionero del Reino" → `#aplicar`

## 2. Nueva sección "Tracción del Reino" (insertada justo después del hero)

Misma estética de grid de 4 `BrutalCard` que ya existe, con cifras reales:

- **Tickets**: 49.008 (2021) → 197.224 (2022) → 228.191 (2023) → +280k (2025) → meta 350k (2026). Crecimiento +391% y +32,6%.
- **Sedes**: 15 puntos en <5 años (Cali, Jamundí, Bogotá).
- **Comunidad digital**: +3M de personas. TikTok 1.8M (restaurante #1 Colombia), IG 675k, YouTube 53k, Facebook activo.
- **Origen**: del garaje del Limonar (2021) a plataforma de marca BIC.

## 3. "Por qué KINGPAPA funciona" (reescrita con pilares del brochure)

Las 4 tarjetas existentes se reescriben con los pilares oficiales:

- **Marca con comunidad real**: la comunidad digital más grande de un restaurante en Colombia. Activo que reduce CAC y blinda contra competencia.
- **Experiencia y calidad**: estándares de cantidad, gramajes generosos, atención cercana, "experiencias de la realeza".
- **Operación estandarizada**: manual de procesos, fichas técnicas, centro de abastecimiento, know-how transferido.
- **Acompañamiento integral**: selección de local, entrenamiento, campaña de lanzamiento, innovación continua, marketing.

## 4. Nueva sección "Inversión y condiciones" (nueva, con mismo lenguaje brutalista)

Grid de tarjetas cortas (igual al patrón de mapa de expansión):

- Canon de entrada: **$50M COP + IVA**
- Inversión inicial aprox: **$200M COP** (incluye derecho de marca)
- Inventario inicial: **$10M aprox**
- Regalías: **2,5%** (pioneros) — normal 3%
- Publicidad: **2,5%** (pioneros) — normal 3%
- Duración contrato: **6 años** (pioneros) — normal 5
- Retorno promedio: **26 meses**

Badge destacado: "Beneficios solo para pioneros" para activar urgencia.

## 5. "Mapa de expansión" (actualizado a realidad)

Mismo grid, ciudades actualizadas:

- Cali — 10 sedes activas (lime)
- Jamundí — 1 sede activa (lime)
- Bogotá — 4 sedes activas (lime)
- Resto del país — Buscando socios pioneros (red)
- Meta 2030 — 50 puntos de venta (purple)

## 6. "Proceso de aplicación" (nueva sección, 5 pasos)

Tarjetas numeradas: 1) Formulario de postulación · 2) Aplicación formal · 3) Informe de verificación · 4) Entrevistas finales · 5) Formalización del contrato.

## 7. Form de aplicación

Se mantiene `LeadFormFranquicia` (no cambia diseño). Solo ajustes mínimos al copy del header y agregar línea de contacto directo: `kingpapacali@gmail.com` y WhatsApp `+57 317 2455336`.

## 8. "Impacto del Reino" (BIC) — reescrita

Las 3 tarjetas púrpuras ya existen. Se reescriben fieles al PDF:

- **Stakeholders del Reino**: clientes, colaboradores, proveedores, comunidad e inversionistas — "un Reino donde todos ganemos" (SAS BIC).
- **Talento que sostiene la corona**: foco en colaboradores como motor del Reino, plan carrera, círculo virtuoso colaborador→cliente→marca.
- **Comunidad y causas**: +200 fundaciones apoyadas desde el inicio, visibilidad a causas locales, comunidad digital al servicio del impacto.

## 9. Nueva sección "Tesis para el inversor" (cierre antes del footer)

Bloque de 3 puntos en estilo manifiesto (mismo `BrutalCard` cheese/ink):

- Marca con tracción brutal (15 sedes en <5 años desde un garaje).
- Demanda probada (ratings altos, ticket medio-alto, gramajes generosos).
- Propósito BIC con roadmap claro a 50 puntos al 2030.

---

## Archivos a modificar (solo 2)

- `src/routes/franquicias.tsx` — reemplazar copys de todas las secciones, agregar las secciones nuevas (Tracción, Inversión, Proceso, Tesis) usando los mismos componentes ya importados.
- `src/components/kp/LeadFormFranquicia.tsx` — ajustes menores de copy + agregar pie con email y WhatsApp oficiales. Sin cambios de layout.

## Lo que NO voy a hacer

- No cambio paleta, tipografías, componentes UI ni espaciados.
- No agrego librerías nuevas.
- No toco el head/SEO más allá de afinar `description` con el dato de "15 sedes, BIC, meta 50 a 2030".
- No agrego contador en tiempo real de redes (lo mencionas como "sería una chimba", pero requiere integraciones; lo dejo para una siguiente iteración si lo confirmas).

¿Apruebas para implementar?  
Si, agrega secciones que mejoren la /franquicias que la vuelvan más atractiva, más enganche, que inviten aa ser parte del REINO, que vendan y convenzan