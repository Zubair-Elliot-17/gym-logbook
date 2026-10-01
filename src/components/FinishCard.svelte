<script lang="ts">
  // 6A: "<Day> done · N sets · K PRs" with up to 3 PRs. Auto-advances after 2 s or on tap; carries Undo.
  import { onMount } from 'svelte'
  import type { FinishSummary } from '../lib/today'

  let { summary, onundo, ondone }: { summary: FinishSummary; onundo: () => void; ondone: () => void } = $props()

  onMount(() => {
    const t = setTimeout(ondone, 2000)
    return () => clearTimeout(t)
  })
</script>

<div class="overlay" role="status">
  <button type="button" class="card" onclick={ondone} aria-label="{summary.title}. Tap to continue.">
    <span class="title">{summary.title}</span>
    {#each summary.lines as line (line)}
      <span class="line num">{line}</span>
    {/each}
  </button>
  <button type="button" class="btn undo" onclick={onundo}>Undo</button>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: grid;
    place-content: center;
    gap: var(--s3);
    padding: var(--s4);
    background: color-mix(in srgb, var(--paper) 85%, transparent);
    animation: in 180ms ease-out;
  }
  .card {
    min-width: min(360px, 90vw);
    display: grid;
    gap: var(--s2);
    padding: var(--s5);
    border: 2px solid var(--ink);
    border-radius: var(--radius);
    background: var(--paper);
    text-align: left;
  }
  .title {
    font-size: 20px;
    font-weight: 600;
  }
  .line {
    font-size: var(--fs-num);
    color: var(--accent);
  }
  .undo {
    justify-self: center;
  }
  @keyframes in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .overlay {
      animation: none;
    }
  }
</style>
