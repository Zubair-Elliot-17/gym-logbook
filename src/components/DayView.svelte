<script lang="ts">
  // Today: header, exercise rows, Add exercise, sticky Finish bar, sheets and the Finish card.
  // Renders only committed rows (liveQuery); every write goes through attempt() for the retry toast.
  import { onMount, tick } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import {
    addToPlan,
    addExtraSet,
    createExercise,
    ensureCatalogExercise,
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
  import { equipmentOf, type CatalogEntry } from '../lib/catalog'
  import type { Equipment, Exercise } from '../lib/seed'
  import { buildLiftRows, dayHeading, finishSummary, loggedCount, type FinishSummary, type LiftRow, type TodayData } from '../lib/today'
  import { restSecondsOf } from '../lib/rest'
  import { rest } from '../lib/rest.svelte'
  import { attempt, toasts } from '../lib/toast.svelte'
  import ExercisePicker from './ExercisePicker.svelte'
  import ExerciseRow from './ExerciseRow.svelte'
  import FinishCard from './FinishCard.svelte'
  import SetSheet from './SetSheet.svelte'
  import RestDay from './RestDay.svelte'
  import RestTimer from './RestTimer.svelte'
  import Sheet from './Sheet.svelte'

  let {
    db,
    data,
    greet = false,
    onsettings,
    onhistory,
    onprogress,
    oneditplan,
    onfinished,
  }: {
    db: LogbookDB
    data: TodayData
    /** Show "Welcome back" (opened in a later session, nothing logged yet today). */
    greet?: boolean
    onsettings: () => void
    onhistory: () => void
    /** Open one exercise's progress. */
    onprogress: (exerciseId: string) => void
    /** Open "Your exercises" for today's day. */
    oneditplan: () => void
    /** After the Finish card closes: the one moment an app update may be offered (5A). */
    onfinished?: () => void
  } = $props()

  const isLift = $derived(data.day.type === 'lift')
  const rows = $derived(isLift ? buildLiftRows(data) : [])
  const total = $derived(loggedCount(rows))
  const allDone = $derived(rows.length > 0 && rows.every((r) => r.done))
  const hasEntries = $derived(
    data.activities.length > 0 || data.sets.some((s) => s.cycleNumber === data.pos.cycleNumber && s.cycleDayId === data.pos.cycleDayId),
  )
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
      rest.start(restSecondsOf(data.state))
      const row0 = saved
      toasts.undo(`Set logged · ${formatWeight(weightKg)} × ${reps}`, () => {
        rest.stop()
        void attempt(() => deleteSet(db, row0.id), 'Couldn’t undo that set.')
      })
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

  // "+ Add exercise" adds to this day's plan for good (it shows up every time this day comes round).
  const addFail = 'Couldn’t add that exercise.'
  let lastAdded: string | null = null

  function pick(p: { entry?: CatalogEntry; exercise?: Exercise }) {
    void attempt(async () => {
      const ex = p.exercise ?? (await ensureCatalogExercise(db, p.entry!))
      await addToPlan(db, data.pos.cycleDayId, ex.id)
      lastAdded = ex.id
    }, addFail)
  }

  function create(name: string, equipment: Equipment) {
    void attempt(async () => {
      const ex = await createExercise(db, name, equipment)
      await addToPlan(db, data.pos.cycleDayId, ex.id)
      lastAdded = ex.id
    }, addFail)
  }

  function closePicker() {
    sheet = null
    const id = lastAdded
    lastAdded = null
    if (id) void tick().then(() => document.getElementById(`row-${id}`)?.scrollIntoView({ behavior: motion(), block: 'start' }))
  }

  // ---- finish (6A + 4A) ----

  async function finish(confirmed = false) {
    if (isLift && total === 0 && !confirmed) {
      sheet = { kind: 'skip' }
      return
    }
    sheet = null
    rest.stop()
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
  <button type="button" class="history" aria-label="History" onclick={onhistory}>
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"
      ><path
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11M9 8h6"
      /></svg
    >
  </button>
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
  {#if greet && !hasEntries}<p class="label greet">Welcome back</p>{/if}
  <h1 class="display">{data.day.name}</h1>
  <p class="label meta">{dayHeading(data)}</p>
</header>

{#if isLift}
  {#if rows.length === 0}
    <div class="empty">
      <p><strong>No exercises on {data.day.name} yet.</strong></p>
      <p class="caption">Pick from the list or type in your own, with your sets, weight and reps.</p>
      <button type="button" class="btn solid" onclick={oneditplan}>Set up {data.day.name}</button>
    </div>
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
      onprogress={() => onprogress(row.exercise.id)}
    />
  {/each}
  {#if rows.length > 0}
    <div class="add">
      <button type="button" class="link" onclick={() => (sheet = { kind: 'add' })}>+ Add exercise</button>
      <button type="button" class="link" onclick={oneditplan}>Edit exercises</button>
    </div>
  {/if}
{:else}
  <RestDay {db} {data} />
{/if}

<div class="grow"></div>
<div class="bar">
  {#if isLift}<RestTimer />{/if}
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
    barbell={equipmentOf(sheetRow.exercise) === 'barbell'}
    weightKg={v.weightKg}
    reps={v.reps}
    mode={sheet.ghost?.logged ? 'edit' : 'log'}
    onlog={saveFromSheet}
    ondelete={deleteFromSheet}
    onclose={() => (sheet = null)}
  />
{:else if sheet?.kind === 'add'}
  <ExercisePicker
    dayId={data.pos.cycleDayId}
    dayName={data.day.name}
    exercises={data.exercises}
    added={new Set(rows.map((r) => r.exercise.id))}
    onpick={pick}
    oncreate={create}
    onclose={closePicker}
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
  .settings,
  .history {
    position: absolute;
    top: -6px;
    right: -12px;
    width: var(--tap);
    height: var(--tap);
    display: grid;
    place-items: center;
    color: var(--pencil);
  }
  .history {
    right: calc(var(--tap) - 12px);
  }
  .meta {
    margin-top: var(--s2);
  }
  h1 {
    font-size: var(--fs-day);
    padding-right: calc(2 * var(--tap) - 12px);
    line-height: 1.15;
  }
  .empty {
    display: grid;
    gap: var(--s2);
    padding: var(--s4);
    margin-top: var(--s2);
    border: 1.5px dotted var(--pencil);
    border-radius: var(--radius);
  }
  .empty .btn {
    margin-top: var(--s2);
  }
  .add {
    display: flex;
    justify-content: space-between;
    border-top: 1px solid var(--rule);
    padding: var(--s2) 0 var(--s6);
  }
  .greet {
    margin-bottom: var(--s2);
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
