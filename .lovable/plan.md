## Diagnóstico

### 1. Cobertura del mapa (La Flora con 6 km no cubría 2–3 km)
La función `pickNearestSede` en `src/lib/active-sede.ts` elige la sede **geográficamente más cercana** y solo contra ESA valida el radio. Además no filtra por `delivery`, `rp_acepta_delivery`, `kill_switch` ni `abierta_ahora`.

Consecuencia real: si el usuario está a 2 km de una sede mall (radio 0.5 km, sin delivery) y a 3 km de La Flora (radio 6 km, con delivery), el algoritmo elige la sede mall y marca "fuera de cobertura", ignorando La Flora.

### 2. Pedidos no salen (aunque el admin marque delivery/horario)
El servidor (`src/lib/orders.server.ts` → `assertSedeOperativa`) valida contra `rp_acepta_delivery` (columna sincronizada desde Restaurant.pe), NO contra `sede.delivery` (el toggle del admin). Verificado en la data actual: **La Flora, Valle de Lili, La Floresta (todas las delivery activas del admin) tienen `rp_acepta_delivery=0`** en la DB, así que el chequeo dispara: `"no acepta domicilios por ahora"` y el pedido nunca llega al POS. Solo Limonar, C.C. Único y La Floresta tienen `rp_acepta_delivery=1`.

O sea: el toggle "Delivery" del admin es cosmético hoy — no cambia el gate real. Además el error que ve el usuario probablemente lo interpreta como "no dejaba" sin ver la causa clara.

### 3. Panel admin se reinicia al cambiar de pestaña
En `src/routes/__root.tsx` línea 110, `supabase.auth.onAuthStateChange` invalida router + todas las queries en cada evento. Supabase dispara `TOKEN_REFRESHED` al recuperar foco (refresco periódico del token cada ~50 min), lo que fuerza re-ejecutar loaders y refetch masivo → estado local se pierde y el admin salta al inicio.

---

## Cambios propuestos

### Cambio 1 — Cobertura inteligente (frontend)
Archivo: `src/lib/active-sede.ts`

Reescribir `pickNearestSede` para:
1. Filtrar sedes elegibles para delivery: `publicado && delivery && !kill_switch && rp_acepta_delivery !== 0` (null = aún no sincronizado, se permite).
2. Entre esas, buscar la **sede más cercana cuya distancia ≤ radio** (candidata real de delivery).
3. Si ninguna cubre, devolver la geográficamente más cercana con `enCobertura=false` (para pickup).

Esto respeta la configuración del admin (radio + toggle) y evita que una sede mall bloquee a una sede con delivery.

`recomputeCoverage` no cambia — reutiliza la nueva `pickNearestSede`.

### Cambio 2 — Toggle de delivery del admin autoritativo (backend)
Archivo: `src/lib/orders.server.ts` (`assertSedeOperativa` + query de sede)

- Incluir `delivery` y `abierta_ahora` en el SELECT.
- Regla nueva para `tipo === "delivery"`:
  - Si `sede.delivery === false` → bloquear con mensaje claro: `"«{sede}» no ofrece domicilio."` (control del admin manda).
  - Si `sede.delivery === true` y `rp_acepta_delivery === 0` → bloquear con: `"«{sede}» tiene domicilio pausado en el POS. Sincroniza sedes o revisa Restaurant.pe."` (mensaje distinguible para operación).
  - Si `sede.delivery === true` y `rp_acepta_delivery` es null o 1 → dejar pasar.
- Mantener `kill_switch`, `rp_local_estado`, horarios, bypass staff.

También registrar en `rp_sync_log` (tipo `order_blocked_by_gate`) los rechazos por delivery/horario, para depuración desde `/admin/integraciones`.

Nota: NO se cambia la lógica de sincronización POS; se acepta que `rp_acepta_delivery` puede estar desactualizado y por eso el toggle del admin es el que manda cuando difieren.

### Cambio 3 — Evitar reset del admin al cambiar de pestaña
Archivo: `src/routes/__root.tsx`

Filtrar el listener de auth para invalidar SOLO en eventos que realmente cambian identidad:
```
if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
  router.invalidate();
  queryClient.invalidateQueries();
}
```
Ignorar `TOKEN_REFRESHED`, `INITIAL_SESSION`, `PASSWORD_RECOVERY`. Esto elimina el refetch masivo al recuperar foco y el admin conserva su estado.

---

## Fuera de alcance (para hablar después si aparece)
- Cambiar cómo Restaurant.pe reporta `rp_acepta_delivery` (requiere entender su flujo POS/Quipu).
- Editor visual del radio de cobertura sobre el mapa en `/admin/sedes/*` (hoy es solo input numérico).
- Guardar preferencia de scroll/tab dentro del admin al navegar entre pestañas del navegador.
