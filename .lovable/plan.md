
# Alineación kingpapa.co ↔ Manual de Identidad v2.0
Arquitectura de zonas sobre canvas amarillo, entregada en 4 PRs revertibles.

## 1. Arquitectura de zonas

- **Zona Amarilla — la fachada** (atrae y cuenta): `/`, `/franquicias`, `/historias` (índice), `/sedes`, 404, estados vacíos.
- **Zona Negra — el tablero** (muestra producto y cierra venta): `/menu`, carrito, `/checkout`, `/mi-reino/*`, `/tracking`, `/admin/*`, `/historias/[slug]`.
- La home combina ambas por bloques con cortes duros (hero amarillo → producto en negro → El Reino amarillo → footer negro).
- Regla de oro: donde haya foto de comida o decisión de plata, canvas negro; donde haya marca y relato, canvas amarillo.

## 2. Tokens (reescritura de `src/styles.css`)

Sin light/dark mode. **Superficies semánticas + atributo `data-zona`** en el layout de cada ruta.

```css
:root{
  --kp-negro:#211915; --kp-tinta:#0B0A09;
  --kp-amarillo:#EFD915; --kp-dorado:#FBCD17; --kp-banda:#FFDE58;
  --kp-blanco:#FFFFFF; --kp-humo:#A8A296;
  --kp-ok:#3E8E3E; --kp-warn:#D68A00; --kp-error:#D62828; --kp-info:#3D7EA6;
}
:root, [data-zona="amarilla"]{
  --canvas:var(--kp-amarillo); --placa:var(--kp-negro);
  --on-canvas:var(--kp-negro); --on-canvas-dim:#5C4A17;
  --on-placa:var(--kp-blanco); --linea:rgba(33,25,21,.24);
  --accion:var(--kp-negro); --on-accion:var(--kp-amarillo);
  --accion-hover:var(--kp-tinta); --foco:var(--kp-negro);
  --sombra-brutal:0 0 0 2px var(--kp-negro), 6px 6px 0 var(--kp-negro);
}
[data-zona="negra"]{
  --canvas:var(--kp-negro); --placa:#17130F;
  --on-canvas:var(--kp-blanco); --on-canvas-dim:var(--kp-humo);
  --on-placa:var(--kp-blanco); --linea:rgba(255,255,255,.12);
  --accion:var(--kp-amarillo); --on-accion:var(--kp-negro);
  --accion-hover:var(--kp-dorado); --foco:var(--kp-amarillo);
  --sombra-brutal:0 0 0 2px var(--kp-amarillo), 6px 6px 0 var(--kp-amarillo);
}
```

Mapeo a shadcn (en `@theme inline`):
- `--background→--canvas`, `--foreground→--on-canvas`
- `--card→--placa`, `--card-foreground→--on-placa`
- `--primary→--accion`, `--primary-foreground→--on-accion`
- `--border→--linea`, `--ring→--foco`, `--muted-foreground→--on-canvas-dim`
- `--destructive→--kp-error`

Elevación: **placa negra + borde 2px + sombra dura**. No inventar amarillos claros.

## 3. Correcciones al plan anterior

