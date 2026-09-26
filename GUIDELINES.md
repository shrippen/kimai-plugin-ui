# UI-Leitfaden für Kimai-Plugins (Drehzettel, Holiday, Abrechnung, Anfahrten)

Gilt für Kimai **2.67** und alle Seiten, die die Plugins im Kimai-Webinterface zeigen (nicht für PDFs und Landingpages).
Die Begriffe **MUSS**, **DARF NICHT**, **SOLL** und **KANN** sind verbindlich gemeint. Jede Abweichung von einem MUSS
braucht im PR eine Begründung. Die Prüfliste für Reviews steht in [CHECKLIST.md](CHECKLIST.md).

Kit-Version: siehe [VERSION](VERSION). Pfade wie `/opt/kimai/templates/...` beziehen sich auf den Kimai-Core im Container.

---

## 1. Grundsätze

1. **Kimai zuerst.** Gibt es in Kimai einen Baustein (Template, Makro, Event, JS-Plugin, Tabler-Klasse), MUSS er benutzt
   werden. Das Kit ergänzt nur, was Kimai fehlt.
2. **Ein Kit, keine Eigenbauten.** Was das Kit abdeckt (Zeitraum, Kennzahlen, Status, Gruppenkopf, Leerzustand,
   Ergebnis-Hinweis, Sammelaktion, Rückgängig), DARF NICHT pro Plugin neu gebaut werden.
3. **Keine eigene Optik.** Keine eigenen Farben, Schriften, Schatten oder Radien. Nur Tabler-Klassen und
   `var(--tblr-…)`-Variablen, damit Hell/Dunkel, Mobil und Kimai-Updates von selbst funktionieren.
4. **Gleiche Bedeutung, gleiches Aussehen.** Status, Formate und Begriffe sind in allen drei Plugins gleich (Abschnitte 4–6).
5. **Jede Seite funktioniert bei 390 px Breite** ohne waagrechtes Scrollen der Seite.

---

## 2. Seitenaufbau

### 2.1 Template und Blöcke

- Seiten MÜSSEN `base.html.twig` erweitern, Listenseiten mit Kimai-`DataTable` SOLLEN `datatable.html.twig` erweitern.
- Inhalt gehört in `{% block main %}` (nicht `page_content` überschreiben, sonst fehlen Kimais `ThemeEvent::CONTENT_*`).
- Relevante Blöcke aus `/opt/kimai/templates/base.html.twig` und `@Tabler/layout_vertical.html.twig`:

| Block | Wofür | Hinweis |
|---|---|---|
| `stylesheets` | Kit-CSS | immer `{{ parent() }}` zuerst |
| `javascripts` | Kit-JS, eigenes Seiten-JS | immer `{{ parent() }}` zuerst; läuft am Seitenende |
| `page_intro` | Kontextzeile (`kit.context_line`) | danach `{{ parent() }}`, das rendert `table_actions` |
| `table_actions` | Zeitraum-Navigator, bei DataTable zusätzlich `{{ parent() }}` (Suche/Filter) | links im Seitenkopf |
| `page_actions` | NICHT überschreiben – kommt aus `PageActionsEvent` | rechts im Seitenkopf |
| `page_content_start` | `kit.result_callouts()` vor `{{ parent() }}` | liest Flash-Typ `kpu_result` |
| `main` | Seiteninhalt | |

- Der Seitenkopf (`page_header`) wird nur gerendert, wenn `PageSetup::setActionName()` gesetzt ist oder die Seite ein
  Suchformular hat. Jede Plugin-Seite MUSS deshalb `setActionName()` setzen, auch wenn (noch) keine Aktionen existieren.

### 2.2 Kit einbinden

```twig
{% extends 'base.html.twig' %}
{% import '@Abrechnung/_kit/macros.html.twig' as kit %}

{% block stylesheets %}{{ parent() }}{% include '@Abrechnung/_kit/assets.html.twig' with {kpu_part: 'css'} %}{% endblock %}
{% block javascripts %}{{ parent() }}{% include '@Abrechnung/_kit/assets.html.twig' with {kpu_part: 'js'} %}{% endblock %}
```

- Kit-Templates MÜSSEN mit dem Bundle-Namespace angesprochen werden: `@Drehzettel/`, `@Holiday/`, `@Abrechnung/`
  (Symfony-Namespace = Bundle-Name ohne „Bundle“). Alle drei Plugins hängen `Resources/views` zusätzlich an den
  Root-Namespace; `_kit/…` ohne Namespace wäre deshalb mehrdeutig.
- Kit-Dateien im Plugin DÜRFEN NICHT von Hand geändert werden. Änderungen gehen in dieses Repo, dann `bin/sync.sh`.

### 2.3 Seitenkopf (Entscheidung 3.1 a)

- **Titel:** `new PageSetup($title)` – Bereich plus Zeitraum, z. B. „Drehzettel · KW 21“, „Abwesenheiten · 2026“,
  „Abrechnung · Mai 2025“. Der Titel steht in Kimais Navbar. Übersetzte Titel mit Parametern im Controller bauen:
  `new PageSetup($translator->trans('drehzettel.page.week', ['%week%' => 21]))`.
