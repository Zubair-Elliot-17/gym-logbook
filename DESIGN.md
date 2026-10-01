# Design system

Source of truth for the UI. Decided in `/plan-design-review` (2026-10-01), decisions 7A–15A.
Tokens live in `src/styles/tokens.css`.

## Type (7A)
- UI text: **Instrument Sans** 400 / 600.
- Every weight, rep and count: **Barlow Condensed** 600, `font-variant-numeric: tabular-nums` (class `.num`).
- Both self-hosted in `public/fonts/` (latin woff2, SIL Open Font License) and precached by the
  service worker. Fallback `system-ui`.

## Color (8A)
Switched with `prefers-color-scheme`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | #F4F5F2 | #0F1113 | background |
| `--ink` | #15171A | #ECEDEA | text, logged sets, done tiles |
| `--muted` | #5C6166 | #9AA0A6 | secondary text, ghosts |
| `--line` | #C9CCCF | #34383C | borders, dashed ghosts |
| `--next` | #E6E8EA | #22262A | the next ghost, long-press fill |
| `--accent` | #C8102E | #FF4D5E | **PR badges and destructive confirms only** |

Measured contrast: muted 5.72 / 7.17, PR badge text 5.88 / 5.83, ink on next 14.6 / 13.0.

## States (9A, 15A)
| Element | Style |
|---|---|
| Ghost set | 1px dashed `--line`, `--muted` text |
| Next set | `--next` fill, 2px `--ink` border |
| Logged set | `--ink` fill, `--paper` text, ✓ |
| PR | `--accent` badge, ≥ 12px text |
| Tile done | `--ink` fill |
| Tile skipped | hatched `--line` on `--paper` |
| Tile today | 2px `--ink` border, bold |
| Tile upcoming | 1px `--line` |
| Tile passed | 1px dotted `--line`, `--muted` text |

No two states share a style.

## Sizes (10A)
- Spacing 4 / 8 / 12 / 16 / 24 / 32. Radius 10px.
- Tap targets ≥ 48×48. Set buttons ≥ 56px tall.
- Numerals 22px. Day name 28px / 600. Body 16px. Captions 13px. PR badge 12px.
- Sticky Finish bar 64px + safe-area inset.
- Wider than 520px: one centered column, max-width 480px (13A).

## Motion
Only three authored moments, all replaced by static changes under `prefers-reduced-motion`:
1. Next unfinished row scrolls to the top (2A).
2. Finish summary card (6A).
3. Long-press fill, 450 ms left-to-right (11A); static highlight at 200 ms with reduced motion.

## Accessibility (13A)
- Set label: "<exercise>, set N, W kilos by R, <ghost|next|logged|PR>, <action>".
- Toasts `role=status`; the save-failed toast `role=alert`.
- Sheets `role=dialog`; focus moves to the title on open and returns on close.
- Tiles: "<day>, <done|skipped|today|upcoming|passed>".
