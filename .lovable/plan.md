## Diagnóstico

El usuario `ing.miguelarroyo@gmail.com` sí existe y ya tiene los roles `cliente` y `super_admin` en la base de datos. El problema está en el frontend: el layout de `/admin` redirige a `/no-autorizado` antes de terminar de cargar los roles, porque el estado `loading` puede quedar en `false` mientras `roles` todavía está vacío.

## Plan de corrección

1. **Ajustar `useAuth`**
   - Separar la carga de sesión de la carga de roles.
   - Mantener `loading: true` mientras exista sesión pero los roles aún no hayan terminado de consultarse.
   - Manejar errores al consultar roles para no dejar el hook en estados inconsistentes.
   - Limpiar roles correctamente al cerrar sesión.

2. **Endurecer el guard de `/admin`**
   - Evitar que redirija a `/no-autorizado` hasta que la verificación de roles haya terminado.
   - Mantener la pantalla “Verificando corona…” durante la comprobación.

3. **Verificación**
   - Confirmar que `ing.miguelarroyo@gmail.com` conserva `super_admin`.
   - Revisar que `/admin` y `/admin/usuarios` ya no redirijan incorrectamente cuando el usuario está autenticado.