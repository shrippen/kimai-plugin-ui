# kimai-plugin-ui

Gemeinsamer UI-Leitfaden und kleines UI-Kit für die Kimai-2.67-Plugins **Drehzettel**, **Holiday**, **Abrechnung** und **Anfahrten** (MileageBundle).

- **[GUIDELINES.md](GUIDELINES.md)** – verbindliche Regeln: welcher Kimai-Baustein für welches Muster, Status-Vokabular,
  Formate, Glossar, Übersetzungen, Mobil, Dunkelmodus.
- **[CHECKLIST.md](CHECKLIST.md)** – Prüfliste für jeden UI-PR.
- **`kit/`** – was Kimai fehlt: Twig-Makros, CSS und JS, ohne Abhängigkeiten, nur mit Tabler-/Kimai-Variablen.
- **[examples/demo.html.twig](examples/demo.html.twig)** – Referenzseite, die jedes Makro benutzt.

## Inhalt

```
kit/templates/_kit/macros.html.twig   Makros: period_nav, kpi_bar, status_badge, group_header, empty_state,
                                      result_callout(s), context_line, bulk_bar, bulk_checkbox, bulk_select_all,
                                      bulk_select_group
kit/templates/_kit/assets.html.twig   CSS + JS inline (generiert aus kit/css und kit/js)
kit/css/kit.css                       Klassen .kpu-*, nur var(--tblr-…)
kit/js/kit.js                         window.KimaiPluginUi: Sammelauswahl (auch je Gruppe), Sofort-Aktionen
                                      (data-kpu-post), Rückgängig-Toast, Events kpu:selection-change u. a.
kit/translations/kpu.{de,en}.xlf      Übersetzungsdomain "kpu"
bin/sync.sh                           Kit in ein Plugin kopieren
bin/build-assets.sh                   assets.html.twig neu erzeugen
bin/lint.sh                           Selbsttest (JS-Syntax, keine Hex-Farben, XLIFF, Key-Bestand de = en)
```

## In ein Plugin übernehmen

```bash
bin/sync.sh /pfad/zu/kimai-abrechnung-bundle
```

Das kopiert nach `Resources/views/_kit/` (Makros, Assets, `VERSION`) und `Resources/translations/kpu.de.xlf`,
`kpu.en.xlf`. Plugin-eigene Dateien werden nicht angefasst, ein zweiter Lauf ändert nichts.
Danach im Kimai-Container `bin/console kimai:reload` und die kopierten Dateien im Plugin committen
(„Update UI kit to 0.3.0“). Mit `bin/sync.sh <bundle> --check` prüfen, ob ein Plugin auf Stand ist (Exit 1, wenn nicht).

Im Template (Namespace = Bundle-Name ohne „Bundle“):

```twig
{% import '@Abrechnung/_kit/macros.html.twig' as kit %}

{% block stylesheets %}{{ parent() }}{% include '@Abrechnung/_kit/assets.html.twig' with {kpu_part: 'css'} %}{% endblock %}
{% block javascripts %}{{ parent() }}{% include '@Abrechnung/_kit/assets.html.twig' with {kpu_part: 'js'} %}{% endblock %}
```

Die Makros übersetzen selbst aus der Domain `kpu`. Weil alle Plugins dieselben `kpu`-Dateien mitbringen, sollen sie
dieselbe Kit-Version nutzen (siehe GUIDELINES.md, Abschnitt 6).

## Muster in Kürze (seit 0.2)

Die Regeln stehen in [GUIDELINES.md](GUIDELINES.md); hier nur die Bausteine zum Kopieren.

### Sofort-Aktion im „…“-Menü (umkehrbar, ohne Bestätigung)

```twig
{{ widgets.table_actions({
    'success': {url: '#', title: 'abrechnung.mark', translation_domain: 'messages', attr: {
        'data-kpu-post': path('abrechnung_mark', {action: 'mark'}),
        'data-kpu-token': csrf_token('abrechnung'),
        'data-kpu-ids': entry.id,
    }},
}) }}
```

