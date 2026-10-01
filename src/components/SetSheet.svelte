<script lang="ts">
  // Editor sheet (wireframes 2 and 3): log a set with custom values, or edit/delete a logged one.
  import Sheet from './Sheet.svelte'
  import Stepper from './Stepper.svelte'

  let {
    exerciseName,
    setNumber,
    lastText = '',
    stepKg,
    weightKg,
    reps,
    mode,
    onlog,
    ondelete,
    onclose,
  }: {
    exerciseName: string
    setNumber: number
    lastText?: string
    stepKg: number
    weightKg: number | null
    reps: number
    mode: 'log' | 'edit'
    onlog: (weightKg: number, reps: number) => void
    ondelete?: () => void
    onclose: () => void
  } = $props()

  // Initial values are copied once; the sheet edits its own state.
  // svelte-ignore state_referenced_locally
  let weight = $state(weightKg === null ? '' : String(weightKg))
  // svelte-ignore state_referenced_locally
  let repsText = $state(String(reps))

  const parsedWeight = $derived(Number.parseFloat(weight.replace(',', '.')))
  const parsedReps = $derived(Number(repsText))
  const valid = $derived(
    weight.trim() !== '' && Number.isFinite(parsedWeight) && parsedWeight >= 0 && Number.isInteger(parsedReps) && parsedReps >= 1,
  )

  function submit() {
    if (valid) onlog(Math.round(parsedWeight * 100) / 100, parsedReps)
  }
</script>

<Sheet
  title="{exerciseName} · set {setNumber}{mode === 'edit' ? ' (logged)' : ''}"
  subtitle={lastText ? `Last time: ${lastText}` : ''}
  {onclose}
>
  <Stepper label="Weight (kg)" bind:value={weight} step={stepKg} decimal onGo={submit} />
  <Stepper label="Reps" bind:value={repsText} step={1} min={1} onGo={submit} />
  <p class="caption">Tap a number to type it. 0 kg = bodyweight.</p>
  <button type="button" class="btn primary" disabled={!valid} onclick={submit}>
    {mode === 'edit' ? 'Save' : 'Log set'}
  </button>
  {#if mode === 'edit' && ondelete}
    <button type="button" class="btn" onclick={ondelete}>Delete set</button>
  {/if}
</Sheet>
