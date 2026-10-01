<script lang="ts">
  // "Add exercise" picker (3A): search your exercises; "Create '<name>'" last, which asks the type
  // so the −/+ step is right (assignment decision).
  import type { Equipment, Exercise } from '../lib/seed'
  import Sheet from './Sheet.svelte'

  let {
    exercises,
    exclude,
    onpick,
    oncreate,
    onclose,
  }: {
    exercises: Exercise[]
    exclude: Set<string>
    onpick: (ex: Exercise) => void
    oncreate: (name: string, equipment: Equipment) => void
    onclose: () => void
  } = $props()

  let query = $state('')
  let creating = $state(false)

  const q = $derived(query.trim().toLowerCase())
  const matches = $derived(
    exercises
      .filter((e) => !exclude.has(e.id) && e.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name)),
  )
  const exact = $derived(exercises.find((e) => e.name.toLowerCase() === q))
  const types: { value: Equipment; label: string; step: string }[] = [
    { value: 'barbell', label: 'Barbell', step: '2.5 kg steps' },
    { value: 'dumbbell', label: 'Dumbbell', step: '2 kg steps' },
    { value: 'machine', label: 'Machine / cable', step: '2.5 kg steps' },
  ]
</script>

<Sheet title={creating ? `New: ${query.trim()}` : 'Add exercise'} {onclose}>
  {#if creating}
    <p class="caption">What kind is it? This sets the −/+ step.</p>
    {#each types as t (t.value)}
      <button type="button" class="btn type" onclick={() => oncreate(query.trim(), t.value)}>
        <span>{t.label}</span><span class="caption">{t.step}</span>
      </button>
    {/each}
    <button type="button" class="link" onclick={() => (creating = false)}>Back</button>
  {:else}
    <label class="visually-hidden" for="ex-search">Search exercises</label>
    <input id="ex-search" class="search" type="search" placeholder="Search or create" autocomplete="off" bind:value={query} />
    <ul>
      {#each matches as ex (ex.id)}
        <li><button type="button" class="item" onclick={() => onpick(ex)}>{ex.name}</button></li>
      {/each}
      {#if q && exact && exclude.has(exact.id)}
        <li class="caption">{exact.name} is already on today’s list.</li>
      {:else if q && exact}
        <!-- duplicate name → picks the existing one (shown above) -->
      {:else if q}
        <li><button type="button" class="item create" onclick={() => (creating = true)}>Create “{query.trim()}”</button></li>
      {/if}
    </ul>
  {/if}
</Sheet>

<style>
  .search {
    min-height: var(--tap);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 0 var(--s3);
    font: inherit;
    background: var(--paper);
    color: var(--ink);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 45dvh;
    overflow-y: auto;
  }
  .item {
    width: 100%;
    min-height: var(--tap);
    text-align: left;
    border-bottom: 1px solid var(--rule);
  }
  .create {
    font-weight: 600;
  }
  .type {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
</style>
