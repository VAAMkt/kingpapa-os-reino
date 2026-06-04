#!/usr/bin/env bash
# Verificación pre-publish para Google Maps en kingpapa.co
#
# Qué verifica (server-side, sin navegador):
#   1. La conexión personalizada está activa y la clave llega al runtime.
#   2. La clave de servidor responde Geocoding (vía gateway de Lovable).
#   3. La clave de navegador puede cargar el Maps JS API.
#   4. La Places API (New) está habilitada en el proyecto de Google Cloud.
#
# Qué NO se puede verificar desde aquí:
#   - La restricción de HTTP referrers solo la valida Google cuando un
#     navegador real carga el script desde kingpapa.co. Para esto:
#     después de publicar, abre https://kingpapa.co/menu y revisa la
#     consola. Si ves "RefererNotAllowedMapError" → agrega kingpapa.co/*
#     y *.kingpapa.co/* en Google Cloud → Credentials → tu clave.
#
# Uso:
#   bash scripts/verify-maps-referrers.sh
#
# Sale con 0 si todo está OK; 1 si hay algo que rompería kingpapa.co.

set -u

BROWSER_KEY="${GOOGLE_MAPS_BROWSER_KEY_1:-${GOOGLE_MAPS_BROWSER_KEY:-}}"
SERVER_KEY="${GOOGLE_MAPS_API_KEY_1:-${GOOGLE_MAPS_API_KEY:-}}"
LOVABLE="${LOVABLE_API_KEY:-}"

FAIL=0
pass() { echo "  ✅ $1"; }
fail() { echo "  ❌ $1"; FAIL=1; }
warn() { echo "  ⚠️  $1"; }

echo
echo "═══ 1. Credenciales presentes ═══"
[ -n "$BROWSER_KEY" ] && pass "GOOGLE_MAPS_BROWSER_KEY_1 disponible" \
  || fail "Falta GOOGLE_MAPS_BROWSER_KEY_1 (revisa la conexión personalizada)"
[ -n "$SERVER_KEY" ] && pass "GOOGLE_MAPS_API_KEY_1 disponible" \
  || fail "Falta GOOGLE_MAPS_API_KEY_1"
[ -n "$LOVABLE" ] && pass "LOVABLE_API_KEY disponible" \
  || fail "Falta LOVABLE_API_KEY"

[ "$FAIL" -eq 0 ] || { echo; echo "Abortado: faltan credenciales."; exit 1; }

echo
echo "═══ 2. Geocoding API (server key vía gateway) ═══"
body=$(curl -sS \
  -H "Authorization: Bearer ${LOVABLE}" \
  -H "X-Connection-Api-Key: ${SERVER_KEY}" \
  "https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?address=Cali&region=co")
status=$(echo "$body" | head -c 500 | grep -oE '"status"[[:space:]]*:[[:space:]]*"[A-Z_]+"' | head -1)
if echo "$status" | grep -q '"OK"'; then
  pass "Geocoding OK"
else
  fail "Geocoding falló: ${status:-<sin status>} — $(echo "$body" | head -c 200)"
fi

echo
echo "═══ 3. Maps JavaScript API (browser key) ═══"
js=$(curl -sS -o /tmp/_maps.js -w "%{http_code}" \
  "https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&loading=async&callback=__t")
if [ "$js" = "200" ] && grep -q "google.maps" /tmp/_maps.js; then
  pass "Loader responde 200 con bundle válido"
  warn "La validación de referrer se hace en runtime — confírmalo en kingpapa.co tras publicar"
else
  fail "Loader devolvió ${js}"
fi

echo
echo "═══ 4. Places API (New) (browser key, autocomplete) ═══"
places=$(curl -sS -X POST "https://places.googleapis.com/v1/places:searchText" \
  -H "Content-Type: application/json" \
  -H "X-Goog-Api-Key: ${BROWSER_KEY}" \
  -H "X-Goog-FieldMask: places.id" \
  -H "Referer: https://kingpapa.co/" \
  -d '{"textQuery":"Cali, Colombia"}')
if echo "$places" | grep -q '"places"'; then
  pass "Places (New) responde con resultados"
elif echo "$places" | grep -q "has not been used\|is disabled\|SERVICE_DISABLED"; then
  fail "Places API (New) NO está habilitada en tu proyecto Google Cloud"
  echo "     → Habilítala aquí: https://console.cloud.google.com/apis/library/places.googleapis.com"
  echo "     → Sin esto, el autocomplete de dirección en /menu fallará"
elif echo "$places" | grep -q "API keys with referer restrictions cannot be used"; then
  fail "La clave tiene restricción de referrer pero Places (New) no la respeta vía esta llamada"
  echo "     (esto puede ser normal — confírmalo desde el navegador en kingpapa.co)"
else
  warn "Respuesta inesperada: $(echo "$places" | head -c 200)"
fi

echo
echo "═══ Resumen ═══"
if [ "$FAIL" -eq 0 ]; then
  echo "✅ Todos los checks server-side pasaron."
  echo "   Último paso: tras publicar, abre https://kingpapa.co/menu y revisa la consola."
  echo "   Si ves 'RefererNotAllowedMapError' → agrega en Google Cloud:"
  echo "     https://kingpapa.co/*   y   https://*.kingpapa.co/*"
  exit 0
else
  echo "❌ Hay problemas que romperán kingpapa.co. Arréglalos antes de publicar."
  exit 1
fi
