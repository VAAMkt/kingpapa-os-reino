# CMS amigable: 3 arreglos para redactores sin conocimiento técnico

## 1. Por qué falla la subida de imágenes (causa raíz encontrada)

Las políticas RLS del bucket `blog-images` siguen llamando a `public.has_role(...)`, pero en la migración anterior movimos esa función a `app_private.has_role` y revocamos el acceso público. Resultado: aunque el usuario es `super_admin`/`editor`, Postgres no puede ejecutar la función desde el contexto del storage → "new row violates row-level security policy".

**Fix:** migración que reemplaza las 3 políticas de `storage.objects` para el bucket `blog-images` (INSERT/UPDATE/DELETE) y las apunta a `app_private.has_role`.

## 2. Editor de texto enriquecido (adiós al HTML crudo)

Reemplazar el `<textarea>` de "Contenido HTML" en `PostForm.tsx` por un editor visual basado en **TipTap** (estándar moderno, ligero, output HTML limpio).

Barra de herramientas simple pensada para redactores:

- **B** Negrita · *I* Cursiva · S̶ Tachado
- H2 / H3 (sin H1 — ese es el título)
- Lista con viñetas · Lista numerada · Cita
- Enlace (con prompt para URL, target _blank automático)
- Insertar imagen (sube al mismo bucket y la inserta en línea)
- Limpiar formato · Deshacer / Rehacer

Dependencias a instalar: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-image`, `@tiptap/extension-placeholder`.

El HTML generado se guarda en `contenido_html` exactamente como hoy, así que el frontend público (`historias.$slug.tsx`) no necesita cambios. Se conservará un botón discreto "Ver HTML" plegable para los que sí saben código.

**Bonus de migración:** los posts antiguos traen HTML de Divi/WordPress con basura (`[et_pb_section …]`, `data-path-to-node="3"`, `&#8243;`). Añadir un sanitizador al cargar el post en el editor (`sanitizeLegacyHtml`) que:

- Elimina shortcodes `[et_pb_*]` y `[/et_pb_*]`
- Elimina atributos `data-path-to-node`, `data-index-in-node`
- Decodifica entidades HTML básicas
- Quita estilos inline y clases de WordPress

## 3. Extracto automático con asistencia de IA

Cambios en el formulario de extracto:

- **Botón "✨ Generar con IA"** — usa Lovable AI Gateway (`google/gemini-2.5-flash`) con prompt en español: "Genera una meta description SEO de 140–155 caracteres para este artículo, tono cercano y vendedor, sin comillas". Implementado como `createServerFn` `generateExcerpt` que recibe título + texto plano del contenido.
- **Botón "Auto desde el texto"** — fallback sin IA: toma las primeras ~155 caracteres de texto plano del editor, corta en la última palabra completa y añade "…".
- **Generación silenciosa al guardar** si el campo está vacío: ejecuta el fallback automáticamente antes de enviar a la base de datos. El redactor nunca queda sin extracto.

Además: contador en vivo ya existe (rojo si <120 o >158, verde si está en rango). Se mantiene.

## 4. Mini-mejoras SEO sin coste extra

Mientras tocamos `PostForm.tsx`:

- **Botón "✨ Sugerir título SEO"** con IA: variante de hasta 60 caracteres con palabra clave al inicio.
- **Tiempo de lectura calculado** automáticamente del contenido (palabras / 220) y mostrado debajo del título — se inyecta también en el JSON-LD del artículo en `historias.$slug.tsx`.
- **Slug**: si el usuario edita el título de un post ya publicado, mostrar warning "cambiar el slug rompe enlaces existentes y SEO" en lugar de re-generarlo automáticamente (ya está protegido por `slugTouched`, solo añadimos el warning visual).

## 5. Bug menor de hidratación

`UserMenu` / `TopAppBar` están provocando un mismatch SSR/cliente (visible en runtime-errors: el botón "Abrir menú" se renderiza distinto). Arreglo: envolver la parte que depende de `useAuth()` con un `useState(false)` + `useEffect(() => setMounted(true))` para que SSR siempre renderice el estado "no autenticado" y el cliente actualice tras hidratar. Esto también acelera el primer paint.

---

## Archivos a tocar

**Migración SQL (1):**

- Reemplazar 3 políticas de `storage.objects` para `blog-images` → usar `app_private.has_role`.

**Crear:**

- `src/components/admin/RichEditor.tsx` — wrapper TipTap con toolbar.
- `src/lib/sanitize-html.ts` — limpia HTML legacy de Divi/WordPress.
- `src/lib/ai.functions.ts` — `generateExcerpt`, `suggestSeoTitle` (Lovable AI Gateway, requiere `requireSupabaseAuth`).

**Editar:**

- `src/components/admin/PostForm.tsx` — usar `<RichEditor>`, botones IA, auto-extracto al guardar, tiempo de lectura.
- `src/routes/historias.$slug.tsx` — añadir `wordCount` / `timeRequired` al JSON-LD.
- `src/components/kp/Layout.tsx` (o `TopAppBar`) — fix hidratación del menú.

**Dependencias:** `bun add @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-image @tiptap/extension-placeholder`.

---

## Lo que NO cambia

- Esquema de la tabla `posts` (no añadimos columnas nuevas todavía; el extracto y el HTML enriquecido caben en lo existente).
- Frontend público de historias (sigue renderizando `contenido_html`).
- Sistema de roles y autenticación.

¿Apruebas para implementar? Si quieres también añadir columnas dedicadas de SEO (`meta_titulo`, `og_image`, `keywords[]`, `tiempo_lectura_min`), montalo en esta ronda. 