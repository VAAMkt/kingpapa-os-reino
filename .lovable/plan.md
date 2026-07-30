## Problema

Los avisos tipo "Salchitender para 2 al carrito" salen abajo al centro y tapan los botones de la hoja de upsell y la píldora del carrito justo cuando el usuario los va a tocar.

## Cambio

Un solo archivo: `src/components/ui/sonner.tsx`.

- Posicionar el contenedor de avisos arriba y centrado (`position="top-center"`).
- Separarlo del borde superior lo suficiente para que quede por debajo de la barra de la app, usando la variable ya existente `--kp-appbar-h` (offset tipo `calc(var(--kp-appbar-h, 64px) + 8px)`), tanto en móvil como en desktop.
- Mantener el estilo actual del aviso; sólo cambia la ubicación.

## Detalle técnico

`<Toaster />` se monta una única vez en `src/routes/__root.tsx`, así que el cambio aplica a toda la app (menú, personalizador, upsell, checkout y admin). No se toca ninguna llamada a `toast.success(...)` ni lógica de negocio.

## Verificación

Captura en móvil (393px) agregando un producto: el aviso debe aparecer arriba, sin tapar los botones "Seguir en el menú" / "Ir al checkout" ni la píldora del carrito.
