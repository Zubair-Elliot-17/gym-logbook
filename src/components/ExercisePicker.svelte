<script lang="ts">
  // The exercise table: tabs by muscle (opening on the day's own muscles), search across everything,
  // tap to add (stays open so you can add several), or type your own and pick its type.
  import { CATALOG, musclesFor, type CatalogEntry, type Muscle } from '../lib/catalog'
  import type { Equipment, Exercise } from '../lib/seed'
  import Sheet from './Sheet.svelte'

  let {
    dayId,
    dayName,
    exercises,
    added,
    onpick,
    oncreate,
    onclose,
  }: {
    dayId: string
    dayName: string
    /** Exercises already in the database (library ones used before + your own). */
    exercises: Exercise[]
    /** Exercise ids already on this day. */
    added: Set<string>
    onpick: (pick: { entry?: CatalogEntry; exercise?: Exercise }) => void
    oncreate: (name: string, equipment: Equipment) => void
    onclose: () => void
  } = $props()

  // svelte-ignore state_referenced_locally
  const tabs: (Muscle | 'Yours')[] = [...musclesFor(dayId)]
  const own = $derived(exercises.filter((e) => e.id.startsWith('custom-')))
  // svelte-ignore state_referenced_locally
  let tab = $state<Muscle | 'Yours'>(tabs[0])
  let query = $state('')
  let creating = $state(false)

  const q = $derived(query.trim().toLowerCase())
  type Row = { id: string; name: string; detail: string; pick: { entry?: CatalogEntry; exercise?: Exercise } }
  const equipmentLabel: Record<Equipment, string> = { barbell: 'Barbell', dumbbell: 'Dumbbell', machine: 'Machine / cable' }

  const rows = $derived.by((): Row[] => {
    const fromCatalog = (c: CatalogEntry): Row => ({ id: c.id, name: c.name, detail: q ? `${c.muscle} · ${equipmentLabel[c.equipment]}` : equipmentLabel[c.equipment], pick: { entry: c } })
    const fromOwn = (e: Exercise): Row => ({ id: e.id, name: e.name, detail: 'Your exercise', pick: { exercise: e } })
    if (q) {
      return [...own.filter((e) => e.name.toLowerCase().includes(q)).map(fromOwn), ...CATALOG.filter((c) => c.name.toLowerCase().includes(q)).map(fromCatalog)]
    }
    if (tab === 'Yours') return own.map(fromOwn)
    return CATALOG.filter((c) => c.muscle === tab).map(fromCatalog)
  })
  const exact = $derived(q !== '' && (CATALOG.some((c) => c.name.toLowerCase() === q) || own.some((e) => e.name.toLowerCase() === q)))

  const types: { value: Equipment; label: string; step: string }[] = [
    { value: 'barbell', label: 'Barbell', step: '−/+ moves 2.5 kg' },
    { value: 'dumbbell', label: 'Dumbbell', step: '−/+ moves 2 kg' },
    { value: 'machine', label: 'Machine / cable / bodyweight', step: '−/+ moves 2.5 kg' },
  ]
</script>

<Sheet title={creating ? `New: ${query.trim()}` : `Add to ${dayName}`} {onclose}>
  {#if creating}
    <p class="caption">What kind is it? This sets how much −/+ changes the weight.</p>
    {#each types as t (t.value)}
      <button
        type="button"
        class="btn type"
        onclick={() => {
          oncreate(query.trim(), t.value)
          creating = false
          query = ''
        }}
      >
        <span>{t.label}</span><span class="caption">{t.step}</span>
      </button>
    {/each}
    <button type="button" class="link" onclick={() => (creating = false)}>‹ Back to the list</button>
  {:else}
    <label class="visually-hidden" for="ex-search">Search or type your own exercise</label>
    <input id="ex-search" class="search" type="search" placeholder="Search, or type your own" autocomplete="off" bind:value={query} />

    {#if q && !exact}
      <button type="button" class="create" onclick={() => (creating = true)}>
        <span>+ Add “{query.trim()}” as your own exercise</span><span aria-hidden="true">›</span>
      </button>
    {/if}

    {#if !q}
      <div class="tabs" role="tablist" aria-label="Muscle group">
        {#each tabs as t (t)}
          <button type="button" role="tab" class="tab" aria-selected={tab === t} onclick={() => (tab = t)}>{t}</button>
        {/each}
        {#if own.length}
          <button type="button" role="tab" class="tab" aria-selected={tab === 'Yours'} onclick={() => (tab = 'Yours')}>Yours</button>
        {/if}
      </div>
    {/if}

    <ul class="list" aria-label="Exercises">
      {#each rows as r (r.id)}
        {@const isAdded = added.has(r.id)}
        <li>
          <button
            type="button"
            class="item"
            class:added={isAdded}
            disabled={isAdded}
            aria-label={isAdded ? `${r.name}, already on ${dayName}` : `Add ${r.name}`}
            onclick={() => onpick(r.pick)}
          >
            <span class="name">{r.name}<span class="caption detail">{r.detail}</span></span>
            <span class="mark" aria-hidden="true">{isAdded ? '✓' : '+'}</span>
          </button>
        </li>
      {:else}
        <li class="caption empty">{q ? 'No match in the list.' : 'Nothing here yet.'}</li>
      {/each}
    </ul>
    <button type="button" class="btn primary" onclick={onclose}>Done</button>
  {/if}
</Sheet>

<style>
  .search {
    min-height: var(--tap);
    border: 1.5px solid var(--ink);
    border-radius: var(--radius);
    padding: 0 var(--s3);
    font: inherit;
    background: var(--paper);
    color: var(--ink);
  }
  .create {
    min-height: var(--tap);
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 var(--s3);
    border: 1.5px dashed var(--ink);
    border-radius: var(--radius);
    font-weight: 700;
    text-align: left;
  }
  .tabs {
    display: flex;
    gap: var(--s2);
    overflow-x: auto;
    margin: 0 calc(-1 * var(--s4));
    padding: 0 var(--s4) 2px;
    scrollbar-width: none;
  }
  .tab {
    flex: none;
    min-height: 40px;
    padding: 0 var(--s3);
    border: 1px solid var(--rule);
    border-radius: var(--radius-tile);
    background: var(--paper);
    font-family: var(--font-num);
    font-weight: 600;
    font-stretch: 75%;
    font-size: var(--fs-label);
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }
  .tab[aria-selected='true'] {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--paper);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 44dvh;
    overflow-y: auto;
  }
  .item {
    width: 100%;
    min-height: 52px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--s3);
    border-bottom: 1px solid var(--rule);
    text-align: left;
  }
  .name {
    display: grid;
    font-weight: 700;
  }
  .detail {
    font-weight: 400;
  }
  .mark {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border: 1.5px solid var(--ink);
    border-radius: var(--radius);
    font-family: var(--font-num);
    font-size: 18px;
  }
  .item.added {
    cursor: default;
    color: var(--pencil);
  }
  .item.added .mark {
    background: var(--ink);
    color: var(--paper);
  }
  .empty {
    padding: var(--s4) 0;
  }
  .type {
    display: flex;
    justify-content: space-between;
    align-items: center;
    text-align: left;
  }
</style>