- Eine zweite Überschrift (`<h2>`, `<h1>`) im Inhalt DARF NICHT vorkommen.
- **Kontextzeile:** Objekt, Person, Zeitraum grau unter dem Titel mit `kit.context_line([...])` in `page_intro`.
- **Aktionen:** ausschließlich über `PageActionsEvent` (`/opt/kimai/src/Event/PageActionsEvent.php`):
  - Controller: `$page->setActionName('drehzettel_week'); $page->setActionPayload(['engagement' => $e]);`
  - Subscriber: Klasse erweitert `App\EventSubscriber\Actions\AbstractActionsSubscriber`,
    `getActionName()` liefert `'drehzettel_week'`, `onActions(PageActionsEvent $event)` fügt hinzu.
  - Helfer: `addCreate($url)` (Modal), `addEdit($url)`, `addDelete($url, …)`, `addQuickExport($url)`,
    `addAction('pdf', ['url' => …, 'title' => 'drehzettel.week_pdf'])`, Selteneres gruppiert mit
    `addActionToSubmenu('<icon-alias>', '<key>', [...])`.
  - Der Schlüssel einer Aktion ist ein Kimai-Icon-Alias (Abschnitt 9), und zwar der, der zur Aktion passt
    (`success` = Genehmigen, `rejected` = Ablehnen, `pdf`, `mail`, `locked` …). `title` ist ein Übersetzungskey (Domain
    `messages`, sonst `'translation_domain' => …`).
  - **Icon = Schlüssel** (seit 0.3). Die Option `icon` DARF NICHT benutzt werden, um einem anderen Schlüssel ein Icon zu
    geben. Grund (Kimai 2.67, `macros/widgets.html.twig` `actions()` und `@Tabler/components/actions.html.twig`):
    - Knöpfe auf dem Desktop zeigen `icon ?? Schlüssel`,
    - Untermenüs (`addActionToSubmenu('<schlüssel>', …)` oder `addAction('<schlüssel>', ['children' => …])`) zeigen am
      Dropdown-Knopf **nur den Schlüssel** – `icon` wird dort ignoriert,
    - Einträge in Untermenüs und im mobilen „…“-Menü zeigen gar kein Icon, nur `title`.
    Ein Schlüssel wie `mileage_commute` mit `'icon' => 'home'` sieht also als Knopf richtig aus, als Untermenü aber falsch.
    Deshalb: Schlüssel = passender Kimai-Alias (`addAction('home', …)`, `addActionToSubmenu('edit', …)`), ohne `icon`.
    Gibt es keinen Alias, ist der Schlüssel die FontAwesome-Klasse (`addAction('fas fa-location-dot', …)`, Untermenü
    „Weitere“: `addAction('fas fa-ellipsis-h', ['title' => …, 'children' => …])`). Jeder Schlüssel nur einmal pro Seite –
    zwei Aktionen mit gleichem Icon gehören in ein Untermenü.
  - Kimai zeigt die Aktionen auf dem Desktop als Knöpfe mit Icon, auf dem Handy automatisch als „…“-Menü.
- Textknöpfe im Inhalt für Seitenaktionen DÜRFEN NICHT verwendet werden.

### 2.4 Hilfe

- Jede Seite MUSS `$page->setHelp('<url>')` setzen (Link auf die Plugin-Doku im Plugin-Repo, z. B. `docs/…`).
  Kimai zeigt dann den „?“-Knopf unten rechts. Relative Werte zeigen auf kimai.org – für Plugins immer eine volle URL.
- Formulare KÖNNEN Hilfetexte über die Symfony-Option `help` tragen; lose `<p class="text-muted">` DÜRFEN NICHT für
  Feldhilfe verwendet werden.

---

## 3. Muster

### 3.1 Zeitraum-Navigation (Entscheidung 3.2 b) – Kit

`kit.period_nav(units, current_unit, label, prev_url, next_url, today_url, unit_urls)` in `{% block table_actions %}`.

- Segment Woche | Monat | Jahr (Tabler `nav nav-segmented`), dann `‹ label ›` (Kimai-Icons `left`/`right`), dann „Heute“.
- Es MÜSSEN nur Einheiten übergeben werden, die die Seite wirklich kann. Mit nur einer Einheit entfällt das Segment.
- `label` wird mit Kimai-Filtern gebaut: Monat `date|month_name(true)`, Woche
  `'stats.workingTimeWeekShort'|trans({'%week%': w})` (Core-Key: „KW 21“ / „Week 21“) plus `date_short`, Jahr als Zahl.
- `today_url` = `null`, wenn der aktuelle Zeitraum schon angezeigt wird. `prev_url`/`next_url` = `null` deaktiviert.
- Der Zeitraum steht in der URL (Route-Parameter oder Query), nie nur in der Session.
- Weitere Filter (Benutzer, Team, Kunde) SOLLEN über Kimais DataTable-Suche (`DataTable::setSearchForm()`, Toolbar-Form)
  oder `PageSetup::setPaginationForm()` mit Kimai-`UserType` laufen, nicht über eigene `<select onchange>`.
  Kimais eigene Picker (`YearPickerType`, `MonthPickerType`, `WeekPickerType`, `/opt/kimai/templates/form/blocks.html.twig`)
  DÜRFEN für Seiten mit genau einer Einheit statt `period_nav` benutzt werden.

### 3.2 Tabellen und Zeilenaktionen (Entscheidung 3.3 a)

- Listen MÜSSEN Kimais DataTable-Bausteine nutzen:
  - Paginierte Entitätslisten: `App\Utils\DataTable` + `datatable.html.twig`, Spalten mit `addColumn(name, ['class' => …])`.
    Vorlage: `/opt/kimai/src/Controller/TagController.php` + `/opt/kimai/templates/tags/index.html.twig`
    (Blöcke `datatable_row_attr`, `datatable_column_value`).
  - Gruppierte oder nicht paginierte Listen: die Makros aus `macros/datatables.html.twig` direkt:
    `tables.datatable_header(name, columns, null, {columnConfig: false})` … Zeilen … `tables.data_table_footer(null, null, null)`,
    Zellklassen über `datatable_column_class(name, column)`. Beispiel: `examples/demo.html.twig`.
- Spaltenklassen: `alwaysVisible` (nie ausblendbar), `d-none d-md-table-cell` (erst ab Tablet), `w-min` (schmal),
  `text-end` für Zahlen. Auf 390 px bleiben höchstens Auswahl, Hauptspalte, eine Zahl, Status und „…“ sichtbar.
- **Zeilenaktionen** stehen im „…“-Menü: `{% set event = actions(app.user, '<action>', 'index', {...}) %}{{ widgets.table_actions(event.actions) }}`
  (Subscriber wie in 2.3) oder direkt `widgets.table_actions({...})`. Mehrere Text- oder Farbknöpfe pro Zeile DÜRFEN NICHT sein.
- Eine Zeile KANN per `class="modal-ajax-form open-edit" data-href="…"` im `datatable_row_attr` das Bearbeiten-Modal öffnen
  (Kimai ignoriert Klicks in Zellen mit Klasse `multiCheckbox` und `actions`).
