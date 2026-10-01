<script lang="ts">
  // One exercise: "Last time ›", ghost sets (tap = log, hold 450 ms = editor), −/+ for the next ghost,
  // "+ set". Collapses to one line once every set is logged (2A).
  import { formatWeight, type Ghost } from '../lib/logic'
  import type { LiftRow } from '../lib/today'

  let {
    row,
    expanded,
    onlog,
    onedit,
    onadjust,
    onextra,
    ontoggle,
  }: {
    row: LiftRow
    expanded: boolean
    onlog: (g: Ghost) => void
    /** Open the editor for this ghost (unlogged: log sheet; logged: edit sheet; null: first set). */
    onedit: (g: Ghost | null) => void
    onadjust: (dir: 1 | -1) => void
    onextra: () => void
    ontoggle: () => void
  } = $props()

  const HOLD_MS = 450
  const MOVE_PX = 10
  let pressing = $state<number | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined
  let start = { x: 0, y: 0 }
  let held = false

  const next = $derived(row.ghosts.find((g) => g.next) ?? null)
  const loggedCount = $derived(row.ghosts.filter((g) => g.logged).length)
  const collapsed = $derived(row.done && !expanded)

  function cancel() {
    clearTimeout(timer)
    timer = undefined
    pressing = null
  }

  function down(e: PointerEvent, g: Ghost) {
    if (g.logged || e.button !== 0) return
    held = false
    start = { x: e.clientX, y: e.clientY }
    pressing = g.setIndex
    timer = setTimeout(() => {
      held = true
      pressing = null
      timer = undefined
      onedit(g)
    }, HOLD_MS)
  }

  function move(e: PointerEvent) {
    if (timer && Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_PX) cancel()
  }

  function click(g: Ghost) {
    cancel()
    if (held) {
      // A completed long-press already opened the editor; ignore its release.
      held = false
      return
    }
    if (g.logged || g.weightKg === null) onedit(g)
    else onlog(g)
  }

  function text(g: Ghost) {
    return `${g.weightKg === null ? '—' : formatWeight(g.weightKg)} × ${g.reps}`
  }

  function label(g: Ghost) {
    const w = g.weightKg === null ? 'weight not set' : g.weightKg === 0 ? 'bodyweight' : `${formatWeight(g.weightKg)} kilos`
    const isPR = g.logged && row.prIds.has(g.logged.id)
    const state = isPR ? 'PR' : g.logged ? 'logged' : g.next ? 'next' : 'ghost'
    const action = g.logged ? 'tap to edit' : g.weightKg === null ? 'tap to enter weight' : 'tap to log, hold to edit'
    return `${row.exercise.name}, set ${g.setIndex + 1}, ${w} by ${g.reps}, ${state}, ${action}`
  }
</script>

