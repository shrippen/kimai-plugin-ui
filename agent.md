# Working rules for this repository

## GUI rule

- This repository is the UI kit of the shrippen Kimai plugins (Drehzettel, Holiday, Abrechnung,
  Anfahrten, …). Kimai plugins take their GUI from Knust (`shrippen/kimai-knust-bundle`), the
  Kante spinoff that adapts Kante to Kimai's look. Rule text:
  https://github.com/shrippen/shrippen.github.io/blob/main/kante/AGENT-RULE.md
- The kit says *what* an element is (`kpu-*` markers, macros); Knust decides how it looks
  (Knust `PLUGINS.md`). Use Knust and the kit as they are: no own colours, fonts, sizes, radii,
  shadows, no own copy or variant of a component that Knust or Kante has.
- Kit CSS is a neutral base form: Tabler variables (`var(--tblr-…)`), Knust variables only with
  a fallback (`var(--knust-focus, var(--tblr-primary))`). Raw values (`#hex`, `rgb()`) are a bug;
  `bin/lint.sh` enforces it.
- A missing element is added here first (marker, macro, example, docs), then its look to Knust,
  then it is used in the plugin. Never solve it locally in a plugin and never wait with a
  "temporary" copy. Where it would also help outside Kimai, add it to Kante as well.

## Repository rule

- This repository lives on Gitea (`git.arianw.de`). GitHub is only a push mirror of it.
- Changes arrive as pull requests only: work on a branch, open a PR, leave the merge to the owner (who merges on Gitea; the mirror follows).
- Never merge a PR, push to `main` (or any default branch), push tags or publish releases on GitHub. A merge there is overwritten by the next Gitea push.
- Never force-push a branch that someone else's PR depends on.