- **Sammelaktion** für die häufige Aktion (Abrechnen, Genehmigen):
  - Kit: `kit.bulk_checkbox(form_id, id)` in einer Zelle mit Klasse `multiCheckbox`, `kit.bulk_select_all(form_id)` im
    Kopf (bei `DataTable` über Spaltenoption `'html_after' => '<input … class="form-check-input kpu-select-all" data-kpu-form="…">'`),
    `kit.bulk_bar(form_id, actions)` unter der Tabelle.
  - Das Formular schickt `ids[]` und `_token` (CSRF, Token-ID pro Aktion) an `action.url`.
  - **Gruppen-Auswahl** (seit 0.2): Jede Zeile nennt ihre Gruppen-Schlüssel, `kit.bulk_checkbox(form_id, id, null, ['c5', 'c5-p12'])`;
    die Gruppen-Checkbox wählt nur Zeilen mit ihrem Schlüssel: im Gruppenkopf
    `kit.group_header(…, {…, select: {form: form_id, group: 'c5-p12'}})`, im Tabellenkopf
    `'html_after': kit.bulk_select_group(form_id, 'c5', label)`. Verschachtelt funktioniert es von selbst (Kunde `c5`
    wählt alle Zeilen des Kunden, Projekt `c5-p12` nur seine). Die Checkbox zeigt „teilweise“ (indeterminate), folgt
    Einzelklicks, „Alle auswählen“ und „Auswahl aufheben“ und ist ohne auswählbare Zeilen deaktiviert. Schlüssel ohne
    Leerzeichen, eindeutig pro Formular. Statt Schlüssel geht `ids: [..]`. Eigene „Gruppe auswählen“-Skripte DÜRFEN NICHT sein.
  - Seiten-JS, das auf die Auswahl reagiert (Summe der Auswahl, Knöpfe aktivieren), hört auf
    `kpu:selection-change` (`event.detail = {form: '<form-id>', ids: ['101', …], count}`, bubbles bis `document`).
    Es kommt nach jeder Änderung: Zeile, Gruppe, alle, „Auswahl aufheben“, `KimaiPluginUi.select()`, Neuladen der Tabelle.
    Wer Checkboxen per JS setzt, ruft danach `KimaiPluginUi.update()` (oder gleich `KimaiPluginUi.select(form, ids, true)`).
  - Kimais eigenes Batch-Formular (`DataTable::setBatchForm()` + `App\Form\MultiUpdate\MultiUpdateTable`) DARF für
    **endgültige** Sammelaktionen auf einer paginierten Entitätsliste benutzt werden; es fragt immer per Modal nach.
    Beide Mechanismen DÜRFEN NICHT in derselben Tabelle gemischt werden.
- Knöpfe MÜSSEN `btn`, `btn-sm` oder `btn-icon` sein. **`btn-xs` gibt es in Kimai 2.67 nicht.**
- Die einzige Ausnahme von DataTable ist das **Tagesraster** der Drehzettel-Woche (Tage × Stufen/Zuschläge). Es bleibt
  plugin-spezifisch, MUSS aber Tabler-Klassen/Variablen nutzen und in einem `overflow-x: auto`-Container stehen
  (`.kpu-table-wrap`), damit die Seite selbst nicht breiter als 390 px wird.

### 3.3 Status (Entscheidung 3.4 a) – Kit

`kit.status_badge('<key>')` rendert ein weiches Tabler-Badge (`badge bg-*-lt`) mit übersetztem Text. Für Ja/Nein-Werte
bleibt Kimais `widgets.label_boolean()`.

| Schlüssel | Deutsch | Englisch | Klasse | Bedeutung |
|---|---|---|---|---|
| `open` | Offen | Open | `bg-secondary-lt` (grau) | AB: noch nicht abgerechnet · DZ: Tag ohne Eintrag |
| `requested` | Beantragt | Requested | `bg-warning-lt` (gelb) | HB: Abwesenheit wartet auf Genehmigung |
| `approved` | Genehmigt | Approved | `bg-success-lt` (grün) | HB: Abwesenheit genehmigt |
| `rejected` | Abgelehnt | Rejected | `bg-danger-lt` (rot) | HB: Abwesenheit abgelehnt |
| `billed` | Abgerechnet | Billed | `bg-blue-lt` (blau) | AB: exportiert (Kimai `exported`) · HB: in Abrechnung übernommen |
| `locked` | Gesperrt | Locked | `bg-purple-lt` (violett) | HB: Monat gesperrt · Kimai-Lockdown |
| `warning` | Warnung | Warning | `bg-orange-lt` (orange) + Icon `warning` (!) | DZ: Verstoß gegen Regeln (Ruhezeit, Höchstarbeitszeit) – Grund im `tooltip` |

- **`warning` vs. `requested`:** In Tabler sind `warning` und `yellow` dieselbe Farbe. Damit „Warnung“ nie wie „Beantragt“
  aussieht, ist `warning` orange (`bg-orange-lt`) und trägt immer das Ausrufezeichen; `requested` bleibt gelb ohne Icon.
  „Warnung“ ist kein Bearbeitungsstand, sondern ein Hinweis: Er DARF neben einem Status-Badge stehen
  (`{{ kit.status_badge('open') }} {{ kit.status_badge('warning', 'drehzettel.warning.rest_time'|trans) }}`).
  Der Grund MUSS im `tooltip` (oder daneben als Text) stehen.
- `billed` nutzt bewusst `bg-blue-lt` statt `bg-primary-lt`: die Primärfarbe ist in Tabler umstellbar, der Status soll blau bleiben.
- Neue Status MÜSSEN erst hier und im Kit ergänzt werden. Durchstreichen, Klartext oder eigene Chips als Status DÜRFEN NICHT sein.
- Status DARF NICHT allein über Farbe vermittelt werden (Text im Badge ist Pflicht).

### 3.4 Kennzahlen (Entscheidung 3.5 a) – Kit

`kit.kpi_bar([{label, value, hint?, highlight?, url?, details?}])` direkt am Anfang von `main`.

- Höchstens **4** Kacheln (weitere schneidet das Makro ab), genau **eine** mit `highlight: true` (die wichtigste Zahl).
- `value` MUSS mit Kimai-Filtern formatiert sein (Abschnitt 4). Kein eigener Hintergrund, keine weißen Texte.
- Aufschlüsselung einer Kachel (z. B. Drehzettel-Zuschläge je Stufe) über `details: [{label, value}]` (seit 0.2), kurze
  Labels, Werte formatiert; höchstens etwa 4 Einträge – mehr gehört in eine Tabelle. Ein Eintrag bricht nie in sich um
  (seit 0.3): Label und Wert bleiben zusammen, bei schmaler Kachel (360–390 px, zwei Kacheln nebeneinander) wird das
  Label mit „…“ gekürzt (voller Text im Tooltip), der Wert bleibt ganz sichtbar; ganze Einträge rutschen in die nächste Zeile.
