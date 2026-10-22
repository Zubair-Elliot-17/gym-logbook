---
# gstack: design-md-format=spec
name: Gym Logbook
description: A yellow waterproof field book for lifting, written in graphite and stamped when it's done, built for wet hands and bad light.
colors:
  paper: "#EEE29A"
  sheet: "#F7EFBE"
  ink: "#1E1F1A"
  pencil: "#5E5838"
  rule: "#D3C46E"
  next: "#E2D27A"
  stamp: "#B00E28"
  paper-dark: "#1B1C14"
  sheet-dark: "#26271C"
  ink-dark: "#EDE3A0"
  pencil-dark: "#9C9670"
  rule-dark: "#34352A"
  next-dark: "#33352A"
  stamp-dark: "#FF6A4D"
typography:
  display:
    fontFamily: Bricolage Grotesque
    fontWeight: 800
    fontSize: 2.875rem
    fontStretch: 75%
    textTransform: uppercase
    lineHeight: 0.92
  body:
    fontFamily: Atkinson Hyperlegible Next
    fontWeight: 400
    fontSize: 1rem
    lineHeight: 1.45
  label:
    fontFamily: Martian Mono
    fontWeight: 600
    fontSize: 0.75rem
    fontStretch: 87.5%
    letterSpacing: 0.04em
    textTransform: uppercase
  mono:
    fontFamily: Martian Mono
    fontWeight: 600
    fontSize: 1.1875rem
    fontStretch: 75%
    letterSpacing: -0.02em
    fontFeature: tnum
rounded:
  sm: 5px
  md: 6px
  lg: 18px
  phone: 30px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
components:
  set-ghost:
    borderColor: "{colors.pencil}"
    borderStyle: dotted 1.5px
    textColor: "{colors.pencil}"
    minHeight: 56px
    rounded: "{rounded.md}"
  set-next:
    backgroundColor: "{colors.sheet}"
    borderColor: "{colors.ink}"
    borderStyle: solid 2px
    textColor: "{colors.ink}"
  set-logged:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    stamp: "inset 0 0 0 3px ink, inset 0 0 0 4px paper"
  pr-stamp:
    textColor: "{colors.stamp}"
    borderColor: "{colors.stamp}"
    fontFamily: Bricolage Grotesque
    rotate: -6deg
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
  sheet:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.lg}"
---

# Gym Logbook

## Overview

**Creative North Star:** "Field Book": the app is a yellow waterproof surveyor's notebook. It's personal because you wear it in, not because it's decorated.
**Product context:** offline phone logbook (PWA) for weight training, one lifter now, any lifter later. Peers: Hevy, Strong (Inter, white or navy, one blue accent).
**Mode per surface:** Operate everywhere (Today, rest day, editor sheet, Settings, first run).
**Reference sites:** https://www.hevyapp.com, https://www.strong.app (2026-10-01; fitbod.me was behind a bot check).
**Key characteristics:**
- Field-book yellow owns the page in light mode. Dark mode is "night survey": yellow ink on olive-graphite.
- Numbers look typed (Martian Mono). Day names look stamped (Bricolage, condensed caps).
- Logging leaves marks: dotted pencil outline → ruled-in next set → inked stamp. A PR gets a red benchmark stamp.
- The same big targets and one-column flow as v1. Only the material changes.

## Colors

**Strategy:** Committed. Yellow paper is the brand. Graphite ink carries text and logged state. Stamp red is the only accent, and only for PRs and destructive confirms.
**Light or dark:** follows the phone (`prefers-color-scheme`). Gyms swing between bright fluorescent and dim, so both themes are first class. Dark is not an inversion: the sheet sits one step above the paper, and ink turns yellow so the field-book identity survives at night.
Contrast (WCAG): ink/paper 12.6 (light), 13.2 (dark). Pencil/paper 5.5, 5.7. Stamp/paper 5.4, 6.1. Logged text on ink 14.3, 13.2.

## Typography

- **Display: Bricolage Grotesque 800, width 75%, uppercase.** Used for day names, sheet titles, Finish and the summary card. It reads like a rubber stamp. Never use it for body text.
- **Body/UI: Atkinson Hyperlegible Next 400/700.** The Braille Institute designed it for low-vision legibility, which suits 2-second glances in a dim gym. Use it for exercise names, chips, settings and sentences.
- **Numerals and labels: Martian Mono 600.** Width 75% for set buttons (19px), 87.5% for meta labels (12px, uppercase). Fixed width, so columns line up and digits never jitter.
- All three are Google Fonts under the OFL, self-hosted as latin woff2 in `public/fonts/` and precached by the service worker so they work offline. Fallbacks: `system-ui` for display and body, `ui-monospace` for numerals.

## Layout

One column, max-width 480px, centered on wider screens. 16px side gutter. Rows are separated by 1px `rule` lines, like ruled pages. The sticky Finish bar is 64px plus the safe-area inset.

## Elevation & Depth

Flat paper. Depth comes from the sheet colour stepping above the paper, plus a 2px ink border on sheets and the next set. No shadows and no glow. The dimmed backdrop behind sheets is ink at 38%.

## Shapes

Corners are 6px on sets, chips and buttons (a stamped block, not a bubble), 5px on week tiles and 18px on the top of sheets. The PR stamp uses 3px corners and is rotated −6°.

## Components

