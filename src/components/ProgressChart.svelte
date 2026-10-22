<script lang="ts">
  // A trend line in graphite: one point per session, PR sessions ringed in stamp red.
  // Plain SVG scaled by viewBox; the numbers it shows are also in the session list below it.
  import { formatDate, type ChartPoint } from '../lib/history'
  import { formatWeight } from '../lib/logic'

  let { points, unit, label }: { points: ChartPoint[]; unit: 'kg' | 'reps'; label: string } = $props()

  const W = 320
  const H = 150
  const PAD = { top: 12, right: 10, bottom: 22, left: 44 }

  const fmt = (v: number) => (unit === 'kg' ? formatWeight(v) : String(v))

  const geo = $derived.by(() => {
    const values = points.map((p) => p.value)
    let lo = Math.min(...values)
    let hi = Math.max(...values)
    if (hi === lo) {
      lo -= unit === 'kg' ? 5 : 2
      hi += unit === 'kg' ? 5 : 2
    }
    const pad = (hi - lo) * 0.08
    lo = Math.max(0, lo - pad)
    hi += pad
    const x = (i: number) =>
      points.length === 1 ? PAD.left + (W - PAD.left - PAD.right) / 2 : PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right)
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom)
    const pts = points.map((p, i) => ({ ...p, x: x(i), y: y(p.value) }))
    return { pts, lo, hi, y, line: pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') }
  })

  const first = $derived(points[0])
  const last = $derived(points.at(-1))
  const best = $derived(Math.max(...points.map((p) => p.value)))
  const summary = $derived(
    `${label}: ${points.length} ${points.length === 1 ? 'session' : 'sessions'}, from ${fmt(first.value)} to ${fmt(last!.value)} ${unit}, best ${fmt(best)} ${unit}.`,
  )
</script>

<figure class="chart">
  <svg viewBox="0 0 {W} {H}" role="img" aria-label={summary}>
    <!-- ruled lines at the top and bottom of the range -->
    {#each [geo.hi, geo.lo] as v (v)}
      <line class="rule" x1={PAD.left} x2={W - PAD.right} y1={geo.y(v)} y2={geo.y(v)} />
      <text class="tick" x={PAD.left - 6} y={geo.y(v) + 4} text-anchor="end">{fmt(Math.round(v * 2) / 2)}</text>
    {/each}
    {#if geo.pts.length > 1}
      <polyline class="line" points={geo.line} />
    {/if}
    {#each geo.pts as p, i (i)}
      {#if p.pr}
        <circle class="pr" cx={p.x} cy={p.y} r="6" />
      {/if}
      <circle class="dot" cx={p.x} cy={p.y} r="3.5" />
    {/each}
    <text class="tick" x={PAD.left} y={H - 4} text-anchor="start">{formatDate(first.date)}</text>
    {#if points.length > 1}
      <text class="tick" x={W - PAD.right} y={H - 4} text-anchor="end">{formatDate(last!.date)}</text>
    {/if}
  </svg>
  <figcaption class="label">
    {label} ({unit})
    {#if points.some((p) => p.pr)}<span class="key"><span class="ring" aria-hidden="true"></span> PR</span>{/if}
  </figcaption>
</figure>

<style>
  .chart {
    margin: 0;
    padding: var(--s3);
    border: 1.5px solid var(--ink);
    border-radius: var(--radius);
    background: var(--sheet);
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }
  .rule {
    stroke: var(--rule);
    stroke-width: 1;
  }
  .tick {
    fill: var(--pencil);
    font-family: var(--font-num);
    font-weight: 600;
    font-stretch: 75%;
    font-size: 11px;
  }
  .line {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .dot {
    fill: var(--ink);
  }
  .pr {
    fill: none;
    stroke: var(--stamp);
    stroke-width: 2;
  }
  figcaption {
    display: flex;
    justify-content: space-between;
    margin-top: var(--s2);
  }
  .key {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--stamp);
  }
  .ring {
    width: 10px;
    height: 10px;
    border: 2px solid var(--stamp);
    border-radius: 50%;
  }
</style>
