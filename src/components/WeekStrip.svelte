<script lang="ts">
  // Week strip (9A, 15A) with the inline "Make <day> today?" confirm and its two refusals (E2).
  import { jumpTo } from '../lib/db'
  import type { LogbookDB } from '../lib/db'
  import { checkJump, tileStates, type TileStatus } from '../lib/logic'
  import { shortName, type TodayData } from '../lib/today'
  import { attempt } from '../lib/toast.svelte'

  let { db, data, hasEntries }: { db: LogbookDB; data: TodayData; hasEntries: boolean } = $props()

  const tiles = $derived(tileStates(data.pos, data.days, data.dayLogs))
  let note = $state<{ kind: 'confirm' | 'refused'; targetId: string; text: string } | null>(null)

  const spoken: Record<TileStatus, string> = {
    done: 'done',
    skipped: 'skipped',
    current: 'today',
    passed: 'passed',
    upcoming: 'upcoming',
  }

  function tap(targetId: string) {
    const target = data.days.find((d) => d.id === targetId)!
    const result = checkJump(data.pos, targetId, data.days, data.dayLogs, hasEntries)
    if (result === 'same-day' || result === 'unknown-day') note = null
    else if (result === 'already-done')
      note = { kind: 'refused', targetId, text: `${target.name} is already done this cycle. Use Go back a day in Settings to fix it.` }
    else if (result === 'current-has-entries')
      note = { kind: 'refused', targetId, text: `Finish ${data.day.name} first. You’ve logged something today.` }
    else note = { kind: 'confirm', targetId, text: `Make ${target.name} today?` }
  }

  async function confirm() {
    if (!note) return
    const id = note.targetId
    note = null
    await attempt(() => jumpTo(db, id), 'Couldn’t switch days.')
  }
</script>

<nav aria-label="Week">
  <ol class="strip">
    {#each tiles as t (t.day.id)}
      <li>
        <button
          type="button"
          class="tile {t.status}"
          aria-label="{t.day.name}, {spoken[t.status]}"
          aria-current={t.status === 'current' ? 'date' : undefined}
          onclick={() => tap(t.day.id)}
        >
          {shortName(t.day.name)}
        </button>
      </li>
    {/each}
  </ol>
</nav>

{#if note}
  <div class="note" class:confirm={note.kind === 'confirm'} role="status">
    <p><strong>{note.text}</strong></p>
    {#if note.kind === 'confirm'}
      <p class="caption">{data.day.name} stays unfinished.</p>
      <div class="actions">
        <button type="button" class="btn primary" onclick={confirm}>Switch</button>
        <button type="button" class="btn" onclick={() => (note = null)}>Cancel</button>
      </div>
    {:else}
      <button type="button" class="link" onclick={() => (note = null)}>OK</button>
    {/if}
  </div>
{/if}

<style>
  .strip {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
    gap: var(--s1);
  }
  .tile {
    width: 100%;
    min-height: var(--tap);
    border-radius: 8px;
    font-size: var(--fs-caption);
    border: 1px solid var(--line);
    padding: 0 2px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .tile.done {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--paper);
  }
  .tile.skipped {
    background: repeating-linear-gradient(-45deg, var(--line) 0 2px, var(--paper) 2px 7px);
    border-color: var(--line);
  }
  .tile.current {
    border: 2px solid var(--ink);
    font-weight: 600;
  }
  .tile.passed {
    border: 1px dotted var(--line);
    color: var(--muted);
  }
  .note {
    margin-top: var(--s3);
    padding: var(--s3);
    border: 1px dashed var(--line);
    border-radius: var(--radius);
    display: grid;
    gap: var(--s2);
  }
  .note.confirm {
    border: 2px solid var(--ink);
  }
  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--s2);
  }
</style>