- Summen pro Gruppe gehören in `kit.group_header(title, color, sums, actions, options)`: Farbpunkt über Kimais
  `widgets.label_dot`, Summen rechts, „…“ über `widgets.table_actions`. Als Tabellenzeile mit
  `{as_row: true, colspan: n}`, Untergruppe mit `{level: 2}`.

### 3.5 Bestätigen und Rückgängig (Entscheidung 3.6 a)

- **Endgültig oder destruktiv** (Löschen, Signatur entfernen, Regelwerk löschen): Kimai-Modal.
  - Einzelaktion: `PageActionsEvent::addDelete($url)` (Remote-Bestätigungsseite `default/_form_delete.html.twig`),
    oder `class="confirmation-link" data-question="confirm.delete"` (Kimai-JS `KimaiConfirmationLink`),
    oder `class="api-link" data-method="DELETE" data-question="…"` für API-Routen.
  - Sammelaktion: `question` in `kit.bulk_bar` (öffnet `kimai.getPlugin('alert').question()`).
  - Native `confirm()`, `onsubmit="return confirm(…)"` DÜRFEN NICHT verwendet werden.
- **Umkehrbar** (Abrechnen, Genehmigen, Ablehnen, Sperren): sofort ausführen, dann Hinweis mit „Rückgängig“.
  - Sammelaktion: `ajax: true` in `kit.bulk_bar`. Der Controller antwortet bei `Accept: application/json` mit
    `{"message": "3 Einträge abgerechnet", "undo": {"url": "…", "token": "…", "ids": [..]}}`; ohne JS (normaler POST)
    mit Redirect und `addFlash('kpu_result', …)`.
  - **Einzelaktion im „…“-Menü oder als Seitenaktion** (seit 0.2): Attribute statt eigenem Skript, kit.js erledigt den Rest.
    Twig (`widgets.table_actions`):
    ```twig
    'success': {url: '#', title: 'holiday.approve', attr: {
        'data-kpu-post': path('holiday_absence_bulk_approve'),
        'data-kpu-token': csrf_token('holiday_absence'),
        'data-kpu-ids': absence.id,                                 {# optional, "1,2" oder JSON-Array -> ids[] #}
        'data-kpu-params': {mode: 'single'}|json_encode,            {# optional, weitere POST-Felder #}
    }}
    ```
    PHP (`PageActionsEvent` im Actions-Subscriber – `attr` wird von Kimais `button`-Makro 1:1 ausgegeben, in
    Knopfleiste und „…“-Menü):
    ```php
    $event->addAction('success', [
        'url' => '#',
        'title' => 'holiday.approve',
        'attr' => [
            'data-kpu-post' => $this->path('holiday_absence_bulk_approve'),
            'data-kpu-token' => $this->csrfTokenManager->getToken('holiday_absence')->getValue(),
            'data-kpu-ids' => (string) $absence->getId(),
        ],
    ]);
    ```
    kit.js schickt `POST` mit `_token`, `ids[]`, Parametern, `Accept: application/json`, `X-Requested-With: XMLHttpRequest`.
    Antwort JSON `{message, undo?}` → Seite neu laden + Hinweis mit „Rückgängig“; Redirect oder HTML → Seite neu laden
    (kit.js folgt dem Redirect nicht selbst, damit `kpu_result`-Flashes erhalten bleiben); 4xx/5xx → Kimai-Fehler-Alert
    mit `message` aus der JSON-Antwort. Ein eigener Listener auf `kpu:post-done` kann mit `preventDefault()` das
    Neuladen verhindern und die Seite selbst aktualisieren. `url` bleibt `'#'` (ein GET auf die POST-Route wäre ein 405).
    `data-kpu-question` gibt es nur für Endgültiges; Destruktives bleibt bei `addDelete()`/`confirmation-link`.
    `data-kpu-question` und `question` in `kit.bulk_bar` sind **reiner Text** (seit 0.3): kit.js maskiert sie, bevor
    Kimais Bestätigungsmodal sie einsetzt (Kimai setzt dort HTML ein). HTML-Auszeichnung (`<br>`, `<strong>`) erscheint
    also als Text – Fragen kurz und ohne Markup formulieren. Namen von Benutzern, Projekten usw. dürfen darin stehen.
  - Einzelaktion aus eigenem JS: `KimaiPluginUi.undoToast(message, {url, token, ids})` oder
    `KimaiPluginUi.reloadWithToast(message, undo)`.
  - Die Undo-Route nimmt `_token` + `ids[]` per POST und antwortet `{"message": "…"}`.

#### Rückgängig-Fenster (seit 0.2)

Rückgängig macht **genau die eigene Aktion** ungeschehen. Dafür gilt:

1. **Wer:** nur der Benutzer, der die Aktion ausgeführt hat.
2. **Wo:** nur in derselben Sitzung. Die Aktion legt beim Ausführen einen Eintrag in der Session ab
   (`$session->set('<plugin>.undo.<aktions-id>', ['user' => $userId, 'ids' => $ids, 'before' => $vorherigerZustand, 'at' => time()])`);
   die `undo`-Daten der Antwort nennen die Aktions-ID (als Parameter oder in der URL), die Undo-Route liest nur diesen Eintrag.
   IDs aus dem Request allein reichen NIE.
3. **Wie lange:** höchstens **15 Minuten** nach der Aktion (der Toast ist 10 s sichtbar, das Fenster deckt Neuladen und
   Nachdenken ab). Danach ist der Eintrag ungültig und wird gelöscht; ebenso nach erfolgreichem Rückgängig.
4. **Was:** nur die IDs dieser Aktion, nur zurück in den Zustand davor, und nur, wenn der Datensatz seitdem nicht
   anderweitig geändert wurde (sonst Fehler mit Hinweis). CSRF-Token wie bei jeder POST-Route.
5. **Berechtigung:** Innerhalb dieses Fensters DARF die Undo-Route auf eine Berechtigung verzichten, die sonst für die
   Rückrichtung nötig ist – freigegeben vom Product Owner für **Abrechnung**: das Zurücksetzen einer eigenen
   Sammelaktion „Abgerechnet“ ohne `edit_exported_timesheet`. Die Berechtigung für die **Hinrichtung** MUSS bei der
   Aktion geprüft worden sein. Das Fenster DARF NIE mehr erlauben als die Umkehr der eigenen Aktion (keine anderen
   IDs, Benutzer oder Sitzungen, keine weiteren Felder). Nach Ablauf gelten wieder die normalen Kimai-Rechte.
