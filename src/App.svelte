<script lang="ts">
  // App shell: open the database, then render Today from one liveQuery.
  // States (3A): loading skeleton, DB-open error screen, first-run day picker, Today.
  import { liveQuery } from 'dexie'
  import { onMount } from 'svelte'
  import DayView from './components/DayView.svelte'
  import FirstRun from './components/FirstRun.svelte'
  import Toasts from './components/Toasts.svelte'
  import WeekStrip from './components/WeekStrip.svelte'
  import { db, openDb } from './lib/db'
  import { loadToday, type TodayData } from './lib/today'

  let status = $state<'loading' | 'error' | 'ready'>('loading')
  let data = $state.raw<TodayData | null>(null)
  let sub: { unsubscribe(): void } | undefined

  async function start() {
    status = 'loading'
    sub?.unsubscribe()
    try {
      await openDb(db)
    } catch (e) {
      console.error(e)
      status = 'error'
      return
    }
    sub = liveQuery(() => loadToday(db)).subscribe({
      next: (v) => {
        data = v
        status = 'ready'
      },
      error: (e) => {
        console.error(e)
        status = 'error'
      },
    })
  }

  onMount(() => {
    void start()
    return () => sub?.unsubscribe()
  })

  const hasEntries = $derived(
    data !== null &&
      (data.activities.length > 0 ||
        data.sets.some((s) => s.cycleNumber === data!.pos.cycleNumber && s.cycleDayId === data!.pos.cycleDayId)),
  )
</script>

{#if status === 'error'}
  <main class="col error" role="alert">
    <h1>Couldn’t open your log.</h1>
    <p>Your data is still on this phone. Close the app fully and open it again, or tap Retry.</p>
    <button type="button" class="btn primary" onclick={start}>Retry</button>
  </main>
{:else if status === 'loading' || !data}
  <main class="col" aria-busy="true" aria-label="Loading">
    <div class="skel strip"></div>
    <div class="skel title"></div>
    <div class="skel row"></div>
    <div class="skel row"></div>
  </main>
{:else if !data.state.startPicked}
  <div class="col"><FirstRun {db} {data} /></div>
{:else}
  <main class="col">
    <WeekStrip {db} {data} {hasEntries} />
    <DayView {db} {data} />
  </main>
{/if}

<Toasts />

<style>
  .col {
    max-width: 480px;
    margin: 0 auto;
    padding: calc(var(--s3) + env(safe-area-inset-top)) var(--s4) 0;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }
  .error {
    display: grid;
    align-content: center;
    gap: var(--s4);
  }
  .error h1 {
    font-size: var(--fs-day);
  }
  .skel {
    background: var(--next);
    border-radius: var(--radius);
    margin-bottom: var(--s4);
  }
  .skel.strip {
    height: var(--tap);
  }
  .skel.title {
    height: 34px;
    width: 50%;
  }
  .skel.row {
    height: 110px;
  }
</style>
