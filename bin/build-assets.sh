#!/usr/bin/env bash
# Erzeugt kit/templates/_kit/assets.html.twig aus kit/css/kit.css und kit/js/kit.js.
# Aufruf: bin/build-assets.sh   (sync.sh ruft es automatisch auf)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CSS="$ROOT/kit/css/kit.css"
JS="$ROOT/kit/js/kit.js"
OUT="$ROOT/kit/templates/_kit/assets.html.twig"
VERSION="$(tr -d '[:space:]' < "$ROOT/VERSION")"

for f in "$CSS" "$JS"; do
    if grep -q 'endverbatim' "$f"; then
        echo "Fehler: $f enthält 'endverbatim'" >&2
        exit 1
    fi
done

{
cat <<EOF
{#
    kimai-plugin-ui kit $VERSION – GENERIERT von bin/build-assets.sh aus kit/css/kit.css und kit/js/kit.js.
    Nicht von Hand ändern.

    Einbinden (einmal pro Seite, CSS im Kopf, JS am Seitenende):
        {% block stylesheets %}{{ parent() }}{% include '@<Bundle>/_kit/assets.html.twig' with {kpu_part: 'css'} %}{% endblock %}
        {% block javascripts %}{{ parent() }}{% include '@<Bundle>/_kit/assets.html.twig' with {kpu_part: 'js'} %}{% endblock %}
#}
{% set kpu_part = kpu_part ?? 'all' %}
{% if kpu_part == 'all' or kpu_part == 'css' %}
<style data-kpu-version="$VERSION">
{% verbatim %}
EOF
cat "$CSS"
cat <<'EOF'
{% endverbatim %}
</style>
{% endif %}
{% if kpu_part == 'all' or kpu_part == 'js' %}
<script data-kpu-version="VERSION_PLACEHOLDER">
{% verbatim %}
EOF
cat "$JS"
cat <<'EOF'
{% endverbatim %}
</script>
<script>
window.KimaiPluginUi && window.KimaiPluginUi.setTranslations({
    selected: '{{ 'kpu.bulk.selected'|trans({}, 'kpu')|e('js') }}',
    undo: '{{ 'kpu.toast.undo'|trans({}, 'kpu')|e('js') }}',
    close: '{{ 'kpu.toast.close'|trans({}, 'kpu')|e('js') }}',
    error: '{{ 'kpu.toast.error'|trans({}, 'kpu')|e('js') }}',
    undone: '{{ 'kpu.toast.undone'|trans({}, 'kpu')|e('js') }}'
});
</script>
{% endif %}
EOF
} | sed "s/VERSION_PLACEHOLDER/$VERSION/" > "$OUT"

echo "geschrieben: ${OUT#$ROOT/}"
