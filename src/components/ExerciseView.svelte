<script lang="ts">
  // One exercise over time: best e1RM, heaviest set, the trend, and every session it was logged.
  // Bodyweight work tracks reps instead of kilos.
  import { bestText, chartPoints, exerciseSessions, exerciseStats, formatDate, formatKg, type HistoryData } from '../lib/history'
  import { formatLastTime, formatWeight } from '../lib/logic'
  import { toUnit } from '../lib/units'
  import { units } from '../lib/units.svelte'
  import ProgressChart from './ProgressChart.svelte'

  let {
    data,
    exerciseId,
    backLabel,
    onback,
    onsession,
  }: {
    data: HistoryData
    exerciseId: string
    backLabel: string
    onback: () => void
    /** Open a finished day. */
    onsession: (key: string) => void
  } = $props()

  const exercise = $derived(data.exercises.find((e) => e.id === exerciseId))
  const list = $derived(exerciseSessions(exerciseId, data))
  const st = $derived(exerciseStats(exerciseId, data))
  const u = $derived(units.current)
  // e1RM is stored in kilos: show it in the chosen unit
  const points = $derived(chartPoints(list).map((p) => (st.metric === 'reps' ? p : { ...p, value: toUnit(p.value, u) })))
  const reps = $derived(st.metric === 'reps')
</script>

<header class="head">
  <button type="button" class="link" onclick={onback}>{backLabel}</button>
  <h1 class="display">{exercise?.name ?? exerciseId}</h1>
  <p class="label">
    {st.sessions}
    {st.sessions === 1 ? 'session' : 'sessions'} · {st.sets}
    {st.sets === 1 ? 'set' : 'sets'} · {st.prs}
    {st.prs === 1 ? 'PR' : 'PRs'}
  </p>
</header>

{#if st.best}
  <dl class="stats">
    {#if reps}
      <div class="stat">
        <dt class="label">Best set</dt>
        <dd class="num">{st.best.value} <small>reps</small></dd>
      </div>
    {:else}
      <div class="stat">
        <dt class="label">Best e1RM</dt>
        <dd class="num">{formatWeight(st.best.value, u)} <small>{u}</small></dd>
      </div>
      <div class="stat">
        <dt class="label">Heaviest</dt>
        <dd class="num">{formatWeight(st.heaviest!.weightKg, u)} × {st.heaviest!.reps}</dd>
      </div>
    {/if}
    <div class="stat">
      <dt class="label">{reps ? 'Total reps' : 'Volume'}</dt>
      <dd class="num">
        {#if reps}{data.sets.filter((s) => s.exerciseId === exerciseId).reduce((n, s) => n + s.reps, 0)}{:else}{formatKg(toUnit(st.volumeKg, u))} <small>{u}</small>{/if}
      </dd>
    </div>
  </dl>

  {#if points.length > 1}
    <ProgressChart {points} unit={reps ? 'reps' : u} label={reps ? 'Best set' : 'Estimated 1-rep max'} />
  {:else}
    <p class="caption hint">Log it again to see a trend. {bestText(st, u)}.</p>
  {/if}
{/if}

<h2 class="label section">Sessions</h2>
<ul class="list">
  {#each list as s (s.key)}
    <li>
      <button type="button" class="row" disabled={!s.finished} onclick={() => onsession(s.key)}>
        <span class="line">
          <span class="name">{s.dayName}</span>
          <span class="label">{s.finished ? `${formatDate(s.date)} ›` : 'Today'}</span>
        </span>
        <span class="line">
          <span class="sets num">{formatLastTime(s.sets, u)}</span>
          {#if s.hasPR}<span class="pr" aria-label="PR">▲ PR</span>{/if}
        </span>
      </button>
    </li>
  {/each}
</ul>
<div class="end"></div>

<style>
  .head {
    margin: var(--s2) 0 var(--s4);
    display: grid;
    gap: var(--s2);
  }
  h1 {
    font-size: 38px;
    line-height: 1;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--s2);
    margin: 0 0 var(--s3);
  }
  /* Three tiles: the third (volume) takes a full row */
  .stat:last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }
  .stat {
    padding: var(--s3) var(--s2);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    display: grid;
    gap: var(--s1);
    min-width: 0;
  }
  dd {
    margin: 0;
    font-size: var(--fs-num);
    white-space: nowrap;
  }
  small {
    font-size: var(--fs-caption);
    color: var(--pencil);
  }
  .hint {
    padding: var(--s3);
    border: 1.5px dotted var(--pencil);
    border-radius: var(--radius);
  }
  .section {
    margin: var(--s5) 0 var(--s1);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .row {
    width: 100%;
    min-height: 64px;
    display: grid;
    align-content: center;
    gap: 4px;
    padding: var(--s2) 0;
    border-top: 1px solid var(--rule);
    text-align: left;
  }
  .row:disabled {
    cursor: default;
  }
  li:last-child .row {
    border-bottom: 1px solid var(--rule);
  }
  .line {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--s3);
  }
  .name {
    font-weight: 700;
  }
  .line .label {
    white-space: nowrap;
  }
  .sets {
    font-size: var(--fs-caption);
  }
  .pr {
    font-family: var(--font-display);
    font-size: var(--fs-badge);
    font-weight: 800;
    font-stretch: 75%;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--stamp);
    border: 2px solid var(--stamp);
    border-radius: 3px;
    padding: 1px 5px;
    transform: rotate(-6deg);
    white-space: nowrap;
  }
  .end {
    height: var(--s6);
  }
</style>
