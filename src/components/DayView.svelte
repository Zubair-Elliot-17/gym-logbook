<script lang="ts">
  // Today: header, exercise rows, Add exercise, sticky Finish bar, sheets and the Finish card.
  // Renders only committed rows (liveQuery); every write goes through attempt() for the retry toast.
  import { onMount, tick } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import {
    addExerciseToDay,
    addExtraSet,
    createExercise,
    deleteSet,
    finishDay,
    goBackDay,
    logSet,
    restoreSet,
    setGhostWeight,
    updateSet,
    type LogbookDB,
    type SetRow,
  } from '../lib/db'
  import { formatWeight, type Ghost } from '../lib/logic'
  import type { Equipment, Exercise } from '../lib/seed'
  import { buildLiftRows, dayHeading, finishSummary, loggedCount, type FinishSummary, type LiftRow, type TodayData } from '../lib/today'
  import { attempt, toasts } from '../lib/toast.svelte'
  import AddExerciseSheet from './AddExerciseSheet.svelte'
  import ExerciseRow from './ExerciseRow.svelte'
  import FinishCard from './FinishCard.svelte'
  import SetSheet from './SetSheet.svelte'
  import RestDay from './RestDay.svelte'
  import Sheet from './Sheet.svelte'

  let {
    db,
    data,
    onsettings,
    onfinished,
  }: {
    db: LogbookDB
    data: TodayData
    onsettings: () => void
    /** After the Finish card closes: the one moment an app update may be offered (5A). */
    onfinished?: () => void
  } = $props()

  const isLift = $derived(data.day.type === 'lift')
  const rows = $derived(isLift ? buildLiftRows(data) : [])
  const total = $derived(loggedCount(rows))
  const allDone = $derived(rows.length > 0 && rows.every((r) => r.done))
  const expanded = new SvelteSet<string>()

  type SheetState = { kind: 'set'; exerciseId: string; ghost: Ghost | null } | { kind: 'add' } | { kind: 'skip' } | null
  let sheet = $state<SheetState>(null)
  let card = $state<{ summary: FinishSummary; at: number } | null>(null)

  const sheetRow = $derived.by(() => {
    const s = sheet
    return s?.kind === 'set' ? rows.find((r) => r.exercise.id === s.exerciseId) : undefined
  })

  // ---- writes ----

  async function log(row: LiftRow, weightKg: number, reps: number) {
    let saved: SetRow | undefined
    const ok = await attempt(async () => {
      saved = await logSet(db, { exerciseId: row.exercise.id, weightKg, reps })
    })
    if (ok && saved) {
      const row0 = saved
      toasts.undo(`Set logged · ${formatWeight(weightKg)} × ${reps}`, () => void attempt(() => deleteSet(db, row0.id), 'Couldn’t undo that set.'))
    }
  }

  function adjust(row: LiftRow, dir: 1 | -1) {
    const next = row.ghosts.find((g) => g.next)
    if (!next) return
    const w = Math.max(0, Math.round(((next.weightKg ?? 0) + dir * row.exercise.stepKg) * 100) / 100)
    void attempt(() => setGhostWeight(db, row.exercise.id, next.setIndex, w), 'Couldn’t save that change.')
  }

  async function saveFromSheet(weightKg: number, reps: number) {
    const s = sheet
    const row = sheetRow
    sheet = null
    if (s?.kind !== 'set' || !row) return
    if (s.ghost?.logged) {
      const id = s.ghost.logged.id
      await attempt(() => updateSet(db, id, { weightKg, reps }))
    } else {
      await log(row, weightKg, reps)
    }
  }

  async function deleteFromSheet() {
    const s = sheet
    sheet = null
    if (s?.kind !== 'set' || !s.ghost?.logged) return
    const row = s.ghost.logged
    if (await attempt(() => deleteSet(db, row.id), 'Couldn’t delete that set.')) {
      toasts.undo('Set deleted', () => void attempt(() => restoreSet(db, row)))
    }
  }

  async function addToDay(exerciseId: string) {
    sheet = null
    if (await attempt(() => addExerciseToDay(db, exerciseId), 'Couldn’t add that exercise.')) pendingAdd = exerciseId
  }

  // The added row arrives with the next liveQuery result: then scroll to it, and open the editor if
  // it has no history (3A).
  let pendingAdd = $state<string | null>(null)
  $effect(() => {
    const id = pendingAdd
    const row = id ? rows.find((r) => r.exercise.id === id) : undefined
    if (!id || !row) return
    pendingAdd = null
    void tick().then(() => document.getElementById(`row-${id}`)?.scrollIntoView({ behavior: motion(), block: 'start' }))
    if (row.needsEditor) sheet = { kind: 'set', exerciseId: id, ghost: null }
  })

  async function create(name: string, equipment: Equipment) {
    let ex: Exercise | undefined
    const ok = await attempt(async () => {
      ex = await createExercise(db, name, equipment)
    }, 'Couldn’t create that exercise.')
    if (ok && ex) await addToDay(ex.id)
  }

  // ---- finish (6A + 4A) ----

  async function finish(confirmed = false) {
    if (isLift && total === 0 && !confirmed) {
      sheet = { kind: 'skip' }
      return
    }
    sheet = null
    const summary = finishSummary(data, rows)
    if (await attempt(() => finishDay(db), 'Couldn’t finish the day.')) card = { summary, at: Date.now() }
  }

  function undoFinish() {
    card = null
    void attempt(() => goBackDay(db), 'Couldn’t undo Finish.')
  }

  function closeCard() {
    if (!card) return
    const left = 5000 - (Date.now() - card.at)
    const name = card.summary.dayName
    card = null
    if (left > 300) toasts.undo(`${name} finished.`, undoFinish, left)
    onfinished?.()
  }

  // ---- 2A: bring the next unfinished row to the top ----

  const motion = (): ScrollBehavior =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  let lastUserScroll = 0
  let prevDone = new Set<string>()
  let prevDay = ''

  onMount(() => {
    const mark = () => (lastUserScroll = Date.now())
    window.addEventListener('touchmove', mark, { passive: true })
    window.addEventListener('wheel', mark, { passive: true })
    return () => {
      window.removeEventListener('touchmove', mark)
      window.removeEventListener('wheel', mark)
    }
  })

  $effect(() => {
    const dayKey = `${data.pos.cycleNumber}|${data.pos.cycleDayId}`
    const doneNow = new Set(rows.filter((r) => r.done).map((r) => r.exercise.id))
    const opened = dayKey !== prevDay
    const newlyDone = [...doneNow].some((id) => !prevDone.has(id))
    prevDay = dayKey
    prevDone = doneNow
    if (!opened && !newlyDone) return
    if (Date.now() - lastUserScroll < 800) return
    const target = rows.find((r) => !r.done)
    if (!target || target === rows[0]) return
    void tick().then(() =>
      document.getElementById(`row-${target.exercise.id}`)?.scrollIntoView({ behavior: motion(), block: 'start' }),
    )
  })

  function sheetValues(row: LiftRow, ghost: Ghost | null) {
    if (ghost?.logged) return { weightKg: ghost.logged.weightKg, reps: ghost.logged.reps, setNumber: ghost.setIndex + 1 }
    if (ghost) return { weightKg: ghost.weightKg, reps: ghost.reps, setNumber: ghost.setIndex + 1 }
    const lastGhost = row.ghosts.at(-1)
    return {
      weightKg: lastGhost ? (lastGhost.logged?.weightKg ?? lastGhost.weightKg) : null,
      reps: lastGhost ? (lastGhost.logged?.reps ?? lastGhost.reps) : (row.plan?.seedReps ?? 10),
      setNumber: row.ghosts.length + 1,
    }
  }
