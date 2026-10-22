<script lang="ts">
  // First open: Welcome → set up your exercises (per lifting day) → pick today. Shown once.
  import { liveQuery } from 'dexie'
  import { onMount } from 'svelte'
  import type { LogbookDB } from '../lib/db'
  import { activeDays } from '../lib/logic'
  import type { TodayData } from '../lib/today'
  import FirstRun from './FirstRun.svelte'
  import PlanEditor from './PlanEditor.svelte'

  let { db, data, standalone }: { db: LogbookDB; data: TodayData; standalone: boolean } = $props()

  let step = $state<'welcome' | 'setup' | 'today'>('welcome')
  let editing = $state<string | null>(null)
  let counts = $state.raw<Record<string, number>>({})

  const liftDays = $derived(activeDays(data.days).filter((d) => d.type === 'lift'))
  const total = $derived(Object.values(counts).reduce((a, b) => a + b, 0))

  onMount(() => {
    const sub = liveQuery(() => db.dayExercises.toArray()).subscribe({
      next: (rows) => {
        const c: Record<string, number> = {}
        for (const r of rows) c[r.cycleDayId] = (c[r.cycleDayId] ?? 0) + 1
        counts = c
      },
    })
    return () => sub.unsubscribe()
  })

  function go(next: typeof step) {
    step = next
    window.scrollTo(0, 0)
  }

  const nextDay = (id: string) => liftDays[liftDays.findIndex((d) => d.id === id) + 1]
</script>

{#if step === 'welcome'}
  <main class="screen">
    <p class="label">Gym Logbook</p>
    <h1 class="display">Welcome</h1>
    <p class="lede">Your training log, in your pocket. Here’s how it works:</p>
    <ol class="how">
      <li>
        <span class="n num">1</span>
        <span><strong>Your week, in order.</strong> {activeDays(data.days).map((d) => d.name).join(', ')}. Finish a day and the next one comes up. You can change these in Settings.</span>
      </li>
      <li>
        <span class="n num">2</span>
        <span><strong>Your exercises.</strong> Pick them for each lifting day from the list, or type your own, with your sets, weight and reps.</span>
      </li>
      <li>
        <span class="n num">3</span>
        <span><strong>Tap to log.</strong> Last time’s sets are waiting for you. One tap logs a set that matches; hold it to change the numbers.</span>
      </li>
    </ol>
    <p class="caption">Works without signal. Everything stays on this phone.</p>
    {#if !standalone}
      <p class="tip">Tip: add it to your Home Screen first (Safari → Share → Add to Home Screen), so your log is kept.</p>
    {/if}
    <div class="grow"></div>
    <div class="bar"><button type="button" class="btn solid wide" onclick={() => go('setup')}>Get started →</button></div>
  </main>
{:else if step === 'setup' && editing}
  {@const day = liftDays.find((d) => d.id === editing)!}
  {@const after = nextDay(day.id)}
  <main class="screen">
    <PlanEditor {db} dayId={day.id} dayName={day.name} backLabel="‹ All days" onback={() => (editing = null)}>
      {#snippet footer()}
        {#if after}
          <button type="button" class="btn solid wide" onclick={() => { editing = after.id; window.scrollTo(0, 0) }}>Next: {after.name} →</button>
        {:else}
          <button type="button" class="btn solid wide" onclick={() => (editing = null)}>Done →</button>
        {/if}
      {/snippet}
    </PlanEditor>
  </main>
{:else if step === 'setup'}
  <main class="screen">
    <button type="button" class="link" onclick={() => go('welcome')}>‹ Back</button>
    <h1 class="display">Your exercises</h1>
    <p class="lede">Pick what you do on each lifting day. Rest days don’t need any. You can change this anytime.</p>
    <ul class="days">
      {#each liftDays as d (d.id)}
        {@const n = counts[d.id] ?? 0}
        <li>
          <button type="button" class="day" onclick={() => { editing = d.id; window.scrollTo(0, 0) }}>
            <span class="day-name display">{d.name}</span>
            <span class="label">{n === 0 ? 'Not set up' : `${n} exercise${n === 1 ? '' : 's'}`}</span>
            <span class="go" aria-hidden="true">{n === 0 ? 'Set up ›' : 'Edit ›'}</span>
          </button>
        </li>
      {/each}
    </ul>
    <div class="grow"></div>
    <div class="bar">
      <button type="button" class="btn wide" class:solid={total > 0} onclick={() => go('today')}>
        {total > 0 ? 'Continue →' : 'Skip for now →'}
      </button>
    </div>
  </main>
{:else}
  <FirstRun {db} {data} onback={() => go('setup')} />
{/if}

<style>
  .screen {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    padding-top: var(--s5);
  }
  h1 {
    font-size: 64px;
    margin: var(--s2) 0 var(--s3);
  }
  .lede {
    font-size: 18px;
    margin-bottom: var(--s4);
  }
  .how {
    list-style: none;
    padding: 0;
    margin: 0 0 var(--s4);
    display: grid;
    gap: var(--s4);
  }
  .how li {
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: var(--s3);
    align-items: start;
  }
  .n {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    background: var(--ink);
    color: var(--paper);
    border-radius: var(--radius);
    font-size: 18px;
  }
  .tip {
    margin-top: var(--s3);
    padding: var(--s3);
    border: 1.5px dashed var(--ink);
    border-radius: var(--radius);
    background: var(--sheet);
    font-size: var(--fs-caption);
  }
  .days {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .day {
    width: 100%;
    min-height: 72px;
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    align-content: center;
    column-gap: var(--s3);
    border-top: 1px solid var(--rule);
    text-align: left;
  }
  .days li:last-child .day {
    border-bottom: 1px solid var(--rule);
  }
  .day-name {
    font-size: 28px;
  }
  .go {
    grid-row: 1 / 3;
    grid-column: 2;
    align-self: center;
    font-weight: 700;
  }
  .grow {
    flex: 1;
    min-height: var(--s5);
  }
  .bar {
    position: sticky;
    bottom: 0;
    margin: 0 calc(-1 * var(--s4));
    padding: var(--s2) var(--s4) calc(var(--s2) + env(safe-area-inset-bottom));
    background: var(--paper);
    border-top: 1px solid var(--rule);
  }
  .wide {
    width: 100%;
    min-height: 52px;
  }
</style>