6. Jede Ausnahme nach Punkt 5 für ein anderes Plugin oder eine andere Berechtigung braucht eine eigene Freigabe und
   wird hier eingetragen.

### 3.6 Leerzustand und Rückmeldung (Entscheidung 3.7 a) – Kit

- Leere Liste: `kit.empty_state(message, link_url, link_label, link_class, link_attr)` – gleiche Optik wie Kimais
  `widgets.nothing_found()` plus Link zum naheliegenden nächsten Schritt („Filter zurücksetzen“, „Abwesenheit anlegen“).
  Ohne Argumente zeigt es Kimais Standardtext. Emojis, Tabellenzeilen mit „Keine Einträge“ oder graue Absätze DÜRFEN NICHT sein.
- Öffnet der nächste Schritt ein Formular, dann im Kimai-Modal: `link_class` = `'modal-ajax-form'`
  (Kimai 2.67 `KimaiAjaxModalForm` hört auf Klicks auf `.modal-ajax-form` und lädt `data-href` oder `href` mit
  `X-Requested-With: Kimai-Modal`):
  `{{ kit.empty_state('holiday.absence.empty'|trans, path('holiday_absence_create'), 'holiday.absence.create'|trans, 'modal-ajax-form') }}`.
  `link_attr` setzt weitere Attribute (z. B. `data-kpu-post`/`data-kpu-token` für eine Sofort-Aktion).
- Kimai blendet **Erfolgs-Flashes aus** (`base.html.twig`, `page_content_start`). Ergebnisse mit Zahlen (Import,
  Synchronisierung, Sammelaktion ohne JS) MÜSSEN deshalb sichtbar gemacht werden:
  Controller `$this->addFlash('kpu_result', $translator->trans('holiday.import.result', ['%count%' => $n]))`,
  Template `{% block page_content_start %}{{ kit.result_callouts() }}{{ parent() }}{% endblock %}`
  oder direkt `kit.result_callout(message)`.
- **Ergebnis-Hinweise und Modale/Ajax:** Ein Flash wird von der ersten Seite verbraucht, die gerendert wird – auch wenn
  sie nur im Hintergrund per `fetch()` geholt wird. Kimai 2.67 tut das an zwei Stellen:
  - `KimaiAjaxModalForm` schickt das Modal-Formular per `fetch(…, {redirect: 'follow'})`. Ein normaler 302-Redirect
    wird im Hintergrund verfolgt, die Zielseite rendert und verbraucht `kpu_result`; danach schließt das Modal nur,
    feuert `data-form-event` und lädt **nicht** neu. Der Hinweis ist verloren.
  - `KimaiDatatable` lädt bei einem Reload-Event (`DataTable::setReloadEvents()`, `reload`-Option) die Seite per
    `fetch()` und ersetzt nur `section.content` – auch das verbraucht Flashes, die Kennzahlen bleiben alt.
  Deshalb MUSS ein Modal-Formular, dessen Erfolg einen `kpu_result`-Hinweis setzt (oder Kennzahlen ändert), so antworten:
  - **Standard:** `return $this->redirectToRouteAfterCreate('<route>', [...]);` (Kimai `App\Controller\AbstractController`):
    HTTP 201 mit Header `x-modal-redirect`; Kimais `KimaiFetch` macht daraus `window.location = url`, die Seite lädt
    komplett und zeigt `kpu_result`. Ohne JS leitet der Meta-Refresh im Antworttext weiter.
  - **Seite behält ihre URL (Filter, Zeitraum):** Formular-Option `'attr' => ['data-form-event' => 'kpu.reload']`
    und nach Erfolg im Modal `return new Response('');` (leere 200: Kimai wertet „kein Formular in der Antwort“ als
    Erfolg, feuert `kpu.reload`, kit.js lädt die Seite neu). Ohne Modal (normale Seite) weiter `redirectToRoute()`.
  - Solche Seiten DÜRFEN für diese Formulare kein `setReloadEvents()` nutzen. Reload-Events bleiben für Änderungen ohne
    Ergebnis-Hinweis (z. B. Kimai-Timesheet-Modal auf einer Plugin-Liste).
  Helfer für beide Fälle: README, Abschnitt „Modal-Formulare mit Ergebnis-Hinweis“.
- Sofort-Aktionen über `data-kpu-post` sind davon nicht betroffen: kit.js folgt Redirects nicht im Hintergrund und lädt neu.
- Reine Bestätigungen ohne Information („Gespeichert“) bleiben wie in Kimai stumm (`flashSuccess`).
- Fehler: `flashError('<key>')` bzw. `flashUpdateException($e)` (Domain `flashmessages`), in JS
  `kimai.getPlugin('alert').error(title, message)`. Rohe Exception-Texte DÜRFEN NICHT als Übersetzungskey verwendet werden.

### 3.7 Formulare (Entscheidung 3.8 a)

- Formulare MÜSSEN Symfony-FormTypes mit Kimai-Feldtypen sein: `App\Form\Type\DatePickerType`, `DateRangeType`,
  `DurationType`, `UserType`, `CustomerType`, `ProjectType`, `ActivityType`, `YesNoType`; Geld über Symfonys `MoneyType`
  mit `currency`-Option (Vorbild `/opt/kimai/src/Form/AbstractRateForm.php`).
  Native `<input type="date">`, handgeschriebene `<form>`-Felder und `number_format` in Feldwerten DÜRFEN NICHT sein.
- Anlegen/Bearbeiten öffnet im Kimai-Modal: Link/Aktion mit Klasse `modal-ajax-form` (bzw. `addCreate()`/`addEdit()`).
  Das Template folgt Kimais Muster (`/opt/kimai/templates/tags/edit.html.twig`):
  `{% extends kimai_context.modalRequest ? 'form.html.twig' : 'base.html.twig' %}` und im `main`-Block
  `{% embed (kimai_context.modalRequest ? 'default/_form_modal.html.twig' : 'default/_form.html.twig') with {title: …, form: form, back: path(…)} %}`.
  So rendert dasselbe Template als Modal oder als Seite (Karte mit Titel, Fuß mit Speichern/Zurück).
  Nach Erfolg antwortet der Controller wie in Kimai mit Redirect plus `data-form-event` für die DataTable – setzt er
  einen `kpu_result`-Hinweis, dann nach 3.6 mit `redirectToRouteAfterCreate()` bzw. leerer 200 + `kpu.reload`.
