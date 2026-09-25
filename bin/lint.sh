#!/usr/bin/env bash
# Selbsttest des Kits (ohne Kimai): JS-Syntax, keine festen Farben im CSS, XLIFF wohlgeformt, de/en gleicher Key-Bestand,
# assets.html.twig aktuell. Twig-Syntax prüft Kimai: bin/console lint:twig <bundle>/Resources/views/_kit
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
fail=0

if command -v node >/dev/null 2>&1; then
    node --check kit/js/kit.js && echo "ok   kit.js Syntax"
else
    echo "skip kit.js Syntax (node fehlt)"
fi

if grep -nEi '#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|:\s*(white|black)\b' kit/css/kit.css; then
    echo "FEHLER feste Farben in kit/css/kit.css" >&2; fail=1
else
    echo "ok   kit.css ohne feste Farben"
fi

keys() { grep -o 'resname="[^"]*"' "$1" | sort; }
python3 -c "import sys,xml.dom.minidom as m; [m.parse(f) for f in sys.argv[1:]]" kit/translations/kpu.de.xlf kit/translations/kpu.en.xlf \
    && echo "ok   XLIFF wohlgeformt"
if diff <(keys kit/translations/kpu.de.xlf) <(keys kit/translations/kpu.en.xlf) >/dev/null; then
    echo "ok   de/en gleicher Key-Bestand"
else
    echo "FEHLER de/en Keys unterschiedlich" >&2; fail=1
fi

# jeder in Makros/Assets benutzte kpu.-Key muss existieren
for k in $(grep -ohE "'kpu\.[a-z_]+\.[a-z_]+'" kit/templates/_kit/*.twig | tr -d "'" | sort -u); do
    grep -q "resname=\"$k\"" kit/translations/kpu.de.xlf || { echo "FEHLER Key fehlt: $k" >&2; fail=1; }
done
# dynamische Keys (kpu.status.<x>, kpu.period.<x>)
for k in open requested approved rejected billed locked; do grep -q "resname=\"kpu.status.$k\"" kit/translations/kpu.de.xlf || { echo "FEHLER kpu.status.$k" >&2; fail=1; }; done
for k in day week month year; do grep -q "resname=\"kpu.period.$k\"" kit/translations/kpu.de.xlf || { echo "FEHLER kpu.period.$k" >&2; fail=1; }; done
[ "$fail" -eq 0 ] && echo "ok   alle benutzten kpu.-Keys vorhanden"

cp kit/templates/_kit/assets.html.twig "${TMPDIR:-/tmp}/kpu-assets.$$"
bin/build-assets.sh >/dev/null
if cmp -s kit/templates/_kit/assets.html.twig "${TMPDIR:-/tmp}/kpu-assets.$$"; then
    echo "ok   assets.html.twig aktuell"
else
    echo "FEHLER assets.html.twig war veraltet (jetzt neu erzeugt, bitte committen)" >&2; fail=1
fi
rm -f "${TMPDIR:-/tmp}/kpu-assets.$$"

exit "$fail"
