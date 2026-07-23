## Objetivo

Reemplazar el par "corona + texto KINGPAPA" por el logo oficial adjunto (wordmark negro) en toda la web.

## Dónde aparece hoy

Solo en `src/components/kp/Layout.tsx`:

- **Header (`TopAppBar`)** sobre fondo amarillo → línea 50-53 (corona 36px + `<span>KINGPAPA</span>`).
- **Footer** sobre fondo negro (`bg-kp-ink`) → línea 117-120 (corona 40px + `<span>KINGPAPA</span>` amarillo).

No hay favicon custom ni referencias al logo en otros archivos.

## Pasos

1. **Subir el logo como asset CDN** (versión negra, la oficial):
  - `lovable-assets create --file /mnt/user-uploads/Kingpapa-logo-negro-2.png --filename kingpapa-logo.png > src/assets/kingpapa-logo.png.asset.json`
2. **Generar variante amarilla para el footer** (fondo negro requiere contraste):
  - Opción elegida: usar `imagegen--edit_image` sobre el logo original para producir versión amarilla (`#F5D400` aprox. `kp-yellow`) con fondo transparente → `src/assets/kingpapa-logo-yellow.png`, luego subir como asset CDN.
  - Alternativa más barata (si prefieres): mantener el logo negro y aplicar `filter: invert(...) sepia(...) saturate(...)` vía Tailwind para teñirlo de amarillo. Menos limpio visualmente; recomiendo la variante generada.
3. **Actualizar `src/components/kp/Layout.tsx**`:
  - Header: eliminar la corona + `<span>KINGPAPA</span>`; renderizar solo `<img src={logoNegro.url} alt="KINGPAPA" className="h-8 md:h-10 w-auto" />` dentro del `<Link to="/">`.
  - Footer: reemplazar corona + span por `<img src={logoAmarillo.url} alt="KINGPAPA" className="h-10 w-auto" />`.
  - Eliminar el import `crown from "@/assets/crown.png"`.
4. **Limpieza**: borrar `src/assets/crown.png` si ya no se importa en ningún otro archivo (verificado: solo lo usaba Layout).

## Qué NO cambia

- Favicon (no se pidió; sigue igual salvo que lo quieras también, avísame).
- OG image / metadata social.
- Ningún otro componente, ruta ni lógica.

## Preguntas rápidas (opcionales)

- ¿Genero la versión amarilla del logo para el footer (recomendado) o prefieres que use un filtro CSS sobre el mismo archivo negro? Usa una versión blanca del logo para el fondo negro del footer.
- ¿Quieres que también reemplace el favicon con este logo? no cambiar, dejar el actual. 