- Lange Editoren (Drehzettel-Regelwerk) DÜRFEN eine eigene Seite mit `default/_form.html.twig` sein.
- Validierung über Symfony-Constraints (`validators`-Domain), nicht über eigene JS-Meldungen.

---

## 4. Formate

Kimai-Filter kennen Sprache, Zeitzone und Währung des Benutzers. Hartkodierte Formate DÜRFEN NICHT verwendet werden
(`|date('Y-m-d')`, `number_format`, `" h"`, `"€"`, eigene Wochentags-/Monatslisten in PHP).

| Wert | Regel | de / en |
|---|---|---|
| Datum | `|date_short` | 19.05.2025 / 5/19/2025 |
| Datum + Uhrzeit | `|date_time` (`date_full` ist veraltet) | |
| Uhrzeit | `|time` | 09:00 / 9:00 AM |
| Dauer | `|duration` (Sekunden), dezimal `|duration(true)` | 9:00 · 0:30 |
| Geld | `|money(currency)` – Währung von Kunde/Projekt, nie fest „€“ | 1.500,00 € / €1,500.00 |
| Zahl | `|amount` | 1.500,5 / 1,500.5 |
| Tage | `|amount` (zeigt Nachkommastellen nur, wenn nötig) | 3 · 2,5 / 3 · 2.5 |
| Monat | `|month_name(true)` | Mai 2025 |
| Wochentag | `|day_name` / `|date_weekday` | |
| Kalenderwoche | `'stats.workingTimeWeekShort'|trans({'%week%': n})` (Core-Key) | KW 21 / Week 21 |
| Langes Datum | `|format_date('full', locale: app.user.locale, timezone: false)` (Intl) | Montag, 19. Mai 2025 |

- Achtung: Kimais `|date_format(…)` ist **PHP-`date()`-Format**, kein Intl-Muster. Für eigene Intl-Muster
  `|format_date(pattern: <Muster aus Übersetzung>, locale: app.user.locale, timezone: false)` – das Muster selbst MUSS
  aus einem Übersetzungskey kommen (de „EEEE, d. MMMM“, en „EEEE, MMMM d“). Ohne `locale:` formatiert `format_date` englisch.
- In PHP (PDF, Mails): `App\Utils\LocaleFormatter` bzw. `IntlDateFormatter`/`NumberFormatter` mit Benutzer-Locale.
- Formatierte Werte in Tabellen und Summen tragen die Klasse `kpu-num` (seit 0.4), siehe 8.1. Kimai-Spalten
  `col_date`, `col_duration` usw. brauchen sie nicht zusätzlich, eigene Spalten (`col_distance`, Wochenraster) schon.

---

## 5. Sprache und Begriffe

Begriffe folgen Kimais deutscher Übersetzung. Wo ein Plugin einen Kimai-Begriff anders belegt, bekommt es ein eigenes Wort.

| Begriff | Deutsch | Englisch | Statt |
|---|---|---|---|
| Person | Benutzer | User | „Nutzer“ (DZ), „Mitarbeiter“ (AB) |
| Kimai-Tätigkeit | Tätigkeit | Activity | – (nur für Kimai-Activity) |
| Rolle am Set (Drehzettel) | Funktion | Crew role | „Tätigkeit“ (kollidiert mit Core) |
| Filmvergütung | Gage | Pay | „Gage (€)“ |
| Als exportiert markieren | Abrechnen | Mark as billed | „Eintrag abrechnen“ |
| Zustand danach | Abgerechnet | Billed | Durchstreichen + „Undo“ |
| Freizeitausgleich | Freizeitausgleich | Time off in lieu | deutsches Wort auf /en |
| PDF-Knöpfe | Wochen-PDF / Monats-PDF | Week PDF / Month PDF | „Timesheet“ |
| Menü | Arbeitsvertrag › Abwesenheiten | Employment contract › Absences | „Absence“ (Einzahl) |
| Rückgängig | Rückgängig | Undo | – |
| Antrag annehmen (Knopf) | Genehmigen | Approve | „Freigeben“, „Bestätigen“, „Akzeptieren“ |
| Antrag zurückweisen (Knopf) | Ablehnen | Reject | „Zurückweisen“, „Verweigern“, „Decline“ |
| Zustand danach | Genehmigt / Abgelehnt (`status_badge('approved'/'rejected')`) | Approved / Rejected | „Freigegeben“ |
| Antrag stellen (Knopf) | Zur Genehmigung einreichen | Submit for approval | „Absenden“, „Beantragen“ bei Monaten |

**Anfahrten (MileageBundle)** – Begriffe nach deutschem Steuerrecht, gleich in Menü, Seiten, PDF und CSV:

| Begriff | Deutsch | Englisch | Statt |
|---|---|---|---|
| Einzelne Fahrt (Oberbegriff) | Fahrt / Fahrten | Trip / Trips | „Anfahrt“, „Tour“, „Strecke“ als Objekt |
| Wohnung ↔ erste Tätigkeitsstätte | Arbeitsweg | Commute | „Pendelfahrt“, „Weg zur Arbeit“ |
| Auswärtstätigkeit, z. B. zum Kunden | Dienstreise | Business trip | „Dienstfahrt“, „Geschäftsreise“ |
| Nicht abziehbar | Privatfahrt / Privat | Private trip / Private | – |
| Nachweis zu einer Fahrt | Beleg / Belege | Receipt / Receipts | „Quittung“, „Anhang“, „Attachment“ |
| Pauschale je Tag (Satz) | Verpflegungspauschale | Meal allowance | „Spesen“, „Tagegeld“ |
| Summe der Pauschalen (Seite, Steuer) | Verpflegungsmehraufwand | Meal allowance | „Spesen“ |
| km-Pauschale für den Arbeitsweg | Entfernungspauschale | Commuting allowance | „Pendlerpauschale“ |
| Monate festschreiben (Seite) | Monatsabschluss | Month closing | „Monatssperre“ |
| Monat festschreiben (Knopf) | Abschließen | Close | „Sperren“ beim Monat; Zustand danach `status_badge('locked')` |
| Abschluss zurücknehmen (Knopf) | Wieder öffnen | Reopen | „Entsperren“ |
| Gesamtes Protokoll | Fahrtenbuch | Logbook | „Log“ |
| Auto usw. | Fahrzeug / Firmenwagen / Mietwagen | Vehicle / Company car / Rental | „KFZ“, „PKW“ als Objekt |
| Einzelne Anmietung | Mietvorgang | Rental | „Miete“ |
| Aus GPS vorgeschlagene Fahrt | Erkannte Fahrt · Übernehmen | Detected trip · Accept | „Vorschlag annehmen“ |

