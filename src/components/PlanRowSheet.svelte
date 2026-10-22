<script lang="ts">
  // Edit one exercise on a day: how many sets, starting weight (optional) and reps.
  import type { PlanValues } from '../lib/db'
  import Sheet from './Sheet.svelte'
  import Stepper from './Stepper.svelte'
  import { fromUnit, stepIn, toUnit } from '../lib/units'
  import { units } from '../lib/units.svelte'

  let {
    name,
    stepKg,
    values,
    onsave,
    onremove,
    onclose,
  }: {
    name: string
    stepKg: number
    values: PlanValues
    onsave: (v: PlanValues) => void
    onremove: () => void
    onclose: () => void
  } = $props()

  // svelte-ignore state_referenced_locally
  let sets = $state(String(values.plannedSets))
  // svelte-ignore state_referenced_locally
  let weight = $state(values.seedWeightKg === null ? '' : String(toUnit(values.seedWeightKg, units.current)))
  // svelte-ignore state_referenced_locally
  let reps = $state(String(values.seedReps))

  const parsed = $derived({
    plannedSets: Number(sets),
    seedWeightKg: weight.trim() === '' ? null : Number.parseFloat(weight.replace(',', '.')),
    seedReps: Number(reps),
  })
  const valid = $derived(
    Number.isInteger(parsed.plannedSets) &&
      parsed.plannedSets >= 1 &&
      parsed.plannedSets <= 20 &&
      Number.isInteger(parsed.seedReps) &&
      parsed.seedReps >= 1 &&
      (parsed.seedWeightKg === null || (Number.isFinite(parsed.seedWeightKg) && parsed.seedWeightKg >= 0)),
  )
  const submit = () => {
    if (valid) onsave({ ...parsed, seedWeightKg: parsed.seedWeightKg === null ? null : fromUnit(parsed.seedWeightKg, units.current) })
  }
</script>

<Sheet title={name} {onclose}>
  <Stepper label="Sets" bind:value={sets} step={1} min={1} onGo={submit} />
  <Stepper label="Weight ({units.current})" bind:value={weight} step={stepIn(stepKg, units.current)} decimal onGo={submit} />
  <Stepper label="Reps" bind:value={reps} step={1} min={1} onGo={submit} />
  <p class="caption">
    Weight is where you start; leave it blank and the first set asks. After that, each set fills in from
    what you lifted last time.
  </p>
  <button type="button" class="btn primary" disabled={!valid} onclick={submit}>Save</button>
  <button type="button" class="btn" onclick={onremove}>Remove from this day</button>
</Sheet>
