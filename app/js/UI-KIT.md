# ExamPro shared UI kit

A catalog of the reusable pieces already in the app, so new screens reach for
these instead of re-implementing them. All are plain functions on `App.ui` /
`App.components` — no build step, no imports, just call them after your
view's HTML is in the DOM.

## Feedback & dialogs (`app/js/ui.js`)

| Call | Use for |
|---|---|
| `App.ui.toast(msg, type)` | Transient bottom-right notice. `type`: `"ok" \| "err" \| "info"`. |
| `App.ui.copyText(text, okMsg)` | Copies to clipboard with the `execCommand` fallback older/insecure contexts need, then toasts `okMsg`. Every "Copy ___" button (AI prompt, diagnostics report) uses this. |
| `App.ui.confirm({ title, desc, confirmLabel }, onYes)` | Yes/no confirmation modal (danger actions, "Save & exit", etc). |
| `App.ui.prompt({ title, desc, placeholder, value }, onOk)` | Single-text-field modal (rename, etc). |
| `App.ui.customModal(innerHtml)` | Raw modal shell for anything bespoke — returns the veil element to query/wire. Every modal above is built on this. |

## Bank identity (`app/js/ui.js` + `app/js/store.js`)

A bank's "look" is `{ icon, tone, logo }` — either a built-in glyph + colour
tone, or an uploaded image (mutually exclusive, like the app's own branding).

| Call | Use for |
|---|---|
| `App.ui.badgeHtml(look, size, cls?, attrs?)` | Renders a badge from a plain `{icon, tone, logo}` object — use this when there's no stored bank yet (e.g. picking a look during import, before the bank is created). |
| `App.ui.bankBadge(name, size, cls?, attrs?)` | Same badge for an existing bank — looks up its saved look and calls `badgeHtml`. Dashboard, sidebar, palette all agree because they all call this. |
| `App.ui.editableBankBadge(name, size, cls?)` | Same badge, wired to open the picker on click. |
| `App.ui.wireBankBadges(root, onSaved?)` | Call once per render so every `editableBankBadge` in `root` responds to clicks. |
| `App.ui.pickLook({ title, subtitle, icon, tone, logo, onSave })` | The picker modal itself (icon grid, colour swatches, image upload) over a plain look object — `onSave(result)` gets the chosen `{icon, tone, logo}`. Use this directly when there's no bank yet (see `importer.js`'s bank-name field). |
| `App.ui.pickBankLook(name, onSaved?)` | Thin wrapper over `pickLook` for an *existing* bank — reads/writes it via `App.store.setBankLook`. |
| `App.u.readImageFile(file, opts?, done, fail)` | Validates + downscales a user-picked image file to a storable data URI (square canvas, small SVGs stay vector). Shared by the app-branding logo upload (`branding.js`) and the bank-logo picker above — reach for this instead of writing another FileReader/canvas dance. |

## Data viz (`app/js/ui.js`, `app/js/charts.js`)

| Call | Use for |
|---|---|
| `App.ui.ring(pct, size, stroke, colorVar?)` | SVG progress ring (results screen, dashboard). |
| `App.ui.sparkline(values, w?, h?)` | Small inline trend line. |
| `App.chart.*` | Bar charts / heatmap on the Progress page — see `charts.js`. |

## Themed dropdown (`app/js/components.js`)

Native `<select>` renders as raw browser chrome, which clashes with the rest
of the UI. Don't style `<select>` by hand — instead:

1. Render a normal `<select class="select">...</select>` as you always would
   (options, `selected`, `disabled` all work as usual).
2. After it's in the DOM, call `App.components.enhanceSelects(root)` once
   (or `enhanceSelect(el)` for a single element).

That swaps in a themed trigger + listbox matching the app's other dropdown
menus, while the original `<select>` stays put (hidden) as the source of
truth — so existing `sel.value` reads and `sel.onchange` handlers keep
working completely unchanged. See it wired up in `exam.js` (setup modal,
custom-exam builder, matching-question rows), `importer.js`, `progress.js`
and `settings.js`.

## Small helpers (`app/js/utils.js`)

`App.u.esc`, `App.u.debounce`, `App.u.throttle`, `App.u.shuffle`,
`App.u.fmtClock`, `App.u.clamp` — pure helpers, no DOM dependency.

## Adding a new shared component

Put DOM-building widgets (things that create elements and manage their own
state/events, like the themed dropdown) in `app/js/components.js` under
`App.components`. Put one-shot render/format helpers (badges, modals,
toasts) in `app/js/ui.js` under `App.ui`. Either way, add a row to this file
so the next person finds it before writing a new one.
