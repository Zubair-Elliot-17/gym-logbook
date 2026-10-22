<script lang="ts">
  // Edit one exercise: rename it, pick the bar for barbell lifts, or delete it if it was never logged.
  import Dexie from 'dexie'
  import { onMount } from 'svelte'
  import { equipmentOf } from '../lib/catalog'
  import { ExerciseError, deleteExercise, renameExercise, setBar, type LogbookDB } from '../lib/db'
  import type { Exercise } from '../lib/seed'
  import { toasts } from '../lib/toast.svelte'
  import { BAR_CHOICES, barChoice, barToStore } from '../lib/units'
  import { units } from '../lib/units.svelte'
  import Sheet from './Sheet.svelte'

  let { db, exercise, onclose, ondeleted }: { db: LogbookDB; exercise: Exercise; onclose: () => void; ondeleted?: () => void } =
    $props()

  // svelte-ignore state_referenced_locally
  let name = $state(exercise.name)
  // svelte-ignore state_referenced_locally
  let bar = $state(barChoice(exercise.barKg, units.current))
  let logged = $state<number | null>(null)
  let confirming = $state(false)
  let error = $state('')
  const barbell = $derived(equipmentOf(exercise) === 'barbell')

  onMount(async () => {
    logged = await db.sets
      .where('[exerciseId+loggedAt]')
      .between([exercise.id, Dexie.minKey], [exercise.id, Dexie.maxKey])
      .count()
  })

  /** Rule refusals show here; anything else is a failed write. */
  async function run(write: () => Promise<unknown>): Promise<boolean> {
    error = ''
    try {
      await write()
      return true
    } catch (e) {
      if (e instanceof ExerciseError) error = e.message
      else {
        console.error(e)
        error = 'Couldn’t save that change. Try again.'
      }
      return false
    }
  }

  async function save() {
    const ok = await run(async () => {
      if (name.trim() !== exercise.name) await renameExercise(db, exercise.id, name)
      if (barbell && bar !== barChoice(exercise.barKg, units.current)) await setBar(db, exercise.id, barToStore(bar, units.current))
    })
    if (ok) onclose()
  }

  async function remove() {
    if (await run(() => deleteExercise(db, exercise.id))) {
      toasts.show({ kind: 'status', text: `${exercise.name} deleted` }, 4000)
      onclose()
      ondeleted?.()
    }
  }
</script>

<Sheet title="Edit exercise" {onclose}>
  <label class="field">
    <span class="label">Name</span>
    <input type="text" bind:value={name} maxlength="40" autocomplete="off" enterkeyhint="done" onkeydown={(e) => e.key === 'Enter' && save()} />
  </label>

  {#if barbell}
    <div class="field">
      <span class="label" id="bar-label">Bar ({units.current})</span>
      <div class="bars" role="radiogroup" aria-labelledby="bar-label">
        {#each BAR_CHOICES[units.current] as b (b.value)}
          <button type="button" role="radio" class="bar" aria-checked={bar === b.value} onclick={() => (bar = b.value)}>{b.label}</button>
        {/each}
      </div>
    </div>
  {/if}

  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <button type="button" class="btn primary" disabled={name.trim() === ''} onclick={save}>Save</button>

  {#if logged === 0}
    {#if confirming}
      <p>Delete {exercise.name}? It comes off every day it’s on.</p>
      <button type="button" class="btn primary danger" onclick={remove}>Delete exercise</button>
      <button type="button" class="btn" onclick={() => (confirming = false)}>Keep it</button>
    {:else}
      <button type="button" class="btn" onclick={() => (confirming = true)}>Delete exercise</button>
    {/if}
  {:else if logged}
    <p class="caption">Logged {logged} {logged === 1 ? 'time' : 'times'}, so it stays in your history. Remove it from a day in Your exercises instead.</p>
  {/if}
</Sheet>

<style>
  .field {
    display: grid;
    gap: var(--s1);
  }
  input {
    min-height: var(--tap);
    padding: 0 var(--s3);
    border: 1.5px solid var(--ink);
    border-radius: var(--radius);
    background: var(--paper);
    color: var(--ink);
    font: inherit;
    font-size: 17px;
  }
  .bars {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--s2);
  }
  .bar {
    min-height: var(--tap);
    padding: var(--s1);
    border: 1.5px dotted var(--pencil);
    border-radius: var(--radius);
    font-size: var(--fs-caption);
    font-weight: 700;
  }
  .bar[aria-checked='true'] {
    background: var(--ink);
    color: var(--paper);
    border: 0;
    box-shadow:
      inset 0 0 0 3px var(--ink),
      inset 0 0 0 4px var(--paper);
  }
  .error {
    border: 1.5px dashed var(--ink);
    border-radius: var(--radius);
    padding: var(--s2) var(--s3);
    font-size: var(--fs-caption);
  }
</style>
