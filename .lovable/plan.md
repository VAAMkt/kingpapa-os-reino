# Voz KINGPAPA en toda la web — Verbatim 360

## Diagnóstico (de la guía)

La guía define claramente:

- **Personaje**: The King, parcero 25 años, caleño, irreverente pero respetuoso, cero corporativo.
- **Léxico oficial**: "papi", "parcero", "mani", "mi so", "cucho", "mi fi", "socito", "mi reina", **"la banda"** (no "súbditos"), "pillate", "hablalooo", "llegateee", "siza", "brutal", "chimba", "de otro nivel", "cero drama", "pa' toda la banda". Emojis firma: 👑🔥💪🏻🏰😎🧀🍟.
- **Propuesta de valor**: mejor relación **Cantidad + Calidad / Precio**. La comunicación gira alrededor del producto y las experiencias positivas.
- **Principios del verbo**: nunca pelear, agradecer siempre (incluso la queja), humor > confrontación, humano > empresa.
- **Contenidos que existen en la guía y no están reflejados en la web**: fuera de horario, opción vegetariana, reto Kingpapa (4.1 kg / 30 min / $139.9k), combo cumpleaños ($55k con show), plantillas de reseñas, trabaja con nosotros, proveedores, factura electrónica.

La web hoy sobre-usa "súbditos / Reyes / Reino" y suena a marca. Debe sonar a **The King hablando**.

## Cambios (solo copy / UI presentacional, sin tocar lógica)

### 1) Léxico global — "la banda" primero

- Sustituciones controladas de "súbdito(s)" → "la banda" / "parcero" / según contexto en:
  - `src/components/kp/Layout.tsx` (footer copy)
  - `src/routes/index.tsx` (hero, meta description, CTA "Hacerme súbdito" → "Meterme a la banda")
  - `src/components/kp/Testimonios.tsx` (título "Voces del Reino" → "La banda habla")
  - `src/routes/franquicias.tsx` ("pionero del Reino" se mantiene por ser producto B2B; se suaviza "vendemos pertenecer al Reino" con vocabulario de la guía).
- Se mantiene "El Reino" como concepto de marca (menú, mapa, sedes) pero se reduce su frecuencia y se combina con "la banda" y "el parche".

### 2) Home (`src/routes/index.tsx`)

- Hero eyebrow y sub-título con voz King: p.ej. "Los REYES de esta pendeja'. Pedí directo, sin comisiones ni cuento." + CTA "¡Hablalooo, quiero pedir!".
- Sección testimonios/cultura: reemplazar copy genérico por frases verbatim ("brutal nivel de queso", "cero drama").
- Meta OG description: "Salchipapas monstruosas, bowls coronados y retos pa' toda la banda."

### 3) Menú (`src/routes/menu.tsx`)

- Título/subtítulo: "El Menú del Reino — pa' toda la banda" / "Escoge tu corona: personal, X2, Legendaria o Kingpapa pa' toda la banda (hasta 7)."
- Chip "sin cobertura" y estados vacíos: microcopy verbatim ("Pillate, hoy no llegamos a tu zona, pero en Rappi/DiDi seguro sí").
- Nota vegetariana inline: "¿Vegetariano? Siza, pedila sin proteína animal y métele queso, maíz, crispy o aguacate."

### 4) Checkout (`src/routes/checkout.tsx`)

- Micro-copy de confianza: "Pedido directo al Reino · Sin comisiones · Precio web" ya existe → añadir "Cero drama, cero apps intermediarias."
- Estado "sin cobertura" en checkout: mismo mensaje verbatim de cobertura.
- Botón final CTA: "¡Hablalooo, coróname el pedido!" (mantener submit lógico).

### 5) Tracking / Gracias (`src/routes/gracias.tsx`, `src/components/kp/TrackerOperativo.tsx`)

- Labels de pasos con voz King: "Recibimos tu pedido 👑", "Cocinando pa' vos 🧀", "El motorizado va en camino 🛵", "¡A disfrutarlo, mi rey! 🔥".
- Estado "fuera de horario": mensaje verbatim exacto de la guía.
- Estado de espera: "Tranqui parcero, ya la banda está en la vuelta."

### 6) Sedes (`src/routes/sedes.tsx`)

- Header: "Encuentra tu Reino más cercano — la banda te espera."
- Estado "sin cobertura" verbatim de la guía.
- Ficha sede: horarios exactos de la guía (ya vienen de DB — no se toca lógica, solo textos auxiliares).

### 7) FAQ nueva ligera integrada en `/sedes` o al pie del home

Bloque colapsable con las preguntas de la guía (verbatim, sin inventar):

- ¿Manejan reservas? · ¿Hacen domicilios? · ¿Recoger en punto? · ¿Opciones vegetarianas? · ¿Salsas? · ¿Reto Kingpapa? · ¿Combo cumpleaños? · Trabajo/HV · Proveedores · Factura electrónica.

Se implementa como componente `src/components/kp/FaqKing.tsx` con datos hardcodeados (texto plano de la guía) y se monta al final de `sedes.tsx` y `index.tsx`.

### 8) Footer (`src/components/kp/Layout.tsx`)

- Reemplazar párrafo por voz King:
  > "Los REYES de esta pendeja'. Salchipapas monstruosas, bowls coronados y retos pa' toda la banda. Cero dieta, cero drama."
- Slogan cierre: mantener "Si estás a dieta, NO nos sigas."
- Añadir columna "Trabaja con la banda" con los contactos verbatim (HV: 315 0272030 · Proveedores: 316 4317572 · Factura: [contabilidadmvk@gmail.com](mailto:contabilidadmvk@gmail.com)).

### 9) Manejo de crítica / errores públicos

- Toasts de error en checkout y tracking: cambiar mensajes genéricos por voz King:
  - "Se nos enredó la vuelta, dale otra vez 🙏"
  - "Uy parce, algo no cargó bien. Refrescá y seguimos."

## Alcance técnico

- **Solo cambios de copy y un componente presentacional nuevo** (`FaqKing.tsx`).
- No se toca: RLS, server functions, integraciones RP, cart, auth, routing, DB.
- SEO: se actualizan `head()` de `index.tsx`, `menu.tsx`, `sedes.tsx`, `franquicias.tsx` con descripciones alineadas a la voz sin cambiar títulos que ya rankean.
- Verificación: `tsgo` + revisión visual del preview en home, menú, checkout y sedes.

## Archivos a editar

- `src/components/kp/Layout.tsx`
- `src/components/kp/Testimonios.tsx`
- `src/components/kp/TrackerOperativo.tsx`
- `src/routes/index.tsx`
- `src/routes/menu.tsx`
- `src/routes/checkout.tsx`
- `src/routes/gracias.tsx`
- `src/routes/sedes.tsx`
- `src/routes/franquicias.tsx` (ajustes leves)

## Archivos a crear

- `src/components/kp/FaqKing.tsx` (FAQ verbatim colapsable, montado en home y sedes).

¿Le doy con toda o querés que priorice primero **Home + Menú + Checkout/Tracking** y dejemos FAQ + Franquicias para un segundo pase? a todas