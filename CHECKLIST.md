# PR-Checkliste UI (Kimai-Plugins)

In jeden PR, der Plugin-Oberflächen ändert, kopieren und abhaken. Abschnittsnummern verweisen auf [GUIDELINES.md](GUIDELINES.md).
Nicht zutreffende Punkte mit „n/a“ markieren.

## Kit
- [ ] Kit mit `bin/sync.sh <bundle>` aktualisiert, `bin/sync.sh <bundle> --check` ist grün; `Resources/views/_kit/VERSION` = aktuelle Kit-Version (2.2)
- [ ] Keine Handänderung in `Resources/views/_kit/*` oder `Resources/translations/kpu.*.xlf` (2.2)
- [ ] Kit-Templates mit Namespace eingebunden (`@Drehzettel/_kit/…`, `@Holiday/_kit/…`, `@Abrechnung/_kit/…`) (2.2)
- [ ] `assets.html.twig` einmal pro Seite: CSS im `stylesheets`-, JS im `javascripts`-Block, jeweils nach `{{ parent() }}` (2.2)

## Seitenaufbau
- [ ] Seite erweitert `base.html.twig` bzw. `datatable.html.twig`, Inhalt in `{% block main %}` (2.1)
- [ ] `PageSetup` mit Titel „Bereich · Zeitraum“, `setActionName()` gesetzt, `setHelp(<volle URL>)` gesetzt (2.3, 2.4)
- [ ] Keine zweite Überschrift (`<h1>`/`<h2>`) im Inhalt; Kontext über `kit.context_line` (2.3)
- [ ] Seitenaktionen nur über `PageActionsEvent`-Subscriber, keine Textknöpfe im Inhalt (2.3)

## Muster
- [ ] Zeitraum über `kit.period_nav` (nur unterstützte Einheiten) oder Kimai-Picker; Zeitraum steht in der URL (3.1)
- [ ] Filter über Kimai-Toolbar/Pagination-Form, keine `<select onchange>` (3.1)
- [ ] Tabellen über DataTable bzw. `macros/datatables.html.twig`; Spaltenklassen gesetzt (3.2)
- [ ] Zeilenaktionen im „…“-Menü (`widgets.table_actions`), höchstens eine Sammelaktion pro häufiger Aktion (3.2)
- [ ] Kein `btn-xs` (existiert nicht), nur `btn`, `btn-sm`, `btn-icon` (3.2)
- [ ] Status nur über `kit.status_badge` mit Vokabular-Schlüssel; kein Durchstreichen/Klartext als Status (3.3)
- [ ] Kennzahlen über `kit.kpi_bar`: ≤ 4 Kacheln, genau eine hervorgehoben (3.4)
- [ ] Destruktives mit Kimai-Modal (`addDelete`, `confirmation-link`, `question`); kein `confirm()` (3.5)
- [ ] Umkehrbares sofort + Rückgängig; Undo-Route vorhanden, mit CSRF (3.5)
- [ ] Leerzustand über `kit.empty_state` mit nächstem Schritt; keine Emojis (3.6)
- [ ] Ergebnisse mit Zahlen sichtbar (`kpu_result`-Flash + `kit.result_callouts()`); keine rohen Exception-Texte als Key (3.6)
- [ ] Formulare als FormTypes mit Kimai-Feldtypen, Anlegen/Bearbeiten im Modal (`modal-ajax-form`, `_form(_modal).html.twig`) (3.7)

## Formate
- [ ] Datum `date_short`, Zeit `time`, Dauer `duration`, Geld `money(currency)`, Zahlen/Tage `amount` (4)
- [ ] Kein `|date('Y-m-d')`, `number_format`, festes „€“/„ h“, keine eigenen Wochentags-/Monatslisten (4)
- [ ] Lange Datumsangaben über `format_date(…, locale: app.user.locale, timezone: false)`, nicht `date_format` (4)

## Sprache und Übersetzungen
- [ ] Begriffe laut Glossar (Benutzer, Tätigkeit, Funktion, Gage, Abrechnen, Abgerechnet, …) (5)
- [ ] Knöpfe = ein Verb; Meldungen = was passiert ist + was zu tun ist (5)
- [ ] Alle Texte über Keys mit Plugin-Präfix; kein Text hart im Template/PHP/JS (6)
- [ ] Keine Core-Keys überschrieben; nichts in die Domain `kpu` geschrieben (6)
- [ ] de und en vollständig, gleicher Key-Bestand; `bin/console lint:xliff` grün (6)

## Darstellung
- [ ] 390 px: `document.documentElement.scrollWidth === 390`, Screenshot im PR (7)
- [ ] Dunkelmodus-Screenshot im PR; keine Hex-/rgb-/Namensfarben, kein Inline-`<style>` im Inhalt (8)
- [ ] Menüeintrag im passenden Core-Bereich, Icon als Kimai-Alias wo möglich (9)
- [ ] Kein Inline-JS-Handler; JS startet auf `kimai.initialized`; POSTs mit CSRF (10)
- [ ] `bin/console lint:twig <bundle>/Resources/views` grün
