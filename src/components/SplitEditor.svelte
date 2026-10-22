<script lang="ts">
  // "Your split": the days you cycle through, in order. Rename, lift or rest, reorder, add, remove.
  // Removing a day with history archives it, so its sets stay in History.
  import { MAX_DAYS, MAX_DAY_NAME, SplitError, addDay, moveDay, removeDay, renameDay, setDayType, type LogbookDB } from '../lib/db'
  import { activeDays } from '../lib/logic'
  import type { CycleDay } from '../lib/seed'
  import type { TodayData } from '../lib/today'
  import { attempt, toasts } from '../lib/toast.svelte'
  import Sheet from './Sheet.svelte'

  let { db, data, onback }: { db: LogbookDB; data: TodayData; onback: () => void } = $props()

  const days = $derived(activeDays(data.days))
  const fail = 'Couldn’t save that change.'

  type Editing = { day: CycleDay | null; name: string; type: 'lift' | 'rest' }
  let editing = $state<Editing | null>(null)
  let removing = $state<CycleDay | null>(null)
  let error = $state('')

  function open(day: CycleDay | null) {
    error = ''
    editing = { day, name: day?.name ?? '', type: day?.type ?? 'lift' }
  }

  /** Split rules (SplitError) show in the sheet; anything else is a failed write (retry toast). */
  async function run(write: () => Promise<unknown>): Promise<boolean> {
    try {
      await write()
      return true
    } catch (e) {
      if (e instanceof SplitError) error = e.message
      else {
        console.error(e)
        toasts.show({ kind: 'alert', text: fail, action: { label: 'Retry', run: () => void attempt(write, fail) } })
      }
      return false
    }
  }

  async function save() {
    const e = editing
    if (!e) return
    error = ''
    const ok = await run(async () => {
      if (!e.day) return addDay(db, e.name, e.type)
      if (e.name.trim() !== e.day.name) await renameDay(db, e.day.id, e.name)
      if (e.type !== e.day.type) await setDayType(db, e.day.id, e.type)
    })
    if (ok) editing = null
  }

  async function confirmRemove() {
    const day = removing
    if (!day) return
    error = ''
    let how = 'deleted' as 'archived' | 'deleted'
    if (await run(async () => (how = await removeDay(db, day.id)))) {
      removing = null
      toasts.show({ kind: 'status', text: how === 'archived' ? `${day.name} removed. Its history stays.` : `${day.name} removed.` }, 4000)
    }
  }

  const move = (day: CycleDay, dir: 1 | -1) => void attempt(() => moveDay(db, day.id, dir), fail)
</script>

<header class="head">
  <button type="button" class="link" onclick={onback}>‹ Settings</button>
  <h1 class="display">Your split</h1>
  <p class="label">{days.length} {days.length === 1 ? 'day' : 'days'}, then it repeats</p>
</header>

<ol class="days">
  {#each days as day, i (day.id)}
    {@const today = day.id === data.pos.cycleDayId}
    <li class="row">
      <button type="button" class="main" onclick={() => open(day)} aria-label="{day.name}, {day.type === 'lift' ? 'lifting' : 'rest'} day{today ? ', today' : ''}. Tap to change">
        <span class="num idx">{i + 1}</span>
        <span class="text">
          <span class="name">{day.name}</span>
          <span class="label">{day.type === 'lift' ? 'Lifting' : 'Rest'}{today ? ' · today' : ''}</span>
        </span>
      </button>
      <div class="tools">
        <button type="button" class="tool" disabled={i === 0} aria-label="Move {day.name} earlier" onclick={() => move(day, -1)}>↑</button>
        <button type="button" class="tool" disabled={i === days.length - 1} aria-label="Move {day.name} later" onclick={() => move(day, 1)}>↓</button>
        <button
          type="button"
          class="tool"
          disabled={today || days.length === 1}
          aria-label="Remove {day.name}"
          onclick={() => {
            error = ''
            removing = day
          }}>×</button
        >
      </div>
    </li>
  {/each}
</ol>

{#if days.length < MAX_DAYS}
  <button type="button" class="btn add" onclick={() => open(null)}>+ Add a day</button>
{/if}
<p class="caption note">Finish always moves to the next day in this order. Today can’t be removed: switch days first.</p>

<div class="grow"></div>
<div class="bar">
  <button type="button" class="btn solid wide" onclick={onback}>Done</button>
</div>

{#if editing}
  <Sheet title={editing.day ? `Edit ${editing.day.name}` : 'Add a day'} onclose={() => (editing = null)}>
    <label class="field">
      <span class="label">Name</span>
      <input
        type="text"
        bind:value={editing.name}
        maxlength={MAX_DAY_NAME}
        autocomplete="off"
        enterkeyhint="done"
        onkeydown={(e) => e.key === 'Enter' && save()}
      />
    </label>
    <div class="types" role="radiogroup" aria-label="Kind of day">
      {#each [['lift', 'Lifting'], ['rest', 'Rest']] as const as [value, text] (value)}
        <button type="button" role="radio" class="type" aria-checked={editing.type === value} onclick={() => (editing!.type = value)}>
          {text}
        </button>
      {/each}
    </div>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <button type="button" class="btn primary" disabled={editing.name.trim() === ''} onclick={save}>
      {editing.day ? 'Save' : 'Add day'}
    </button>
  </Sheet>
{:else if removing}
  <Sheet title="Remove {removing.name}?" onclose={() => (removing = null)}>
    <p>It leaves your split. Anything you logged on it stays in History.</p>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <button type="button" class="btn primary danger" onclick={confirmRemove}>Remove</button>
    <button type="button" class="btn" onclick={() => (removing = null)}>Cancel</button>
  </Sheet>
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
  .days {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--s2);
    min-height: 64px;
    border-top: 1px solid var(--rule);
  }
  .row:last-child {
    border-bottom: 1px solid var(--rule);
  }
  .main {
    flex: 1;
    min-height: 64px;
    display: flex;
    align-items: center;
    gap: var(--s3);
    text-align: left;
    min-width: 0;
  }
  .idx {
    width: 28px;
    height: 28px;
    flex: none;
    display: grid;
    place-items: center;
    background: var(--ink);
    color: var(--paper);
    border-radius: var(--radius-tile);
    font-size: 15px;
  }
  .text {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .name {
    font-weight: 700;
    font-size: 17px;
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
  .note {
    margin-top: var(--s3);
  }
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
  .types {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--s2);
  }
  .type {
    min-height: var(--tap);
    border: 1.5px dotted var(--pencil);
    border-radius: var(--radius);
    font-weight: 700;
  }
  .type[aria-checked='true'] {
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