- **Set:** ghost = 1.5px dotted pencil. Next = sheet fill with a 2px ink border. Logged = ink fill, paper text and a double-ring "stamp" inset. PR = a red stamp label overlapping the top-right corner. No two states share a style.
- **Week tile:** done = ink fill. Skipped = hatched rule. Today = 2px ink border. Passed = dotted pencil. Upcoming = 1px rule.
- **Chip (rest day):** dotted until logged, then the same stamp as a logged set.
- **Buttons:** primary = ink fill with paper text, in display caps. Secondary = 2px ink outline. Disabled = 40% opacity.
- **Welcome (first open only):** display "WELCOME" at 64px, three numbered how-it-works steps on ink squares, then "Your exercises" (one row per lifting day in display caps, with a "Set up ›" / "Edit ›" action), then the day picker.
- **Exercise table:** a search field (1.5px ink), muscle tabs as typed labels (the selected tab is ink fill), and rows with the name over the equipment, plus a square "+" that becomes an ink "✓" once added. "+ Add '…' as your own exercise" is a dashed row.
- **Your exercises (day editor):** rows of name + a typed summary ("3 × 5 · 140 kg"), with ↑ ↓ × tools at 48px tall, and a dashed "+ Add exercises" button.
- **Toasts:** sheet colour with a 2px ink border. Save-failed toasts use a dashed border. They sit above the Finish bar and the rest timer (`--rest-h`).
- **Plate load:** a caption under a barbell row's sets, "Load: 20 + 2.5 a side", the plates in Martian Mono ink. Same line in the set sheet, live as you type. Never shown for dumbbells or machines.
- **Rest timer:** a row in the Finish bar, sheet fill + 2px ink border: "REST" label, the countdown in Martian Mono 26px, then −15 / +15 / Skip (1px ink outline). A 3px ink rule drains along the bottom. At zero it becomes a logged-set stamp reading "REST OVER · NEXT SET" for 4 s.
- **History rows:** two lines between 1px rules. Line 1: name (body bold) and date as a typed label with "›". Line 2: the summary in Martian Mono 87.5% pencil ("5 SETS · 2 PRS · 2,160 KG"), with a PR stamp on the right. Months are typed labels. Days / Exercises is a two-tab switch in the muscle-tab style.
- **Past day:** sets as logged stamps (read-only look, tap to edit), PR stamps as on Today, exercise volume as a label.
- **Your split:** rows like the day editor: an ink square with the day's number, name over a typed "LIFTING / REST · TODAY" label, then ↑ ↓ × tools. Edit sheet: a 1.5px ink name field and a Lifting / Rest pair where the chosen one is a logged-set stamp. Rule refusals show inside the sheet with a dashed border.
- **Exercise progress:** three stat tiles (1px rule border, label over a Martian Mono figure), then the chart on a sheet card with a 1.5px ink border: graphite line and dots, PR sessions ringed in stamp red, min/max ruled lines with typed values. The session list repeats every number in the chart.
- **Focus-visible:** 2px stamp outline, offset 2px.

## Do's and Don'ts

- Do keep stamp red for PRs and destructive actions only.
- Do set every weight, rep and count in Martian Mono.
- Do keep tap targets ≥ 48px and set buttons ≥ 56px.
- Don't add textures, grain, doodles or handwriting fonts. The field book is clean paper.
- Don't add drop shadows, glows or gradients.
- Don't use blue. That's the category's colour, not ours.

## Motion

- **Approach:** intentional.
- **Easing:** enter ease-out, exit ease-in.
- **Duration:** micro 120ms, short 200ms.
- **The one authored moment:** logging a set stamps it with a 120ms press (scale 0.96 → 1) as it fills with ink. Under reduced motion the fill is instant. The long-press fill (450ms) and the Finish card stay as before. "Rest over" reuses the same stamp; the timer's drain moves linearly in 250 ms steps (instant under reduced motion).

## Accessibility

Carried over from v1:
- **Set labels:** "<exercise>, set N, W kilos by R, <ghost|next|logged|PR>, <action>".
- **Toasts:** role=status, and role=alert for save failures.
- **Sheets:** role=dialog, with focus moved to the title on open.
- **Reduced motion:** honored everywhere.
- **Rest timer:** role=timer labelled "Rest, N seconds left"; "Rest over" is a role=status.
- **Chart:** role=img with a one-sentence summary (sessions, first → last, best); the session list below carries every value.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-10-01 | v1 "ink on paper" system (Instrument Sans + Barlow Condensed, red PR accent) | Ship v1 fast (/plan-design-review) |
| 2026-10-01 | Replaced with "Field Book" | /design-consultation: user's memorable thing is "Mine, personal". Research showed Hevy and Strong share Inter + white/navy + blue. A Claude subagent independently proposed the field-book direction; adopted its yellow paper, fonts and stamps. Codex unavailable. |
| 2026-10-01 | Added the welcome flow, exercise table and day editor in the Field Book style | User feedback: no intro on open; exercises must be your own |
| 2026-10-22 | Added History, exercise progress and the rest timer in the Field Book style | A logbook you can't read back isn't finished. Peers (Hevy, Strong) all ship history, per-exercise charts and a rest timer. No new colours: the chart is graphite, and stamp red still only marks PRs. |
| 2026-10-22 | The split is editable in Settings; seed.ts only seeds it | "Any lifter later" needs it, and changing your own program shouldn't need a deploy. An edited split is never overwritten by a newer seed. |
