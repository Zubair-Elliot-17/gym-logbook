<script lang="ts">
  // Wireframe 4: "Something else" (what + minutes), or edit a logged chip (Save/Delete).
  import Sheet from './Sheet.svelte'
  import Stepper from './Stepper.svelte'

  let {
    kind = '',
    minutes = 30,
    mode,
    onsave,
    ondelete,
    onclose,
  }: {
    kind?: string
    minutes?: number
    mode: 'log' | 'edit'
    onsave: (kind: string, minutes: number) => void
    ondelete?: () => void
    onclose: () => void
  } = $props()

  // svelte-ignore state_referenced_locally
  let what = $state(kind)
  // svelte-ignore state_referenced_locally
  let mins = $state(String(minutes))

  const parsed = $derived(Number(mins))
  const valid = $derived(what.trim() !== '' && Number.isInteger(parsed) && parsed >= 1)

  function submit() {
    if (valid) onsave(what.trim(), parsed)
  }
</script>

<Sheet title={mode === 'edit' ? kind : 'Something else'} {onclose}>
  <div class="field">
    <label for="act-what">What</label>
    <input
      id="act-what"
      type="text"
      placeholder="e.g. Swim"
      autocomplete="off"
      enterkeyhint="go"
      bind:value={what}
      onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), submit())}
    />
  </div>
  <Stepper label="Minutes" bind:value={mins} step={5} min={5} onGo={submit} />
  <button type="button" class="btn primary" disabled={!valid} onclick={submit}>
    {mode === 'edit' ? 'Save' : 'Log activity'}
  </button>
  {#if mode === 'edit' && ondelete}
    <button type="button" class="btn" onclick={ondelete}>Delete</button>
  {/if}
</Sheet>

<style>
  .field {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: var(--s3);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: var(--s2) var(--s3);
  }
  input {
    min-height: var(--tap);
    border: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    text-align: right;
  }
</style>
