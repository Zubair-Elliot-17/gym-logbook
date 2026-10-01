<script lang="ts">
  // Rest day: big chips log an activity in one tap; logged chips go solid and open the edit sheet.
  // "+ something else" for anything off the list. Resting counts: Finish works with nothing logged.
  import {
    deleteActivity,
    logActivity,
    restoreActivity,
    updateActivity,
    type Activity,
    type LogbookDB,
  } from '../lib/db'
  import { restActivities } from '../lib/seed'
  import type { TodayData } from '../lib/today'
  import { attempt, toasts } from '../lib/toast.svelte'
  import ActivitySheet from './ActivitySheet.svelte'

  let { db, data }: { db: LogbookDB; data: TodayData } = $props()

  const logged = $derived([...data.activities].sort((a, b) => (a.loggedAt < b.loggedAt ? -1 : 1)))
  const loggedKinds = $derived(new Set(logged.map((a) => a.kind.toLowerCase())))
  const unlogged = $derived(restActivities.filter((r) => !loggedKinds.has(r.kind.toLowerCase())))

  let sheet = $state<{ mode: 'log' } | { mode: 'edit'; activity: Activity } | null>(null)

  const fail = 'Couldn’t save that activity.'

  function quickLog(kind: string, minutes: number) {
    void attempt(() => logActivity(db, { kind, minutes }), fail)
  }

  async function save(kind: string, minutes: number) {
    const s = sheet
    sheet = null
    if (s?.mode === 'edit') {
      const id = s.activity.id
      await attempt(() => updateActivity(db, id, { kind, minutes }), fail)
    } else {
      await attempt(() => logActivity(db, { kind, minutes }), fail)
    }
  }

  async function remove() {
    const s = sheet
    sheet = null
    if (s?.mode !== 'edit') return
    const row = s.activity
    if (await attempt(() => deleteActivity(db, row.id), 'Couldn’t delete that activity.')) {
      toasts.undo(`${row.kind} deleted`, () => void attempt(() => restoreActivity(db, row), fail))
    }
  }
</script>

<p class="label prompt">What did you do?</p>
<div class="chips">
  {#each logged as a (a.id)}
    <button
      type="button"
      class="chip logged"
      aria-label="{a.kind}, {a.minutes} minutes, logged, tap to edit"
      onclick={() => (sheet = { mode: 'edit', activity: a })}
    >
      {a.kind} · <span class="num">{a.minutes}</span> min ✓
    </button>
  {/each}
  {#each unlogged as r (r.kind)}
    <button type="button" class="chip" aria-label="Log {r.kind}, {r.minutes} minutes" onclick={() => quickLog(r.kind, r.minutes)}>
      {r.kind} · <span class="num">{r.minutes}</span>
    </button>
  {/each}
  <button type="button" class="chip wide" onclick={() => (sheet = { mode: 'log' })}>+ something else</button>
</div>
<p class="caption">Resting counts. The tile still fills in.</p>

{#if sheet?.mode === 'edit'}
  <ActivitySheet
    mode="edit"
    kind={sheet.activity.kind}
    minutes={sheet.activity.minutes}
    onsave={save}
    ondelete={remove}
    onclose={() => (sheet = null)}
  />
{:else if sheet?.mode === 'log'}
  <ActivitySheet mode="log" onsave={save} onclose={() => (sheet = null)} />
{/if}

<style>
  .prompt {
    margin: calc(-1 * var(--s2)) 0 var(--s4);
  }
  .chips {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--s3);
    margin-bottom: var(--s3);
  }
  .chip {
    min-height: 64px;
    border: 1.5px dotted var(--pencil);
    border-radius: var(--radius);
    color: var(--pencil);
    font-size: 17px;
    white-space: nowrap;
  }
  .chip .num {
    font-size: var(--fs-num);
  }
  .chip.logged {
    background: var(--ink);
    border: 0;
    color: var(--paper);
    font-weight: 700;
    box-shadow:
      inset 0 0 0 3px var(--ink),
      inset 0 0 0 4px var(--paper);
    animation: stamp 120ms var(--ease-out);
  }
  @keyframes stamp {
    from {
      transform: scale(0.94);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .chip.logged {
      animation: none;
    }
  }
  .chip.wide {
    grid-column: 1 / -1;
    border-style: dashed;
  }
</style>
