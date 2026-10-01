<script lang="ts">
  // Wireframe 7: one-time "Which day are you on?", reusing the jump logic.
  import { pickStartDay, type LogbookDB } from '../lib/db'
  import { activeDays } from '../lib/logic'
  import type { TodayData } from '../lib/today'
  import { attempt } from '../lib/toast.svelte'

  let { db, data }: { db: LogbookDB; data: TodayData } = $props()

  const days = $derived(activeDays(data.days))
  // svelte-ignore state_referenced_locally
  let chosen = $state(data.pos.cycleDayId)
  const chosenName = $derived(days.find((d) => d.id === chosen)?.name ?? '')
</script>

<main class="first-run">
  <h1>Which day are you on?</h1>
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
    <button type="button" class="btn primary" onclick={() => attempt(() => pickStartDay(db, chosen), 'Couldn’t save your start day.')}>
      Start with {chosenName} →
    </button>
  </div>
</main>

<style>
  .first-run {
    padding: var(--s6) var(--s4) 0;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }
  h1 {
    font-size: var(--fs-day);
    font-weight: 600;
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
    border-bottom: 1px solid var(--line);
  }
  .chosen {
    font-weight: 600;
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
  }
</style>
