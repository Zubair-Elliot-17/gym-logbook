# Gym Logbook

Cycle-first, offline phone web app for logging a 6-day training split.
Vite + Svelte 5 + Dexie (IndexedDB) + vite-plugin-pwa. No backend.

## What it does

- **Today**: the current day of your split. Last time's sets appear as ghosts: tap to log, hold to edit,
  −/+ to change the next weight. PRs get a red stamp. Finish moves to the next day (Undo for 5 s).
  Barbell lifts show what to load each side (20 kg bar; 25 down to 1.25 kg plates).
- **Rest timer**: starts when you log a set (default 1:30; −15 / +15 / Skip). Set it or turn it off in
  Settings → Training. It survives the app being closed between sets.
- **History** (book icon on Today): this week's days, sets, volume and PRs against last week, then
  every finished day newest first, by month, with sets, PRs and
  volume. Open a day to see or fix its sets.
- **Exercise progress**: History → Exercises, or tap an exercise's name on Today. Best estimated 1RM
  (Epley), heaviest set, volume, a trend chart with PR sessions ringed, and every session.
  Bodyweight exercises track reps.
- **Your split** (Settings → Training): rename days, add up to 10, reorder, switch lifting/rest, remove.
  A removed day with history is archived, so its sets stay in History.
- **Your exercises**: pick from the library or type your own per lifting day, with sets, starting weight
  and reps. Rest days log activities (walk, mobility…) in one tap.
- **Backup**: export / import a JSON file (validated, with an undo snapshot); a reminder every 2 cycles.
- **Offline**: installable PWA; fonts and app are precached.

## Code map

- `src/lib/seed.ts`: the starting split (days). Bump `SEED_VERSION` to ship a change; installs whose
  split was edited in the app (`state.customSplit`) keep their own.
- `src/lib/db.ts`: Dexie schema and every write. `logic.ts`: pure rules (cycle, ghosts, PRs).
- `src/lib/today.ts`, `history.ts`, `rest.ts`: pure view models for Today, History and the rest timer.
- `src/components/`: one Svelte component per screen or sheet. UI rules live in `DESIGN.md`.

```bash
npm install
npm run dev     # local dev server
npm test        # unit tests (Vitest)
npm run check   # svelte-check + tsc
npm run e2e     # Playwright end-to-end (builds and previews first)
npm run build   # production build with service worker
```
