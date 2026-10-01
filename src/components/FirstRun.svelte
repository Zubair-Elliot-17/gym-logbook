<script lang="ts">
  // Wireframe 7: one-time "Which day are you on?", reusing the jump logic.
  import { finishWelcome, pickStartDay, type LogbookDB } from '../lib/db'
  import { activeDays } from '../lib/logic'
  import type { TodayData } from '../lib/today'
  import { attempt } from '../lib/toast.svelte'

  let { db, data, onback }: { db: LogbookDB; data: TodayData; onback?: () => void } = $props()

  async function start() {
    await attempt(async () => {
      await pickStartDay(db, chosen)
      await finishWelcome(db)
    }, 'Couldn’t save your start day.')
  }

  const days = $derived(activeDays(data.days))
  // svelte-ignore state_referenced_locally
  let chosen = $state(data.pos.cycleDayId)
  const chosenName = $derived(days.find((d) => d.id === chosen)?.name ?? '')
</script>

<main class="first-run">
  {#if onback}<button type="button" class="link back" onclick={onback}>‹ Back</button>{/if}
  <h1 class="display">Which day are you on?</h1>
  <p class="caption">Pick today. The app follows your cycle from here.</p>
  <ul role="radiogroup" aria-label="Cycle day">
    {#each days as d (d.id)}
      <li>
        <button type="button" role="radio" aria-checked={chosen === d.id} class:chosen={chosen === d.id} onclick={() => (chosen = d.id)}>
          <span>{d.name}</span>
          <span aria-hidden="true">{chosen === d.id ? '✓' : '›'}</span>
        </button>
      </li>
    {/each}
  </ul>
  <div class="bar">
    <button type="button" class="btn primary" onclick={start}>
      Start with {chosenName} →
    </button>
  </div>
</main>

<style>
  .back {
    align-self: flex-start;
  }
  .first-run {
    padding: var(--s5) 0 0;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }
  h1 {
    font-size: var(--fs-day);
  }
  ul {
    list-style: none;
    padding: 0;
    margin: var(--s4) 0;
    flex: 1;
  }
  li button {
    width: 100%;
    min-height: var(--tap);
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--rule);
  }
  .chosen {
    font-weight: 700;
  }
  .bar {
    position: sticky;
    bottom: 0;
    padding: var(--s3) 0 calc(var(--s3) + env(safe-area-inset-bottom));
    background: var(--paper);
  }
  .bar .btn {
    width: 100%;
    min-height: 52px;
    width: 100%;
  }
</style>
