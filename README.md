# kimai-plugin-ui

Gemeinsamer UI-Leitfaden und kleines UI-Kit für die Kimai-2.67-Plugins **Drehzettel**, **Holiday** und **Abrechnung**.

- **[GUIDELINES.md](GUIDELINES.md)** – verbindliche Regeln: welcher Kimai-Baustein für welches Muster, Status-Vokabular,
  Formate, Glossar, Übersetzungen, Mobil, Dunkelmodus.
- **[CHECKLIST.md](CHECKLIST.md)** – Prüfliste für jeden UI-PR.
- **`kit/`** – was Kimai fehlt: Twig-Makros, CSS und JS, ohne Abhängigkeiten, nur mit Tabler-/Kimai-Variablen.
- **[examples/demo.html.twig](examples/demo.html.twig)** – Referenzseite, die jedes Makro benutzt.

## Inhalt

```
kit/templates/_kit/macros.html.twig   Makros: period_nav, kpi_bar, status_badge, group_header, empty_state,
                                      result_callout(s), context_line, bulk_bar, bulk_checkbox, bulk_select_all
kit/templates/_kit/assets.html.twig   CSS + JS inline (generiert aus kit/css und kit/js)
kit/css/kit.css                       Klassen .kpu-*, nur var(--tblr-…)
kit/js/kit.js                         window.KimaiPluginUi: Sammelauswahl, Rückgängig-Toast
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
(„UI-Kit 0.1.0 übernommen“).

Im Template (Namespace = Bundle-Name ohne „Bundle“):

```twig
{% import '@Abrechnung/_kit/macros.html.twig' as kit %}

{% block stylesheets %}{{ parent() }}{% include '@Abrechnung/_kit/assets.html.twig' with {kpu_part: 'css'} %}{% endblock %}
{% block javascripts %}{{ parent() }}{% include '@Abrechnung/_kit/assets.html.twig' with {kpu_part: 'js'} %}{% endblock %}
```

Die Makros übersetzen selbst aus der Domain `kpu`. Weil alle Plugins dieselben `kpu`-Dateien mitbringen, sollen sie
dieselbe Kit-Version nutzen (siehe GUIDELINES.md, Abschnitt 6).

## Aktualisieren

1. Änderung hier im Repo machen (`kit/…`), `bin/build-assets.sh` und `bin/lint.sh` laufen lassen.
2. `VERSION` erhöhen (SemVer: Patch = Fehlerbehebung, Minor = neues Makro/Key, Major = Signatur oder Key geändert/entfernt)
   und `CHANGELOG.md` ergänzen.
3. In jedem Plugin `bin/sync.sh <bundle>` ausführen, Seiten prüfen, committen.
4. Im Plugin-CI prüft `bin/sync.sh <bundle> --check`, ob das Kit aktuell ist (Exit-Code 1 bei Abweichung).

Kit-Dateien im Plugin nie direkt ändern – der nächste Sync überschreibt sie.
