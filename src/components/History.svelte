<script lang="ts">
  // History: finished days newest first, grouped by month. Tap a day for its sets.
  // Owns its own liveQuery and a small back stack, so App only knows "history".
  import { liveQuery } from 'dexie'
  import { onMount, tick } from 'svelte'
  import type { LogbookDB } from '../lib/db'
  import { byMonth, formatDate, loadHistory, sessionSummary, sessions, type HistoryData } from '../lib/history'
  import SessionView from './SessionView.svelte'

  let { db, onclose }: { db: LogbookDB; onclose: () => void } = $props()

  let data = $state.raw<HistoryData | null>(null)
  onMount(() => {
    const sub = liveQuery(() => loadHistory(db)).subscribe({
      next: (v) => (data = v),
      error: (e) => console.error(e),
    })
    return () => sub.unsubscribe()
  })

  const list = $derived(data ? sessions(data) : [])
  const months = $derived(byMonth(list))
  const lifted = $derived(list.filter((s) => s.setCount > 0).length)

  type Frame = { kind: 'session'; key: string }
  let stack = $state<Frame[]>([])
  const top = $derived(stack.at(-1))
  /** Scroll position of each screen below the top, restored on back. */
  const scrolls: number[] = []

  function push(f: Frame) {
    scrolls.push(window.scrollY)
    stack.push(f)
    window.scrollTo(0, 0)
  }

  function back() {
    if (stack.length === 0) return onclose()
    stack.pop()
    const y = scrolls.pop() ?? 0
    void tick().then(() => window.scrollTo(0, y))
  }

  const session = $derived(top?.kind === 'session' ? list.find((s) => s.key === top.key) : undefined)

  // The day left history (Go back a day undid its Finish): drop back to the list.
  $effect(() => {
    if (data && top?.kind === 'session' && !session) back()
  })
</script>

{#if top?.kind === 'session' && session && data}
  <SessionView {db} {session} onback={back} />
{:else}
  <header class="head">
    <button type="button" class="link" onclick={onclose}>‹ Today</button>
    <h1 class="display">History</h1>
    <p class="label">
      {list.length}
      {list.length === 1 ? 'day' : 'days'} · {lifted} lifting
    </p>
  </header>

  {#if data && list.length === 0}
    <div class="empty">
      <p><strong>Nothing here yet.</strong></p>
      <p class="caption">Each day you finish lands here, with every set you logged.</p>
    </div>
  {/if}

  {#each months as m (m.month)}
    <h2 class="label month">{m.month}</h2>
    <ul class="list">
      {#each m.sessions as s (s.key)}
        <li>
          <button type="button" class="row" onclick={() => push({ kind: 'session', key: s.key })}>
            <span class="line">
              <span class="name">{s.dayName}</span>
              <span class="label">{formatDate(s.date)} ›</span>
            </span>
            <span class="line">
              <span class="summary" class:skipped={s.skipped}>{sessionSummary(s)}</span>
              {#if s.prIds.size}<span class="pr" aria-hidden="true">▲ PR</span>{/if}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/each}
  <div class="end"></div>
{/if}

<style>
  .head {
    margin: var(--s2) 0 var(--s4);
  }
  h1 {
    font-size: var(--fs-day);
    margin-top: var(--s2);
  }
  .head .label {
    margin-top: var(--s2);
  }
  .empty {
    border: 1.5px dotted var(--pencil);
    border-radius: var(--radius);
    padding: var(--s4);
    display: grid;
    gap: var(--s1);
  }
  .month {
    margin: var(--s4) 0 var(--s1);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .row {
    width: 100%;
    min-height: 68px;
    display: grid;
    align-content: center;
    gap: 4px;
    padding: var(--s2) 0;
    border-top: 1px solid var(--rule);
    text-align: left;
  }
  li:last-child .row {
    border-bottom: 1px solid var(--rule);
  }
  .line {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--s3);
  }
  .name {
    font-weight: 700;
    font-size: 17px;
  }
  .line .label {
    white-space: nowrap;
  }
  .summary {
    font-family: var(--font-num);
    font-weight: 600;
    font-stretch: 87.5%;
    font-size: var(--fs-caption);
    color: var(--pencil);
  }
  .skipped {
    font-style: italic;
  }
  .pr {
    font-family: var(--font-display);
    font-size: var(--fs-badge);
    font-weight: 800;
    font-stretch: 75%;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--stamp);
    border: 2px solid var(--stamp);
    border-radius: 3px;
    padding: 1px 5px;
    transform: rotate(-6deg);
    white-space: nowrap;
  }
  .end {
    height: var(--s6);
  }
</style>