**Genehmigen/Ablehnen** (seit 0.3) heißen in allen Plugins gleich – Abwesenheiten (Holiday), Monate/Fahrten
(Anfahrten) und jede künftige Freigabe: Knopf „Genehmigen“ (Icon `success`, sofort + Rückgängig) und „Ablehnen“ (Icon
`rejected`; mit Pflicht-Begründung im Modal, sonst sofort + Rückgängig). Meldungen: „3 Abwesenheiten genehmigt.“,
„Fahrten von Anna für Mai 2026 abgelehnt.“ Die Zustände zeigen `status_badge('approved')`/`('rejected')`, der Antrag
davor `status_badge('requested')`.

**Knöpfe** sind ein Verb, das sagt, was passiert: „Abrechnen“, „Genehmigen“, „Speichern“. Das Objekt wird nicht
wiederholt, wenn die Zeile es schon zeigt („Abrechnen“, nicht „Eintrag abrechnen“). Destruktive Aktionen sind rot
(`text-red` im Menü, `btn-danger`) und stehen nur im Modal oder im „…“-Menü.

**Meldungen** sagen, was passiert ist und was zu tun ist: „Urlaub überschneidet sich mit Krankheit am 22.09.
Zeitraum anpassen.“ Keine Ausnahmetexte, keine Entschuldigungen, keine Ausrufezeichen, keine Emojis.

---

## 6. Übersetzungen (i18n)

- Jedes Plugin nutzt nur Keys mit eigenem Präfix: `drehzettel.`, `holiday.`, `abrechnung.`, `mileage.` (Domains `messages`,
  `flashmessages`, `validators`). Das Kit nutzt die eigene Domain `kpu` mit Präfix `kpu.`.
- Core-Keys DÜRFEN benutzt, aber NIE in Plugin-Dateien neu definiert werden (`action.save`, `confirm.delete`, `yes`, …).
- Kein sichtbarer Text im Template, in PHP oder in JS ohne Key. JS bekommt Texte aus dem Template
  (`'key'|trans|e('js')` oder `data-*`-Attribute).
- Jede Datei MUSS für **de** und **en** vorhanden sein, mit gleichem Key-Bestand.
- **Plural mit `%count%`:** Die Intervalle MÜSSEN jede Zahl ab 0 abdecken. Symfony wirft sonst
  `InvalidArgumentException: Unable to choose a translation` (geprüft in Kimai 2.67 – `{1}…|]1,Inf[…` stürzt bei 0 ab).
  Richtig: `{0}Keine Einträge|{1}Ein Eintrag|]1,Inf[%count% Einträge` oder kurz `{1}%count% Eintrag|[0,Inf[%count% Einträge`
  (das erste passende Intervall gewinnt). Die Zahl 0 gehört in jeden Test mit Plural.
- **Kit-Domain `kpu`:** Jedes Plugin bringt `Resources/translations/kpu.de.xlf`/`kpu.en.xlf` mit. Sind mehrere Plugins
  installiert, lädt Symfony alle Dateien in dieselbe Domain; bei gleichem Key gewinnt die zuletzt geladene. Das ist
  unschädlich, solange die Inhalte gleich sind. Deshalb:
  - Plugins SOLLEN dieselbe Kit-Version verwenden (`bin/sync.sh <bundle> --check` im CI).
  - Ein Kit-Key DARF seine Bedeutung nie ändern. Neue Bedeutung = neuer Key. Keys werden nur entfernt,
    wenn kein Plugin sie mehr benutzt (Hauptversion).
  - Plugins DÜRFEN keine eigenen Keys in die Domain `kpu` schreiben.

---

## 7. Mobil (390 px)

- Jede Seite MUSS bei 390 × 844 ohne waagrechtes Scrollen des Dokuments funktionieren
  (`document.documentElement.scrollWidth === 390`).
- Tabellen: DataTable-Spaltenklassen (`d-none d-md-table-cell`), sonst `.table-responsive` bzw. `.kpu-table-wrap`
  um die Tabelle. Feste Breiten (`style="width:160px"`, `min-width` > 358 px) DÜRFEN NICHT gesetzt werden.
- Kopf-Aktionen klappt Kimai selbst zu „…“ zusammen; Kit-Zeitraum und Sammelleiste brechen um.

## 8. Dunkelmodus

- Farben nur über Tabler-Klassen (`bg-*-lt`, `text-secondary`, `text-body-secondary`, `border`) oder `var(--tblr-…)`.
  Hex-, `rgb()`- und Namensfarben (`#fff`, `white`) DÜRFEN NICHT in Plugin-CSS/-Templates stehen – Ausnahme:
  Entitätsfarben aus Kimai (Kunde/Projekt/Tätigkeit) über `widgets.label_dot`/`colorize`.
- Kein Inline-`<style>` im Seiteninhalt; Plugin-CSS, das nicht ins Kit gehört, im `stylesheets`-Block
  oder über `ThemeEvent::STYLESHEET`.
- Jeder UI-PR enthält Screenshots hell und dunkel (Kimai setzt `data-bs-theme="dark"` nach Benutzer/System).

### 8.1 Themes (seit 0.4)

Ein Kimai-Theme (z. B. Knust) soll Plugins mitgestalten können, ohne dass ein Plugin das Theme kennen muss. Dafür
kennzeichnet das Plugin, **was** ein Element ist; wie es aussieht, entscheidet das Theme. Ohne Theme gilt die neutrale
Grundform aus dem Kit.

