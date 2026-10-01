<script lang="ts">
  // "Weight (kg)  [−]  32.5  [+]": big tappable number with steppers. Tap the number to type it.
  let {
    label,
    value = $bindable(),
    step,
    min = 0,
    decimal = false,
    onGo,
  }: {
    label: string
    value: string
    step: number
    min?: number
    decimal?: boolean
    onGo?: () => void
  } = $props()

  const id = `step-${Math.random().toString(36).slice(2, 8)}`

  function bump(dir: 1 | -1) {
    const n = Number.parseFloat(value.replace(',', '.'))
    const base = Number.isFinite(n) ? n : min
    const next = Math.max(min, Math.round((base + dir * step) * 100) / 100)
    value = String(next)
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && onGo) {
      e.preventDefault()
      onGo()
    }
  }
</script>

<div class="stepper">
  <label for={id}>{label}</label>
  <button type="button" class="btn" aria-label="{label} minus {step}" onclick={() => bump(-1)}>−</button>
  <input
    {id}
    class="num"
    type="text"
    inputmode={decimal ? 'decimal' : 'numeric'}
    enterkeyhint="go"
    autocomplete="off"
    placeholder="—"
    bind:value
    {onkeydown}
    onfocus={(e) => e.currentTarget.select()}
  />
  <button type="button" class="btn" aria-label="{label} plus {step}" onclick={() => bump(1)}>+</button>
</div>

<style>
  .stepper {
    display: grid;
    grid-template-columns: 1fr var(--tap) 96px var(--tap);
    align-items: center;
    gap: var(--s2);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: var(--s2) var(--s3);
  }
  label {
    font-size: var(--fs-body);
  }
  .btn {
    width: var(--tap);
    padding: 0;
    font-size: 20px;
  }
  input {
    width: 100%;
    text-align: center;
    font-size: 30px;
    border: 0;
    background: transparent;
    color: var(--ink);
    min-height: var(--tap);
  }
</style>
