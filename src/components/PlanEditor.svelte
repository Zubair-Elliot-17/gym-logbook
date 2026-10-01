<script lang="ts">
  // "Your exercises" for one lifting day: add from the table or type your own, set sets / starting
  // weight / reps, reorder, remove. Removing never deletes logged history.
  import { liveQuery } from 'dexie'
  import { onMount, type Snippet } from 'svelte'
  import {
    addToPlan,
    createExercise,
    dayPlan,
    ensureCatalogExercise,
    movePlanRow,
    removeFromPlan,
    restorePlanRow,
    updatePlanRow,
    type LogbookDB,
    type PlanValues,
  } from '../lib/db'
  import { formatWeight } from '../lib/logic'
  import type { DayExercise, Equipment, Exercise } from '../lib/seed'
  import { attempt, toasts } from '../lib/toast.svelte'
  import ExercisePicker from './ExercisePicker.svelte'
  import PlanRowSheet from './PlanRowSheet.svelte'

  let {
    db,
    dayId,
    dayName,
    backLabel = '‹ Back',
    onback,
    footer,
  }: {
    db: LogbookDB
    dayId: string
    dayName: string
    backLabel?: string
    onback: () => void
    /** Replaces the default Done button (onboarding uses "Next day"). */
    footer?: Snippet
  } = $props()

  let plan = $state.raw<DayExercise[]>([])
  let exercises = $state.raw<Exercise[]>([])
  let picking = $state(false)
  let editing = $state<DayExercise | null>(null)

  onMount(() => {
    // svelte-ignore state_referenced_locally
    const sub = liveQuery(async () => ({ plan: await dayPlan(db, dayId), exercises: await db.exercises.toArray() })).subscribe({
      next: (v) => {
        plan = v.plan
        exercises = v.exercises
      },
    })
    return () => sub.unsubscribe()
  })

  const byId = $derived(new Map(exercises.map((e) => [e.id, e])))
  const added = $derived(new Set(plan.map((p) => p.exerciseId)))
  const fail = 'Couldn’t save that change.'

  function summary(p: DayExercise) {
    const w = p.seedWeightKg === null ? 'weight on first set' : `${formatWeight(p.seedWeightKg)}${p.seedWeightKg === 0 ? '' : ' kg'}`
    return `${p.plannedSets} × ${p.seedReps} · ${w}`
  }

  function pick(p: { entry?: import('../lib/catalog').CatalogEntry; exercise?: Exercise }) {
    void attempt(async () => {
      const ex = p.exercise ?? (await ensureCatalogExercise(db, p.entry!))
      await addToPlan(db, dayId, ex.id)
    }, fail)
  }

  function create(name: string, equipment: Equipment) {
    void attempt(async () => {
      const ex = await createExercise(db, name, equipment)
      await addToPlan(db, dayId, ex.id)
    }, fail)
  }

  async function remove(p: DayExercise) {
    editing = null
    let row: DayExercise | undefined
    if (await attempt(async () => (row = await removeFromPlan(db, dayId, p.exerciseId)), fail)) {
      const name = byId.get(p.exerciseId)?.name ?? 'Exercise'
      if (row) {
        const r = row
        toasts.undo(`${name} removed from ${dayName}`, () => void attempt(() => restorePlanRow(db, r), fail))
      }
    }
  }

  function save(p: DayExercise, v: PlanValues) {
    editing = null
    void attempt(() => updatePlanRow(db, dayId, p.exerciseId, v), fail)
  }
</script>

<header class="head">
  <button type="button" class="link" onclick={onback}>{backLabel}</button>
  <h1 class="display">{dayName}</h1>
  <p class="label">Your exercises · {plan.length}</p>
</header>

{#if plan.length === 0}
  <div class="empty">
    <p><strong>No exercises on {dayName} yet.</strong></p>
    <p class="caption">Pick from the list (it opens on the muscles for this day) or type in your own.</p>
  </div>
{/if}

<ol class="plan">
  {#each plan as p, i (p.exerciseId)}
    {@const ex = byId.get(p.exerciseId)}
    <li class="row">
      <button type="button" class="main" onclick={() => (editing = p)} aria-label="{ex?.name}, {summary(p)}. Tap to change">
        <span class="name">{ex?.name ?? p.exerciseId}</span>
        <span class="num summary">{summary(p)}</span>
      </button>
      <div class="tools">
        <button type="button" class="tool" disabled={i === 0} aria-label="Move {ex?.name} up" onclick={() => void attempt(() => movePlanRow(db, dayId, p.exerciseId, -1), fail)}>↑</button>
        <button type="button" class="tool" disabled={i === plan.length - 1} aria-label="Move {ex?.name} down" onclick={() => void attempt(() => movePlanRow(db, dayId, p.exerciseId, 1), fail)}>↓</button>
        <button type="button" class="tool" aria-label="Remove {ex?.name} from {dayName}" onclick={() => remove(p)}>×</button>
      </div>
    </li>
  {/each}
</ol>

<button type="button" class="btn add" onclick={() => (picking = true)}>+ Add exercises</button>

<div class="grow"></div>
<div class="bar">
  {#if footer}
    {@render footer()}
  {:else}
    <button type="button" class="btn solid wide" onclick={onback}>Done</button>
  {/if}
</div>

{#if picking}
  <ExercisePicker {dayId} {dayName} {exercises} {added} onpick={pick} oncreate={create} onclose={() => (picking = false)} />
{/if}

{#if editing}
  {@const p = editing}
  <PlanRowSheet
    name={byId.get(p.exerciseId)?.name ?? p.exerciseId}
    stepKg={byId.get(p.exerciseId)?.stepKg ?? 2.5}
    values={{ plannedSets: p.plannedSets, seedWeightKg: p.seedWeightKg, seedReps: p.seedReps }}
    onsave={(v) => save(p, v)}
    onremove={() => remove(p)}
    onclose={() => (editing = null)}
  />
{/if}

<style>
  .head {
    margin: var(--s2) 0 var(--s4);
  }
  h1 {
    font-size: var(--fs-day);
    margin-top: var(--s2);
  }
  .label {
    margin-top: var(--s2);
  }
  .empty {
    border: 1.5px dotted var(--pencil);
    border-radius: var(--radius);
    padding: var(--s4);
    display: grid;
    gap: var(--s1);
    margin-bottom: var(--s3);
  }
  .plan {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--s2);
    border-top: 1px solid var(--rule);
    min-height: 64px;
  }
  .row:last-child {
    border-bottom: 1px solid var(--rule);
  }
  .main {
    flex: 1;
    min-height: 64px;
    display: grid;
    align-content: center;
    gap: 2px;
    text-align: left;
  }
  .name {
    font-weight: 700;
    font-size: 17px;
  }
  .summary {
    font-size: var(--fs-caption);
    color: var(--pencil);
  }
  .tools {
    display: flex;
    gap: var(--s1);
  }
  .tool {
    width: 40px;
    height: var(--tap);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-num);
    font-size: 18px;
  }
  .tool:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .add {
    width: 100%;
    margin-top: var(--s4);
    border-style: dashed;
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