<section class="row" class:collapsed id="row-{row.exercise.id}" aria-label={row.exercise.name}>
  {#if collapsed}
    <button type="button" class="summary" onclick={ontoggle} aria-expanded="false">
      <span class="name">{row.exercise.name}</span>
      <span class="done-mark num">✓ {loggedCount}</span>
      {#if row.prIds.size}<span class="pr">PR</span>{/if}
    </button>
  {:else}
    <div class="head">
      <h3 class="name">{row.exercise.name}</h3>
      {#if row.done}
        <button type="button" class="link" onclick={ontoggle} aria-expanded="true">Collapse</button>
      {/if}
    </div>

    {#if row.lastText}
      <button type="button" class="last caption" onclick={() => onedit(next)}>
        Last time: <span class="num">{row.lastText}</span> ›
      </button>
    {:else if row.plan && row.plan.seedWeightKg === null && !loggedCount}
      <p class="last caption">First time: tap a set to enter your weight</p>
    {/if}

    {#if row.needsEditor}
      <button type="button" class="ghost first" onclick={() => onedit(null)}>Log first set</button>
    {:else}
      <div class="sets">
        {#each row.ghosts as g (g.setIndex)}
          <button
            type="button"
            class="ghost num"
            class:next={g.next}
            class:logged={g.logged}
            class:pressing={pressing === g.setIndex}
            aria-label={label(g)}
            onpointerdown={(e) => down(e, g)}
            onpointermove={move}
            onpointerleave={cancel}
            onpointercancel={cancel}
            oncontextmenu={(e) => e.preventDefault()}
            onclick={() => click(g)}
          >
            <span>{text(g)}</span>
            {#if g.logged}<span class="check" aria-hidden="true">✓</span>{/if}
            {#if g.logged && row.prIds.has(g.logged.id)}<span class="pr badge">PR</span>{/if}
          </button>
        {/each}
      </div>
    {/if}

    <div class="controls">
      <button type="button" class="link" onclick={onextra}>+ set</button>
      {#if next}
        <div class="adjust">
          <button type="button" class="btn" aria-label="Lower next set by {row.exercise.stepKg} kilos" onclick={() => onadjust(-1)}>−</button>
          <button type="button" class="btn" aria-label="Raise next set by {row.exercise.stepKg} kilos" onclick={() => onadjust(1)}>+</button>
        </div>
      {/if}
    </div>
  {/if}
</section>

<style>
  .row {
    padding: var(--s4) 0;
    border-top: 1px dashed var(--line);
    scroll-margin-top: var(--s2);
  }
  .row.collapsed {
    padding: 0;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .name {
    font-size: 17px;
    font-weight: 600;
  }
  .summary {
    width: 100%;
    min-height: var(--tap);
    display: flex;
    align-items: center;
    gap: var(--s3);
    text-align: left;
  }
  .summary .name {
    flex: 1;
  }
  .done-mark {
    font-size: 18px;
  }
  .last {
    display: block;
    min-height: var(--tap);
    text-align: left;
    margin-top: -6px;
    text-decoration: underline;
    text-decoration-color: var(--line);
    text-underline-offset: 3px;
  }
  p.last {
    text-decoration: none;
    display: flex;
    align-items: center;
  }
  .last .num {
    font-size: 15px;
    color: var(--ink);
  }
  .sets {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--s2);
  }
  .ghost {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    min-height: var(--set-h);
    border: 1px dashed var(--line);
    border-radius: var(--radius);
    color: var(--muted);
    font-size: var(--fs-num);
    -webkit-touch-callout: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .ghost.first {
    width: 100%;
    font-family: var(--font-ui);
    font-size: var(--fs-body);
    font-weight: 600;
    color: var(--ink);
  }
  .ghost.next {
    background: var(--next);
    border: 2px solid var(--ink);
    color: var(--ink);
  }
  .ghost.logged {
    background: var(--ink);
    border: 2px solid var(--ink);
    color: var(--paper);
  }
  .check {
    font-family: var(--font-ui);
    font-size: 13px;
    margin-left: 4px;
  }
  /* 11A: hold fill, left to right over 450 ms */
  .ghost.pressing::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background: color-mix(in srgb, var(--ink) 18%, var(--next));
    transform-origin: left;
    animation: fill 450ms linear forwards;
  }
  @keyframes fill {
    from {
      transform: scaleX(0);
    }
    to {
      transform: scaleX(1);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ghost.pressing::before {
      transform: none;
      opacity: 0;
      animation: appear 0s linear 200ms forwards;
    }
    @keyframes appear {
      to {
        opacity: 1;
      }
    }
  }
  .pr {
    font-family: var(--font-ui);
    font-size: var(--fs-badge);
    font-weight: 600;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 4px;
    padding: 0 4px;
    background: var(--paper);
  }
  .badge {
    position: absolute;
    top: 3px;
    right: 3px;
    line-height: 1.3;
  }
  .controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--s2);
  }
  .adjust {
    display: flex;
    gap: var(--s2);
  }
  .adjust .btn {
    width: 56px;
    font-size: 20px;
  }
</style>
