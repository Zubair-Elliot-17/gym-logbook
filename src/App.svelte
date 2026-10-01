<script lang="ts">
  // App shell: open the database, then render Today from one liveQuery.
  // States (3A): loading skeleton, DB-open error screen, first-run day picker, Today.
  import { liveQuery } from 'dexie'
  import { onMount } from 'svelte'
  import DayView from './components/DayView.svelte'
  import FirstRun from './components/FirstRun.svelte'
  import Settings from './components/Settings.svelte'
  import Toasts from './components/Toasts.svelte'
  import WeekStrip from './components/WeekStrip.svelte'
  import { backupOverdue } from './lib/backup'
  import { db, openDb } from './lib/db'
  import { isStandalone, needRefresh, offlineReady, updateApp } from './lib/pwa'
  import { loadToday, pickBanner, type TodayData } from './lib/today'
  import { toasts } from './lib/toast.svelte'

  let status = $state<'loading' | 'error' | 'ready'>('loading')
  let data = $state.raw<TodayData | null>(null)
  let sub: { unsubscribe(): void } | undefined
  let view = $state<'today' | 'settings'>('today')
  const standalone = isStandalone()

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

  const banner = $derived(
    data ? pickBanner({ standalone, offlineReady: $offlineReady, backupOverdue: backupOverdue(data.state) }) : null,
  )

  // 5A: an update is offered in Settings, and once per session right after a Finish.
  let updateOffered = false
  function afterFinish() {
    if ($needRefresh && !updateOffered) {
      updateOffered = true
      setTimeout(() => toasts.show({ kind: 'status', text: 'An app update is ready.', action: { label: 'Update', run: updateApp } }, 8000), 3200)
    }
  }

  function openSettings() {
    view = 'settings'
    window.scrollTo(0, 0)
  }

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
  <div class="col">
    {#if !standalone}{@render bannerText('install')}{/if}
    <FirstRun {db} {data} />
  </div>
{:else if view === 'settings'}
  <main class="col">
    <Settings
      {db}
      {data}
      {standalone}
      offlineReady={$offlineReady}
      updateReady={$needRefresh}
      onupdate={updateApp}
      onclose={() => (view = 'today')}
    />
  </main>
{:else}
  <main class="col">
    {#if banner}{@render bannerText(banner)}{/if}
    <WeekStrip {db} {data} {hasEntries} />
    <DayView {db} {data} onsettings={openSettings} onfinished={afterFinish} />
  </main>
{/if}

{#snippet bannerText(kind: 'install' | 'offline' | 'backup')}
  <div class="banner" role="note">
    {#if kind === 'install'}
      <span>Not installed yet. Tap Share → Add to Home Screen first, or your logs won’t be kept.</span>
    {:else if kind === 'offline'}
      <span>Not ready offline yet: open once with signal.</span>
    {:else}
      <span>Two cycles since your last backup.</span>
      <button type="button" class="banner-link" onclick={openSettings}>Back up</button>
    {/if}
  </div>
{/snippet}

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
  .banner {
    display: flex;
    align-items: center;
    gap: var(--s3);
    margin-bottom: var(--s3);
    padding: var(--s2) var(--s3);
    border: 1px dashed var(--ink);
    border-radius: var(--radius);
    font-size: var(--fs-caption);
  }
  .banner span {
    flex: 1;
  }
  .banner-link {
    min-height: var(--tap);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
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
