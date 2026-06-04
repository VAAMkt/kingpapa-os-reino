#!/usr/bin/env bash
# Verifica que la clave de navegador de Google Maps (nueva conexión personalizada)
# acepte los referrers de kingpapa.co antes de publicar.
#
# Uso:
#   bash scripts/verify-maps-referrers.sh
#
# Sale con código 0 si TODOS los referrers de producción están permitidos,
# 1 si alguno falla (RefererNotAllowedMapError / REQUEST_DENIED).

set -u

KEY="${GOOGLE_MAPS_BROWSER_KEY_1:-${GOOGLE_MAPS_BROWSER_KEY:-}}"
if [ -z "$KEY" ]; then
  echo "❌ No hay GOOGLE_MAPS_BROWSER_KEY_1 ni GOOGLE_MAPS_BROWSER_KEY en el entorno"
  exit 2
fi

# Endpoint barato que respeta restricciones HTTP referrer.
URL="https://maps.googleapis.com/maps/api/staticmap?center=3.45,-76.53&zoom=14&size=64x64&key=${KEY}"

REFERRERS=(
  "https://kingpapa.co/"
  "https://www.kingpapa.co/"
  "https://kingpapa.co/menu"
)

FAIL=0
echo "Verificando referrers contra la clave conectada…"
echo

for ref in "${REFERRERS[@]}"; do
  body="$(curl -sS -H "Referer: ${ref}" "$URL")"
  # Google devuelve 200 + imagen PNG si OK, o 403 + texto con el error si no.
  if echo "$body" | head -c 8 | grep -q $'\x89PNG'; then
    echo "  ✅ ${ref}"
  else
    # Recortar a una línea legible
    msg="$(echo "$body" | head -c 300 | tr '\n' ' ')"
    echo "  ❌ ${ref}"
    echo "     → ${msg}"
    FAIL=1
  fi
done

echo
if [ "$FAIL" -eq 0 ]; then
  echo "✅ La clave acepta todos los referrers de kingpapa.co. Listo para publicar."
  exit 0
else
  echo "❌ Algún referrer fue rechazado. Revisa en Google Cloud Console:"
  echo "   APIs & Services → Credentials → tu clave → Application restrictions → HTTP referrers"
  echo "   Debe incluir:  https://kingpapa.co/*   y   https://*.kingpapa.co/*"
  exit 1
fi
