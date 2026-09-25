#!/usr/bin/env bash
# Kopiert das Kit in ein Kimai-Plugin-Bundle.
#
#   bin/sync.sh <pfad-zum-bundle> [--check]
#
# Ziel im Bundle:
#   Resources/views/_kit/macros.html.twig
#   Resources/views/_kit/assets.html.twig
#   Resources/views/_kit/VERSION
#   Resources/translations/kpu.de.xlf
#   Resources/translations/kpu.en.xlf
#
# Die Kit-Dateien werden immer komplett ersetzt (keine Zusammenführung mit Plugin-Dateien):
# Das Kit hat eine eigene Übersetzungsdomain "kpu", die Plugin-Dateien messages.*.xlf bleiben unberührt.
# Idempotent: ein zweiter Lauf ändert nichts. --check meldet nur Abweichungen (Exit-Code 1) und schreibt nichts.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
    echo "Aufruf: $0 <pfad-zum-bundle> [--check]" >&2
    exit 2
}

[ $# -ge 1 ] || usage
BUNDLE="${1%/}"
CHECK=0
[ "${2:-}" = "--check" ] && CHECK=1

if [ ! -d "$BUNDLE" ]; then
    echo "Fehler: $BUNDLE ist kein Verzeichnis" >&2
    exit 2
fi
if ! ls "$BUNDLE"/*Bundle.php >/dev/null 2>&1; then
    echo "Fehler: in $BUNDLE liegt keine *Bundle.php – ist das ein Kimai-Plugin?" >&2
    exit 2
fi

# assets.html.twig aus CSS/JS neu erzeugen, damit nie eine veraltete Fassung kopiert wird
if [ "$CHECK" -eq 0 ]; then
    "$ROOT/bin/build-assets.sh" >/dev/null
fi

VERSION="$(tr -d '[:space:]' < "$ROOT/VERSION")"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
printf '%s\n' "$VERSION" > "$TMP/VERSION"

# Quelle -> Ziel (relativ zum Bundle)
MAP=(
    "$ROOT/kit/templates/_kit/macros.html.twig|Resources/views/_kit/macros.html.twig"
    "$ROOT/kit/templates/_kit/assets.html.twig|Resources/views/_kit/assets.html.twig"
    "$TMP/VERSION|Resources/views/_kit/VERSION"
    "$ROOT/kit/translations/kpu.de.xlf|Resources/translations/kpu.de.xlf"
    "$ROOT/kit/translations/kpu.en.xlf|Resources/translations/kpu.en.xlf"
)

changed=0
for entry in "${MAP[@]}"; do
    src="${entry%%|*}"
    dst="$BUNDLE/${entry#*|}"
    if [ -f "$dst" ] && cmp -s "$src" "$dst"; then
        continue
    fi
    changed=$((changed + 1))
    if [ "$CHECK" -eq 1 ]; then
        echo "veraltet: ${entry#*|}"
    else
        mkdir -p "$(dirname "$dst")"
        cp "$src" "$dst"
        echo "aktualisiert: ${entry#*|}"
    fi
done

if [ "$CHECK" -eq 1 ]; then
    if [ "$changed" -gt 0 ]; then
        echo "Kit in $BUNDLE ist nicht auf Stand $VERSION ($changed Datei(en))." >&2
        exit 1
    fi
    echo "Kit in $BUNDLE ist aktuell ($VERSION)."
    exit 0
fi

if [ "$changed" -eq 0 ]; then
    echo "Kit $VERSION war bereits aktuell in $BUNDLE."
else
    echo "Kit $VERSION nach $BUNDLE kopiert ($changed Datei(en)). Danach: bin/console kimai:reload"
fi
