<script lang="ts">
  // One exercise: "Last time ›", ghost sets (tap = log, hold 450 ms = editor), −/+ for the next ghost,
  // "+ set". Collapses to one line once every set is logged (2A).
  import { equipmentOf } from '../lib/catalog'
  import { formatWeight, type Ghost } from '../lib/logic'
  import { formatPlates, plateLoad } from '../lib/plates'
  import { barAndPlates, spokenUnit, stepIn, toUnit } from '../lib/units'
  import { units } from '../lib/units.svelte'
  import type { LiftRow } from '../lib/today'

  let {
    row,
    expanded,
    onlog,
    onedit,
    onadjust,
    onextra,
    ontoggle,
    onprogress,
  }: {
    row: LiftRow
    expanded: boolean
    onlog: (g: Ghost) => void
    /** Open the editor for this ghost (unlogged: log sheet; logged: edit sheet; null: first set). */
    onedit: (g: Ghost | null) => void
    onadjust: (dir: 1 | -1) => void
    onextra: () => void
    ontoggle: () => void
    /** Open this exercise's progress (only once it has history). */
    onprogress?: () => void
  } = $props()

  const hasHistory = $derived(row.lastText !== '' || row.ghosts.some((g) => g.logged))

  const HOLD_MS = 450
  const MOVE_PX = 10
  let pressing = $state<number | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined
  let start = { x: 0, y: 0 }
  let held = false

  const next = $derived(row.ghosts.find((g) => g.next) ?? null)
  const loggedCount = $derived(row.ghosts.filter((g) => g.logged).length)
  const collapsed = $derived(row.done && !expanded)
  /** Barbell lifts: what to load for the next set. */
  const plates = $derived.by(() => {
    if (equipmentOf(row.exercise) !== 'barbell' || next?.weightKg == null) return null
    const { bar, plates } = barAndPlates(units.current)
    const load = plateLoad(toUnit(next.weightKg, units.current), bar, plates)
    return load && formatPlates(load, units.current)
  })

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
    return `${g.weightKg === null ? '—' : formatWeight(g.weightKg, units.current)} × ${g.reps}`
  }

  function label(g: Ghost) {
    const w =
      g.weightKg === null ? 'weight not set' : g.weightKg === 0 ? 'bodyweight' : `${formatWeight(g.weightKg, units.current)} ${spokenUnit(units.current)}`
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
      {#if row.prIds.size}<span class="pr">▲ PR</span>{/if}
    </button>
  {:else}
    <div class="head">
      <h3 class="name">
        {#if onprogress && hasHistory}
          <button type="button" class="progress" aria-label="{row.exercise.name} progress" onclick={onprogress}
            >{row.exercise.name}<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"
              ><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M2 12l4-4 3 3 5-6"
              /></svg
            ></button
          >
        {:else}
          {row.exercise.name}
        {/if}
      </h3>
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
            {#if g.logged && row.prIds.has(g.logged.id)}<span class="pr badge" aria-hidden="true">▲ PR</span>{/if}
          </button>
        {/each}
      </div>
    {/if}

    {#if plates}
      <p class="plates caption">Load: <span class="num">{plates}</span></p>
    {/if}

    <div class="controls">
      <button type="button" class="link" onclick={onextra}>+ set</button>
      {#if next}
        <div class="adjust">
          <button type="button" class="btn" aria-label="Lower next set by {stepIn(row.exercise.stepKg, units.current)} {spokenUnit(units.current)}" onclick={() => onadjust(-1)}>−</button>
          <button type="button" class="btn" aria-label="Raise next set by {stepIn(row.exercise.stepKg, units.current)} {spokenUnit(units.current)}" onclick={() => onadjust(1)}>+</button>
        </div>
      {/if}
    </div>
  {/if}
</section>

<style>
  .row {
    padding: var(--s4) 0 var(--s3);
    border-top: 1px solid var(--rule);
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
    font-weight: 700;
  }
  .progress {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    font-weight: inherit;
    text-align: left;
  }
  .progress svg {
    flex: none;
    color: var(--pencil);
  }
  .summary {
    width: 100%;
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: var(--s3);
    text-align: left;
  }
  .summary .name {
    flex: 1;
  }
  .done-mark {
    font-size: 16px;
  }
  .last {
    display: flex;
    align-items: center;
    gap: 5px;
    min-height: 40px;
    text-align: left;
  }
  .last .num {
    font-size: var(--fs-caption);
    color: var(--ink);
  }
  p.last {
    min-height: 40px;
  }
  .sets {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--s2);
  }
  /* Ghost: a dotted pencil outline of last time's set */
  .ghost {
    position: relative;
    isolation: isolate;
    min-height: var(--set-h);
    border: 1.5px dotted var(--pencil);
    border-radius: var(--radius);
    color: var(--pencil);
    font-size: var(--fs-num);
    white-space: nowrap;
    -webkit-touch-callout: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .ghost.first {
    width: 100%;
    font-family: var(--font-body);
    font-size: var(--fs-body);
    font-weight: 700;
    color: var(--ink);
  }
  /* Next: ruled in, ready to log */
  .ghost.next {
    background: var(--sheet);
    border: 2px solid var(--ink);
    color: var(--ink);
  }
  /* Logged: an inked stamp (double ring) */
  .ghost.logged {
    background: var(--ink);
    border: 0;
    color: var(--paper);
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
  /* 11A: hold fill, left to right over 450 ms */
  .ghost.pressing::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: inherit;
    background: var(--next);
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
    .ghost.logged {
      animation: none;
    }
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
  /* PR: a red surveyor's benchmark stamp */
  .pr {
    font-family: var(--font-display);
    font-size: var(--fs-badge);
    font-weight: 800;
    font-stretch: 75%;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--stamp);
    background: var(--paper);
    border: 2px solid var(--stamp);
    border-radius: 3px;
    padding: 1px 5px;
    transform: rotate(-4deg);
    white-space: nowrap;
  }
  .badge {
    position: absolute;
    top: -9px;
    right: -6px;
    transform: rotate(-6deg);
    line-height: 1.3;
  }
  .plates {
    margin-top: var(--s2);
  }
  .plates .num {
    color: var(--ink);
    font-size: var(--fs-caption);
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
    font-family: var(--font-num);
    font-size: 20px;
  }
</style>