1. **Sin alias temporales.** Se borran `--kp-red/purple/lime/cheese` y se deja que TS/build marque los huérfanos. Si hace falta puente, `--DEPRECADO-*` en fucsia.
2. **No se elimina `.dark`**, se reemplaza por `data-zona` en el layout de cada ruta.
3. **Anton no sustituye Cocogoose.** Camino real: comprar licencia Zetafonts y autohospedar WOFF2 (resuelve el riesgo legal #01 del manual). Fallback temporal aceptable si urge salir: **Big Shoulders Display 800**, marcado como parche.
4. **No un solo PR.** Entrega en 4 (§6).

## 4. Regresiones que introduce el canvas amarillo (obligatorias)

| # | Punto | Solución |
|---|---|---|
| 1 | Autofill Chrome | `input:-webkit-autofill { -webkit-box-shadow:0 0 0 100px var(--placa) inset; -webkit-text-fill-color:var(--on-placa); }` |
| 2 | Foto de producto | Toda `<img>` de comida dentro de contenedor `bg-[var(--placa)] p-2`, nunca directo sobre canvas. |
| 3 | Logotipo por zona | Negro en zona amarilla, blanco en zona negra. Selección por `data-zona`, no una sola imagen. |
| 4 | Color de precio | Tomado del token `--on-canvas`, jamás hardcodeado. |
| 5 | `theme-color` y manifest | `#EFD915` en zona amarilla, `#211915` en zona negra. |
| 6 | OG / share images | Quedan sobre negro (amarillo a sangre parece error de carga en feeds). |
| 7 | `::selection` | Zona amarilla: fondo negro, texto amarillo. Zona negra: al revés. |
| 8 | Impresión | `@media print{ *{background:white!important;color:black!important} }` para comandas/facturas. |
| 9 | `prefers-reduced-motion` | Cortes entre zonas sin transición si el usuario lo pide. |
| 10 | Texto auxiliar | `--on-canvas-dim:#5C4A17` sobre amarillo pasa AA (4.9:1). Prohibido `--kp-humo` sobre amarillo. |

## 5. Copy — vocabulario

- Público: siempre **la banda**. "Súbdito" solo sobrevive como Nivel 1 en `LoyaltyModule`, admin y dashboards internos.
- Verbatim aprobado (no tocar): "Los REYES de esta pendeja'", "Si estás a dieta no nos sigas", "¡No le escribas a tu ex!".
- Ajustes finos:
  - "Corónate de vuelta." (sin "rey/reina")
  - "Soy de la banda" (WhatsApp)
  - "Entrar a la banda" ✓

## 6. Secuencia de entrega (4 PRs revertibles)

**PR 1 · Fundación** — sin cambio visual perceptible
- Reescribir `src/styles.css` con tokens + dos zonas + mapeo shadcn.
- Cargar Montserrat (300/400/600/700) y Cocogoose (si ya se compró; si no, Big Shoulders Display 800 como parche) vía `<link>` en `src/routes/__root.tsx`. Retirar Bebas.
- Aplicar `data-zona="negra"` globalmente para que el sitio quede visualmente idéntico a hoy.

**PR 2 · Limpieza de color**
- Borrar `--kp-red/purple/lime/cheese` y utilidades `bg/text/border-kp-*` derivadas.
- Acotar `tone` de `BrutalBadge`/`BrutalCard` a `"placa" | "canvas" | "amarillo" | "negro"`.
- Arreglar todo lo que TS/Vite marque. Todo sigue en zona negra.

**PR 3 · Zonificación** — aquí aparece el amarillo
- Aplicar `data-zona="amarilla"` en el layout de cada ruta de la fachada (§1). Home segmenta por bloque.
- Logotipo servido por zona (negro/blanco).
- Placas negras para toda foto de producto (ProductCard, hero de menú, drawer de personalización, carrito).
- Barrido de contraste en botones y badges; prohibir texto blanco sobre amarillo.
- Overrides globales de §4: autofill, `::selection`, `theme-color`, `@media print`.

**PR 4 · Copy y detalle**
- Reemplazo "súbdito → la banda" en copy público (index, Layout footer, LoyaltyModule intro, AuthForms, OrderRouter WhatsApp, meta descriptions, `productos.ts` descripciones).
- `font-variant-numeric: tabular-nums` en precios de menú, tarjeta, carrito y checkout (utilidad `.kp-price`).
- Área de seguridad 1X alrededor del logo en header/footer.

## 7. Definición de hecho

- [ ] Ningún componente contiene un HEX literal.
- [ ] Ningún texto blanco sobre amarillo en toda la app.
- [ ] Foco de teclado visible en ambas zonas, en todos los interactivos.
- [ ] Toda foto de producto sobre placa negra.
- [ ] Precios con `tabular-nums` en menú, tarjeta, carrito y checkout.
- [ ] "Súbdito" solo en niveles de fidelización y admin.
- [ ] Autofill legible en login, registro y checkout.
- [ ] Lighthouse Accessibility ≥ 95 en `/`, `/menu` y `/checkout`.
- [ ] Factura imprimible en blanco y negro.
- [ ] Logo correcto en ambas zonas, con área de seguridad de 1X.

## Fuera de alcance

Lógica de pedidos, RP webhook, tracker, RLS, admin funcional. Solo capa visual, tokens, copy y accesibilidad.
