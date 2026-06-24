## Objetivo

Reemplazar el logo actual (corona PNG generada por IA + texto "KINGPAPA" en font display) por el wordmark oficial de la marca que adjuntaste. Quitar la coronita en todos los lugares donde aparece.

## Cambios

### 1. Subir el wordmark como asset CDN (3 variantes de color)

A partir de `user-uploads://Kingpapa-logo-negro.png`:

- `src/assets/kingpapa-wordmark-black.png.asset.json` — versión original negra (para fondo amarillo o blanco).
- `src/assets/kingpapa-wordmark-yellow.png.asset.json` — recoloreado a amarillo `#FFD400` (token `--kp-yellow`), fondo transparente. Para fondo negro/oscuro.
- `src/assets/kingpapa-wordmark-white.png.asset.json` — recoloreado a blanco puro, fondo transparente. Reserva por si hace falta sobre fondos de imagen muy saturados.

El recoloreado se hace localmente con PIL (mantiene la silueta exacta, solo cambia píxeles no-transparentes). No se regenera con IA — es el logo real.

### 2. Header (`src/components/kp/Layout.tsx` — TopAppBar)

- Quitar `import crown from "@/assets/crown.png"`.
- Quitar `<img src={crown} … />` y el `<span>KINGPAPA</span>` adyacente.
- Reemplazar por un solo `<img>` con el wordmark **negro** (header tiene `bg-kp-yellow`), con `alt="KINGPAPA"`, altura fija (~`h-8 md:h-10`) y `w-auto` para que escale por aspect-ratio.

### 3. Footer (`src/components/kp/Layout.tsx` — Footer)

- Mismo tratamiento: quitar el `<img>` de corona y el `<span>KINGPAPA</span>`.
- Reemplazar por el wordmark **amarillo** (footer tiene `bg-kp-ink` negro), altura `h-10 md:h-12`.

### 4. Limpieza

- Eliminar `src/assets/crown.png` (ya no se usa en ningún otro archivo — verificado con grep).
- No tocar favicon ni og:image en `__root.tsx` (no son la coronita, son otros assets) salvo que lo pidas explícitamente.

## Lo que NO cambia

- Tipografía display (`font-display`) sigue para titulares de UI; solo el wordmark de marca se sustituye por imagen.
- Colores de fondo de header/footer.
- Estructura de navegación, UserMenu, LocationPill.
- Favicon, OG images, metadatos.

Confirma y lo implemento.