```php
// Actions-Subscriber (PageActionsEvent): CsrfTokenManagerInterface per Konstruktor holen
$event->addAction('success', ['url' => '#', 'title' => 'holiday.approve', 'attr' => [
    'data-kpu-post' => $this->path('holiday_absence_bulk_approve'),
    'data-kpu-token' => $this->csrfTokenManager->getToken('holiday_absence')->getValue(),
    'data-kpu-ids' => (string) $absence->getId(),
]]);

// Controller der POST-Route: JSON für kit.js, sonst Flash + Redirect (ohne JS)
if (str_contains((string) $request->headers->get('Accept'), 'application/json')) {
    return new JsonResponse(['message' => $message, 'undo' => ['url' => $undoUrl, 'token' => $token, 'ids' => $ids]]);
}
$this->addFlash('kpu_result', $message);
return $this->redirectToRoute('holiday_absence_index');
```

Fehler: 4xx mit `{"message": "…"}` → kit.js zeigt Kimais Fehler-Alert. Optional `data-kpu-params` (JSON-Objekt, weitere
POST-Felder) und `data-kpu-question` (nur Endgültiges; reiner Text, kit.js maskiert ihn seit 0.3 – kein HTML). Destruktives bleibt bei `addDelete()`.

### Modal-Formulare mit Ergebnis-Hinweis

Kimais Modal folgt einem 302 im Hintergrund und verbraucht dabei den `kpu_result`-Flash (GUIDELINES 3.6). Helfer für
Controller, die `App\Controller\AbstractController` erweitern:

```php
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Antwort nach erfolgreichem Formular mit kpu_result-Hinweis.
 * keepUrl = false: Kimai-Standard, 201 + x-modal-redirect -> Kimai lädt <route> komplett.
 * keepUrl = true : leere 200 -> Kimai schließt das Modal und feuert data-form-event; das Formular braucht
 *                  'attr' => ['data-form-event' => 'kpu.reload'], kit.js lädt dann die aktuelle Seite neu.
 */
private function kpuFormSuccess(Request $request, string $route, array $parameters = [], bool $keepUrl = false): Response
{
    $modal = str_contains(strtolower((string) $request->headers->get('X-Requested-With')), 'kimai-modal');
    if (!$modal) {
        return $this->redirectToRoute($route, $parameters);
    }

    return $keepUrl ? new Response('') : $this->redirectToRouteAfterCreate($route, $parameters);
}
```

Leerzustand mit Modal-Link: `{{ kit.empty_state(text, path('holiday_absence_create'), 'holiday.absence.create'|trans, 'modal-ajax-form') }}`.

### Gruppen-Auswahl (verschachtelt)

```twig
{{ kit.group_header(customer.name, customer.color|colorize(customer.name), sums, actions,
    {select: {form: 'bulk', group: 'c' ~ customer.id}}) }}
{# oder im Tabellenkopf: 'select': {…, html_after: kit.bulk_select_group('bulk', 'c' ~ customer.id, label)} #}
{{ kit.group_header(project.name, null, sums, null,
    {as_row: true, colspan: n, level: 2, select: {form: 'bulk', group: 'c' ~ customer.id ~ '-p' ~ project.id}}) }}
<td class="multiCheckbox">{{ kit.bulk_checkbox('bulk', t.id, null, ['c' ~ customer.id, 'c' ~ customer.id ~ '-p' ~ project.id]) }}</td>
```

```js
document.addEventListener('kpu:selection-change', function (event) {
    if (event.detail.form !== 'bulk') { return; }
    // event.detail.ids (Strings), event.detail.count
});
```

### Warnung und Kennzahlen-Details

```twig
{{ kit.status_badge('warning', 'drehzettel.warning.rest_time'|trans) }}
{{ kit.kpi_bar([{label: 'drehzettel.kpi.surcharges'|trans, value: total|money(currency),
    details: tiers|map(t => {label: t.label, value: t.amount|money(currency)})}]) }}
```

## Aktualisieren

1. Änderung hier im Repo machen (`kit/…`), `bin/build-assets.sh` und `bin/lint.sh` laufen lassen.
2. `VERSION` erhöhen (SemVer: Patch = Fehlerbehebung, Minor = neues Makro/Key, Major = Signatur oder Key geändert/entfernt)
   und `CHANGELOG.md` ergänzen.
3. In jedem Plugin `bin/sync.sh <bundle>` ausführen, Seiten prüfen, committen.
4. Im Plugin-CI prüft `bin/sync.sh <bundle> --check`, ob das Kit aktuell ist (Exit-Code 1 bei Abweichung).

Kit-Dateien im Plugin nie direkt ändern – der nächste Sync überschreibt sie.
