# Gym Logbook

Cycle-first, offline phone web app for logging a 6-day training split.
Vite + Svelte 5 + Dexie (IndexedDB) + vite-plugin-pwa. No backend.

- `src/lib/seed.ts`: the training plan (days, exercises, sets/reps). Edit + bump `SEED_VERSION` to change it.

```bash
npm install
npm run dev     # local dev server
npm test        # unit tests (Vitest)
npm run build   # production build with service worker
```