| Kennzeichnung | Bedeutung | Kit-Grundform |
|---|---|---|
| `kpu-num` | Zahl, Zeit, Datum, Betrag, Dauer (Zelle oder Inline-Element) | Ziffern gleich breit, kein Umbruch |
| `kpu-tier` + `data-kpu-tier="0–3"` | Stufe: `0` Grundstufe, `1`–`3` steigend (Zuschläge, Prioritäten) | keine; Farbe setzt das Plugin weiter selbst |
| `kpu-mark` | Farbpunkt einer Entität (Kunde, Projekt, Tätigkeit) | `inline-block`, schrumpft nicht |

- Kennzeichnungen ersetzen keine Tabler-Klassen: Eine Stufe bleibt z. B. `bg-yellow text-yellow-fg kpu-tier`,
  damit sie ohne Theme genauso aussieht wie vorher.
- Eigenes Plugin-CSS DARF Theme-Variablen nur mit Rückfallwert nutzen: `border-radius: var(--knust-mark-radius, 50%)`.
  Welche Variablen es gibt, steht beim Theme (Knust: `PLUGINS.md`).
- Ein Plugin DARF NICHT abfragen, ob ein bestimmtes Theme installiert ist, um sein CSS zu ändern. Ausnahme nur für
  Ausgaben, die CSS nicht erreicht und die in Kimai bleiben; Exporte (PDF, Mail, ICS, CSV) bleiben immer neutral.

## 9. Menüs und Icons

- Menüeinträge über `App\Event\ConfigureMainMenuEvent`, eingehängt in den passenden Core-Bereich
  (`getTimesheetMenu()`, `getInvoiceMenu()`, `getReportingMenu()`, `getAdminMenu()`, `findById('contract')`), mit
  `App\Utils\MenuItemModel($id, $labelKey, $route, [], $icon)`.
- Icons MÜSSEN Kimai-Icon-Aliase sein, wo einer passt (`config/packages/tabler.yaml`), z. B. `invoice`, `holiday`,
  `sickness`, `time-off`, `public-holiday`, `calendar`, `pdf`, `mail`, `locked`, `unlocked`, `success`, `rejected`,
  `pending`, `review`, `settings`, `download`, `upload`, `trash`, `edit`, `create`, `left`, `right`, `repeat`.
  Rohe FontAwesome-Klassen nur, wenn es keinen Alias gibt (z. B. `fas fa-clapperboard` für Drehzettel).
- In Twig `{{ icon('pdf', true) }}`, in PageActions ist der Aktionsschlüssel der Alias.

## 10. JavaScript

- Kein Inline-Handler (`onclick`, `onchange`, `onsubmit`). Skripte im `javascripts`-Block, gestartet auf
  `document.addEventListener('kimai.initialized', e => { const kimai = e.detail.kimai; … })`.
- Kimai-Plugins benutzen: `kimai.getPlugin('alert')` (`error`, `warning`, `info`, `success`, `question`),
  `getPlugin('api')`, `getPlugin('fetch')`; Klassen `modal-ajax-form`, `confirmation-link`, `api-link`.
- Ajax-Antworten an eigene Controller mit `X-Requested-With: XMLHttpRequest` (Symfony `isXmlHttpRequest()`),
  POST immer mit CSRF-Token (`csrf_token('<plugin>_<zweck>')`).
- Kimais `alert`-Plugin (`question`, `error`, `warning`, `info`, `success`) setzt Texte als **HTML** ein. Texte aus
  Daten (Namen, Server-Antworten, `data-*`-Attribute) MÜSSEN vorher mit `KimaiPluginUi.escapeHtml(text)` (seit 0.3)
  maskiert werden. Eigenes JS DARF `innerHTML`/`insertAdjacentHTML` nicht mit solchen Daten füllen – `textContent`
  bzw. `createElement` benutzen.
- Kit-API: `window.KimaiPluginUi` (`undoToast`, `toast`, `reloadWithToast`, `post(url, token, ids, params?)`,
  `selectedIds`, `select`, `update`, `escapeHtml`), Attribute `data-kpu-post`/`-token`/`-ids`/`-params`/`-question`, Events
  `kpu:selection-change`, `kpu:bulk-done`, `kpu:post-done`, `kpu:undo-done` und `kpu.reload` – siehe Kopf von `kit/js/kit.js`.
  Eigene Kopien dieser Mechanik (`data-<plugin>-post`, eigene Gruppen-Checkbox-Skripte) DÜRFEN NICHT sein.

## 11. Kit-Bausteine (Übersicht)

| Muster | Kimai-Baustein | Kit |
|---|---|---|
| Seitentitel, Aktionen, Hilfe | `PageSetup`, `PageActionsEvent`, `setHelp()` | – |
| Kontextzeile | – | `context_line(parts)` |
| Zeitraum | Year/Month/WeekPickerType (eine Einheit) | `period_nav(…)` |
| Tabelle, „…“-Menü | `DataTable`, `macros/datatables.html.twig`, `widgets.table_actions` | – |
| Sammelaktion | `setBatchForm()` (nur endgültig) | `bulk_bar`, `bulk_checkbox`, `bulk_select_all`, `bulk_select_group`, `kpu:selection-change` |
| Sofort-Aktion im „…“-Menü | `widgets.table_actions`, `PageActionsEvent` (`attr`) | `data-kpu-post` (kit.js) |
| Status, Warnung | `widgets.label_boolean` (Ja/Nein) | `status_badge(status, tooltip)` |
| Kennzahlen | `macros/status.html.twig` (Navbar-Status) | `kpi_bar(tiles)` |
| Gruppenkopf | `widgets.label_dot` | `group_header(…)` (mit `select`) |
| Leerzustand | `widgets.nothing_found()` | `empty_state(…)` (Link auch als Modal) |
| Ergebnis | – (Kimai blendet Erfolg aus); nach Modal `redirectToRouteAfterCreate()` | `result_callout`, `result_callouts`, `kpu.reload` |
| Bestätigen | `confirmation-link`, `addDelete()`, `alert.question` | – |
| Rückgängig | – | `KimaiPluginUi.undoToast`, Rückgängig-Fenster (3.5) |
| Formular | FormTypes, `default/_form.html.twig`, `modal-ajax-form` | – |
| Tagesraster | – | bewusst nicht im Kit (Drehzettel-spezifisch) |
| Zahl, Stufe, Farbpunkt für Themes | Kimai-Spaltenklassen `col_*` | `kpu-num`, `kpu-tier`/`data-kpu-tier`, `kpu-mark` (8.1) |