</script>

<header class="head">
  <button type="button" class="settings" aria-label="Settings" onclick={onsettings}>
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"
      ><path
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4.5v5M8 14.5v5"
      /></svg
    >
  </button>
  <h1 class="display">{data.day.name}</h1>
  <p class="label meta">{dayHeading(data)}</p>
</header>

{#if isLift}
  {#if rows.length === 0}
    <p class="empty">Nothing planned for {data.day.name}.</p>
  {/if}
  {#each rows as row (row.exercise.id)}
    <ExerciseRow
      {row}
      expanded={expanded.has(row.exercise.id)}
      onlog={(g) => g.weightKg !== null && log(row, g.weightKg, g.reps)}
      onedit={(g) => (sheet = { kind: 'set', exerciseId: row.exercise.id, ghost: g })}
      onadjust={(dir) => adjust(row, dir)}
      onextra={() => void attempt(() => addExtraSet(db, row.exercise.id), 'Couldn’t add a set.')}
      ontoggle={() => (expanded.has(row.exercise.id) ? expanded.delete(row.exercise.id) : expanded.add(row.exercise.id))}
    />
  {/each}
  <div class="add">
    <button type="button" class="link" onclick={() => (sheet = { kind: 'add' })}>+ Add exercise</button>
  </div>
{:else}
  <RestDay {db} {data} />
{/if}

<div class="grow"></div>
<div class="bar">
  <button type="button" class="btn finish" class:solid={allDone} class:primary={!allDone} onclick={() => finish()}>
    Finish {data.day.name} →
  </button>
</div>

{#if sheet?.kind === 'set' && sheetRow}
  {@const v = sheetValues(sheetRow, sheet.ghost)}
  <SetSheet
    exerciseName={sheetRow.exercise.name}
    setNumber={v.setNumber}
    lastText={sheetRow.lastText}
    stepKg={sheetRow.exercise.stepKg}
    weightKg={v.weightKg}
    reps={v.reps}
    mode={sheet.ghost?.logged ? 'edit' : 'log'}
    onlog={saveFromSheet}
    ondelete={deleteFromSheet}
    onclose={() => (sheet = null)}
  />
{:else if sheet?.kind === 'add'}
  <AddExerciseSheet
    exercises={data.exercises}
    exclude={new Set(rows.map((r) => r.exercise.id))}
    onpick={(ex) => addToDay(ex.id)}
    oncreate={create}
    onclose={() => (sheet = null)}
  />
{:else if sheet?.kind === 'skip'}
  <Sheet title="Finish with nothing logged?" onclose={() => (sheet = null)}>
    <p>This marks {data.day.name} as skipped.</p>
    <button type="button" class="btn primary danger" onclick={() => finish(true)}>Mark skipped</button>
    <button type="button" class="btn" onclick={() => (sheet = null)}>Cancel</button>
  </Sheet>
{/if}

{#if card}
  <FinishCard summary={card.summary} onundo={undoFinish} ondone={closeCard} />
{/if}

<style>
  .head {
    position: relative;
    margin: var(--s5) 0 var(--s3);
  }
  .settings {
    position: absolute;
    top: -6px;
    right: -12px;
    width: var(--tap);
    height: var(--tap);
    display: grid;
    place-items: center;
    color: var(--pencil);
  }
  .meta {
    margin-top: var(--s2);
  }
  h1 {
    font-size: var(--fs-day);
    padding-right: var(--tap);
    line-height: 1.15;
  }
  .empty {
    padding: var(--s4) 0;
    color: var(--pencil);
    border-top: 1px solid var(--rule);
  }
  .add {
    border-top: 1px solid var(--rule);
    padding: var(--s2) 0 var(--s6);
  }
  .grow {
    flex: 1;
  }
  .bar {
    position: sticky;
    bottom: 0;
    margin: 0 calc(-1 * var(--s4));
    padding: var(--s2) var(--s4) calc(var(--s2) + env(safe-area-inset-bottom));
    min-height: var(--bar-h);
    background: var(--paper);
    border-top: 1px solid var(--rule);
  }
  .finish {
    width: 100%;
    min-height: 48px;
    min-height: 52px;
  }
</style>
