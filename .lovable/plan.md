## Diagnóstico exacto

El usuario `ing.miguelarroyo@gmail.com` sí existe y sí tiene los roles `super_admin` y `cliente` en la base de datos.

La falla real no es que falte el rol: el navegador recibe `403` al consultar `user_roles` porque la función de base de datos `public.has_role` no tiene permiso de ejecución para usuarios autenticados.

Error real capturado en la petición del navegador:

```text
GET /rest/v1/user_roles?select=role&user_id=eq.f3337438-60bb-47fe-8ad1-9d0cd95c2d1a
Status: 403
message: permission denied for function has_role
```

Eso hace que `useAuth` reciba error, deje `roles: []`, y el guard de `/admin` concluya incorrectamente que el usuario no es admin.

## Plan de solución

1. Crear una migración para corregir permisos de la función `public.has_role`:
   - Permitir que `authenticated` pueda ejecutar `public.has_role(uuid, app_role)`.
   - Permitir también `anon` para evitar fallos de evaluación en políticas compartidas, sin exponer datos porque la función solo devuelve booleano y las políticas siguen controlando acceso.
   - Mantener `SECURITY DEFINER` y `search_path = public`.

2. Reforzar `useAuth` para no convertir un error de carga de roles en “sin roles” silenciosamente:
   - Agregar un estado `roleError`.
   - Si la consulta de roles falla, conservar `loading: false` pero registrar/propagar el error para poder distinguir “no tiene rol” de “no pude verificar rol”.

3. Ajustar el guard de `/admin`:
   - Mientras carga, mostrar “Verificando corona…”.
   - Si falla la verificación de roles, no mandar a `/no-autorizado`; mostrar un mensaje de error de verificación con opción de reintentar.
   - Solo redirigir a `/no-autorizado` cuando la consulta de roles haya terminado correctamente y el usuario realmente no tenga rol admin.

4. Validación:
   - Confirmar en base de datos que `has_role('f3337438-60bb-47fe-8ad1-9d0cd95c2d1a', 'super_admin')` devuelve `true`.
   - Confirmar que la petición real a `user_roles` ya no responde `403`.
   - Confirmar que `/admin` y `/admin/usuarios` cargan con `ing.miguelarroyo@gmail.com`.