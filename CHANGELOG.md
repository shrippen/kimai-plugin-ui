# Changelog

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionen nach [SemVer](https://semver.org/lang/de/).

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
