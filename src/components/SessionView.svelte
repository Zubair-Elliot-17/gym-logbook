<script lang="ts">
  // One finished day: every exercise with its sets as inked stamps (PRs stamped red), or the day's
  // activities. Tap a set to fix a typo or delete it; history is the user's own record.
  import { deleteSet, restoreSet, updateSet, type LogbookDB, type SetRow } from '../lib/db'
  import { formatDate, formatVolume, sessionSummary, type Session } from '../lib/history'
  import { spokenUnit } from '../lib/units'
  import { units } from '../lib/units.svelte'
  import { formatWeight } from '../lib/logic'
  import type { Exercise } from '../lib/seed'
  import { attempt, toasts } from '../lib/toast.svelte'
  import SetSheet from './SetSheet.svelte'

  let {
    db,
    session,
    backLabel = '‹ History',
    onback,
    onexercise,
  }: {
    db: LogbookDB
    session: Session
    backLabel?: string
    onback: () => void
    /** Open an exercise's progress. */
    onexercise?: (exerciseId: string) => void
  } = $props()

  let editing = $state<{ exercise: Exercise; set: SetRow; n: number } | null>(null)

  async function save(weightKg: number, reps: number) {
    const e = editing
    editing = null
    if (e) await attempt(() => updateSet(db, e.set.id, { weightKg, reps }))
  }

  async function remove() {
    const e = editing
    editing = null
    if (!e) return
    if (await attempt(() => deleteSet(db, e.set.id), 'Couldn’t delete that set.')) {
      toasts.undo('Set deleted', () => void attempt(() => restoreSet(db, e.set)))
    }
  }

  function label(ex: Exercise, s: SetRow, n: number) {
    const w = s.weightKg === 0 ? 'bodyweight' : `${formatWeight(s.weightKg, units.current)} ${spokenUnit(units.current)}`
    return `${ex.name}, set ${n}, ${w} by ${s.reps}${session.prIds.has(s.id) ? ', PR' : ''}, tap to edit`
  }
</script>

<header class="head">
  <button type="button" class="link" onclick={onback}>{backLabel}</button>
  <h1 class="display">{session.dayName}</h1>
  <p class="label">{formatDate(session.date)} · cycle #{session.cycleNumber}</p>
  <p class="label">{sessionSummary(session, units.current)}</p>
</header>

{#if session.skipped}
  <div class="empty"><p>Skipped: finished with nothing logged.</p></div>
{/if}

{#each session.exercises as e (e.exercise.id)}
  {@const vol = e.sets.reduce((v, s) => v + s.weightKg * s.reps, 0)}
  <section class="ex" aria-label={e.exercise.name}>
    <div class="ex-head">
      {#if onexercise}
        <button type="button" class="name link-name" onclick={() => onexercise(e.exercise.id)}>{e.exercise.name} ›</button>
      {:else}
        <h2 class="name">{e.exercise.name}</h2>
      {/if}
      {#if vol > 0}<span class="label">{formatVolume(vol, units.current)}</span>{/if}
    </div>
    <div class="sets">
      {#each e.sets as s, i (s.id)}
        <button
          type="button"
          class="set num"
          aria-label={label(e.exercise, s, i + 1)}
          onclick={() => (editing = { exercise: e.exercise, set: s, n: i + 1 })}
        >
          <span>{formatWeight(s.weightKg, units.current)} × {s.reps}</span>
          {#if session.prIds.has(s.id)}<span class="pr" aria-hidden="true">▲ PR</span>{/if}
        </button>
      {/each}
    </div>
  </section>
{/each}

{#if session.activities.length}
  <ul class="acts">
    {#each session.activities as a (a.id)}
      <li><span>{a.kind}</span><span class="num">{a.minutes} min</span></li>
    {/each}
  </ul>
{/if}

<div class="end"></div>

{#if editing}
  <SetSheet
    exerciseName={editing.exercise.name}
    setNumber={editing.n}
    stepKg={editing.exercise.stepKg}
    weightKg={editing.set.weightKg}
    reps={editing.set.reps}
    mode="edit"
    onlog={save}
    ondelete={remove}
    onclose={() => (editing = null)}
  />
{/if}

<style>
  .head {
    margin: var(--s2) 0 var(--s4);
    display: grid;
    gap: var(--s2);
  }
  h1 {
    font-size: var(--fs-day);
    line-height: 1.15;
  }
  .empty {
    border: 1.5px dotted var(--pencil);
    border-radius: var(--radius);
    padding: var(--s4);
  }
  .ex {
    padding: var(--s4) 0 var(--s3);
    border-top: 1px solid var(--rule);
  }
  .ex-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--s3);
    margin-bottom: var(--s2);
  }
  .name {
    font-size: 17px;
    font-weight: 700;
    text-align: left;
  }
  .link-name {
    min-height: var(--tap);
    text-decoration: underline;
    text-decoration-color: var(--pencil);
    text-underline-offset: 3px;
  }
  .sets {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--s2);
  }
  /* A logged set, as on Today: an inked stamp */
  .set {
    position: relative;
    min-height: var(--set-h);
    border-radius: var(--radius);
    background: var(--ink);
    color: var(--paper);
    box-shadow:
      inset 0 0 0 3px var(--ink),
      inset 0 0 0 4px var(--paper);
    font-size: var(--fs-num);
    white-space: nowrap;
  }
  .pr {
    position: absolute;
    top: -9px;
    right: -6px;
    font-family: var(--font-display);
    font-size: var(--fs-badge);
    font-weight: 800;
    font-stretch: 75%;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    line-height: 1.3;
    color: var(--stamp);
    background: var(--paper);
    border: 2px solid var(--stamp);
    border-radius: 3px;
    padding: 1px 5px;
    transform: rotate(-6deg);
  }
  .acts {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .acts li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 52px;
    border-top: 1px solid var(--rule);
    font-weight: 700;
  }
  .acts li:last-child {
    border-bottom: 1px solid var(--rule);
  }
  .end {
    height: var(--s6);
  }
</style>
