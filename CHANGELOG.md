# Changelog

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionen nach [SemVer](https://semver.org/lang/de/).

## [0.3.0] – 2026-09-25

Lücken aus den Integrationen Holiday, Abrechnung, Drehzettel und Anfahrten (MileageBundle). Abwärtskompatibel bis auf
den Sicherheitsfix: `data-kpu-question` ist jetzt reiner Text.

### Sicherheit
- kit.js: `data-kpu-question` (Sofort-Aktionen) und `question` der Sammelleiste wurden ungeprüft an Kimais
  `alert.question()` übergeben, das den Text per `innerHTML` einsetzt – HTML im Text (z. B. ein Benutzer- oder
  Projektname in der Frage) wurde ausgeführt. Jetzt maskiert kit.js den Text vorher. Ebenso Titel und Server-Meldung
  in Fehler-Alerts (`alert.error()`, Meldung aus der JSON-Antwort `{message}`). Sonst setzt kit.js nirgends HTML ein
  (Toasts, Zähler: `textContent`).
- `empty_state`: Attributnamen aus `link_attr` werden maskiert.

### Neu
- `KimaiPluginUi.escapeHtml(text)` für eigenes Plugin-JS, das Kimais `alert`-Plugin mit Daten aufruft.
- `tests/kit.test.js` (Node, ohne Browser): Version, `escapeHtml`, Frage und Fehlermeldung kommen maskiert bei Kimai an;
  läuft in `bin/lint.sh`. `bin/lint.sh` prüft außerdem, dass kit.js kein `innerHTML` & Co. benutzt.
- GUIDELINES 5: Glossar um **Genehmigen/Ablehnen** (einheitlich in Holiday, Anfahrten und künftigen Freigaben, mit
  Icons, Status und Meldungsmuster) und die Anfahrten-Begriffe erweitert (Fahrt, Arbeitsweg, Dienstreise, Privatfahrt,
  Beleg, Verpflegungspauschale/-mehraufwand, Entfernungspauschale, Monatsabschluss, Abschließen/Wieder öffnen,
  Fahrtenbuch, Fahrzeug, Mietvorgang, Erkannte Fahrt). Präfix `mileage.` in Abschnitt 6.
- GUIDELINES 2.3: **Icon = Aktionsschlüssel.** Kimai zeigt am Dropdown-Knopf eines Untermenüs nur den Schlüssel als Icon
  (`icon` wird ignoriert), in Untermenüs und im mobilen „…“-Menü gar keins. Regel: Schlüssel = passender Kimai-Alias
  bzw. FA-Klasse, keine Option `icon` mit abweichendem Schlüssel. CHECKLIST-Punkt dazu.

### Geändert
- `kpi_bar` `details`: Ein Eintrag bricht nie in sich um. Label und Wert bleiben auf einer Zeile; ist die Kachel zu
  schmal (360–390 px, zwei Kacheln nebeneinander), wird das Label mit „…“ gekürzt (voller Text im `title`), der Wert
  bleibt ganz sichtbar. Vorher liefen lange Labels über den Kachelrand hinaus. Kacheln haben `min-width: 0`.
- GUIDELINES 3.5/10, README, CHECKLIST: `data-kpu-question`/`question` sind reiner Text; Daten für Kimais `alert`-Plugin maskieren.

### Migration 0.2 → 0.3
- `bin/sync.sh <bundle>`, dann `bin/sync.sh <bundle> --check`. Alle Plugins auf 0.3 (kit.js lädt pro Seite nur einmal).
- Fragen in `data-kpu-question`/`question` mit HTML-Auszeichnung (`<br>`, `<strong>`, `&nbsp;`) auf reinen Text umstellen –
  sie würden sonst als Text angezeigt. (Stand 0.3: keines der vier Plugins nutzt HTML in Fragen.)
- Seitenaktionen mit `icon`-Option und abweichendem Schlüssel auf Schlüssel = Icon umstellen (vor allem Untermenüs).

## [0.2.0] – 2026-09-25

Rückmeldungen aus den Integrationen Drehzettel, Holiday und Abrechnung. Alle Änderungen sind abwärtskompatibel
(neue Parameter sind optional, 0.1-Aufrufe rendern unverändert).

### Neu
- Status `warning` („Warnung“/„Warning“): `bg-orange-lt` plus Kimai-Icon `warning`, damit unterscheidbar von
  `requested` (gelb, ohne Icon). Key `kpu.status.warning`.
- Gruppen-Auswahl: `bulk_checkbox(form_id, id, label, groups)` (neuer 4. Parameter), neues Makro
  `bulk_select_group(form_id, group, label, ids)`, `group_header(…, {select: {form, group | ids, label?}})`.
  Verschachtelte Gruppen, „teilweise“-Zustand, Abgleich bei Einzelklick, „Alle auswählen“ und „Auswahl aufheben“.
  Key `kpu.bulk.select_group`.
- kit.js: Event `kpu:selection-change` `{form, ids, count}` bei jeder Auswahländerung; `KimaiPluginUi.select(formId, ids, checked)`.
- kit.js: Sofort-Aktionen per Attribut `data-kpu-post` (+ `data-kpu-token`, `data-kpu-ids`, `data-kpu-params`,
  `data-kpu-question`) für „…“-Menüs und Seitenaktionen (`attr` in `widgets.table_actions`/`PageActionsEvent`);
  Event `kpu:post-done` (cancelable). Redirects werden nicht im Hintergrund verfolgt (Flash bleibt erhalten),
  Kimais 201 + `x-modal-redirect` wird befolgt.
- kit.js: `KimaiPluginUi.post(url, token, ids, params)` – optionaler 4. Parameter.
- kit.js: Event `kpu.reload` auf `document` lädt die Seite neu (für `data-form-event` von Modal-Formularen).
- `empty_state(message, link_url, link_label, link_class, link_attr)` – Link kann Kimai-Modal öffnen (`modal-ajax-form`).
- `kpi_bar`: `tiles[].details: [{label, value}]` für eine Aufschlüsselung unter dem Wert.
- GUIDELINES: Ergebnis-Hinweise nach Modal-Formularen (`redirectToRouteAfterCreate()` bzw. leere 200 + `kpu.reload`,
  kein `setReloadEvents()` dafür), Plural-Regel (Intervalle ab 0), Rückgängig-Fenster (15 min, gleicher Benutzer,
  gleiche Sitzung, serverseitig; Ausnahme `edit_exported_timesheet` für Abrechnung), Sofort-Aktionen.
- README: Kopiervorlagen (Twig/PHP) für die neuen Muster, Helfer `kpuFormSuccess()`.
- CHECKLIST: Punkte für Gruppen-Auswahl, Warnung, Sofort-Aktionen, Undo-Fenster, Modal + Ergebnis, Plural.

### Geändert
- GUIDELINES 3.3: `requested` steht nicht mehr für Drehzettel-Warnungen – dafür gibt es `warning`.
- Untergruppen-Kopf (`level: 2`) mit Checkbox rückt nicht ein, damit die Checkbox mit den Zeilen fluchtet.

### Migration 0.1 → 0.2
- Keine Pflichtänderung. `bin/sync.sh <bundle>`, dann plugin-eigene Ersatzlösungen ersetzen:
  - Drehzettel: Warnungen `status_badge('requested')`/eigene Chips → `status_badge('warning', grund)`;
    Zuschläge je Stufe → `kpi_bar` mit `details`.
  - Holiday: `data-holiday-post`/`data-token`/`data-ids` + eigenes Klick-Skript → `data-kpu-post`/`data-kpu-token`/`data-kpu-ids`
    (Skript entfällt); `HolidayUiTrait::formSuccess()` darf bleiben (entspricht `keepUrl = true`) oder durch
    `redirectToRouteAfterCreate()` ersetzt werden; eigener Reload-Listener auf `kimai.holidayUpdate` → `data-form-event: kpu.reload`;
    Leerzustand „Abwesenheit anlegen“ → `empty_state(…, 'modal-ajax-form')`.
  - Abrechnung: `abrechnung-select-group` + Auswahl-Skript → `bulk_select_group` im Tabellenkopf und `group_header({select})`
    für Projekte, Zeilen mit `groups`; Menüpunkt „Auswählen“ entfällt oder nutzt `KimaiPluginUi.select()`;
    Zählen/Summen über `kpu:selection-change`; Undo des Abrechnens nach dem Rückgängig-Fenster (GUIDELINES 3.5).
- Hinweis: kit.js lädt pro Seite nur einmal (die zuerst eingebundene Kopie gewinnt). Eine Seite, die Kit-Assets aus zwei
  Plugins mit unterschiedlichen Versionen einbindet, bekommt die ältere – deshalb alle Plugins auf 0.2 synchronisieren.

## [0.1.0] – 2026-09-25

### Neu
- GUIDELINES.md mit den Entscheidungen aus der Entscheidungsvorlage (Grundrichtung B, Muster 3.1 a, 3.2 b, 3.3 a–3.8 a, Ablage a).
- CHECKLIST.md für UI-Reviews.
- Twig-Makros: `period_nav`, `kpi_bar`, `status_badge`, `group_header`, `empty_state`, `result_callout`,
  `result_callouts`, `context_line`, `bulk_bar`, `bulk_checkbox`, `bulk_select_all`.
- `assets.html.twig` mit inline CSS/JS, `kit.css` (`.kpu-*`), `kit.js` (`window.KimaiPluginUi`: Sammelauswahl,
  Rückgängig-Toast, `kpu:bulk-done`/`kpu:undo-done`).
- Übersetzungsdomain `kpu` (de, en).
- `bin/sync.sh`, `bin/build-assets.sh`, `bin/lint.sh`, `examples/demo.html.twig`.
- Getestet gegen Kimai 2.67.0 (hell/dunkel, 1440 px und 390 px).
