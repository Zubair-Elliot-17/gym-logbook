<script lang="ts">
  // Bottom sheet (13A, 12A): role=dialog, focus to the title on open and back on close,
  // follows visualViewport so the iOS keyboard never covers the action button.
  import { onMount, type Snippet } from 'svelte'

  let {
    title,
    subtitle = '',
    onclose,
    children,
  }: { title: string; subtitle?: string; onclose: () => void; children: Snippet } = $props()

  const id = `sheet-${Math.random().toString(36).slice(2, 8)}`
  let titleEl: HTMLHeadingElement
  let inset = $state(0)

  onMount(() => {
    const previous = document.activeElement as HTMLElement | null
    titleEl.focus()
    const vv = window.visualViewport
    const update = () => {
      if (vv) inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onclose()
    }
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    window.addEventListener('keydown', onKey)
    update()
    return () => {
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  })
</script>

<button class="backdrop" tabindex="-1" aria-hidden="true" onclick={onclose}></button>
<div class="sheet" role="dialog" aria-modal="true" aria-labelledby={id} style:bottom="{inset}px">
  <div class="grip" aria-hidden="true"></div>
  <h2 {id} class="display" tabindex="-1" bind:this={titleEl}>{title}</h2>
  {#if subtitle}<p class="caption">{subtitle}</p>{/if}
  <div class="body">
    {@render children()}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--ink) 38%, transparent);
    z-index: 20;
    cursor: default;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    max-width: 480px;
    margin: 0 auto;
    background: var(--sheet);
    border-top: 2px solid var(--ink);
    border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
    padding: var(--s3) var(--s4) calc(var(--s4) + env(safe-area-inset-bottom));
    z-index: 21;
    max-height: 85dvh;
    overflow-y: auto;
  }
  .grip {
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: var(--rule);
    margin: 0 auto var(--s3);
  }
  h2 {
    font-size: 24px;
    outline: none;
  }
  .body {
    display: grid;
    gap: var(--s3);
    margin-top: var(--s4);
  }
</style>
