<script lang="ts">
  // Wireframe 5: toasts sit above the Finish bar. Undo = solid border, status; save failed = dashed, alert.
  import { toasts } from '../lib/toast.svelte'
</script>

<div class="toasts">
  {#each toasts.items as t (t.id)}
    <div class="toast {t.kind}" role={t.kind === 'alert' ? 'alert' : 'status'}>
      <span>{t.text}</span>
      {#if t.action}
        <button
          type="button"
          class="action"
          onclick={() => {
            toasts.dismiss(t.id)
            t.action!.run()
          }}>{t.action.label}</button
        >
      {/if}
      {#if t.kind === 'alert'}
        <button type="button" class="close" aria-label="Dismiss" onclick={() => toasts.dismiss(t.id)}>×</button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(var(--bar-h) + env(safe-area-inset-bottom) + var(--s2));
    max-width: 480px;
    margin: 0 auto;
    padding: 0 var(--s4);
    display: grid;
    gap: var(--s2);
    z-index: 10;
    pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: var(--s3);
    min-height: var(--tap);
    padding: 0 var(--s2) 0 var(--s4);
    background: var(--sheet);
    border: 2px solid var(--ink);
    border-radius: var(--radius);
  }
  .toast.alert {
    border-style: dashed;
  }
  .toast span {
    flex: 1;
  }
  .action {
    font-weight: 700;
    min-height: var(--tap);
    padding: 0 var(--s3);
  }
  .close {
    min-width: var(--tap);
    min-height: var(--tap);
    font-size: 20px;
  }
</style>
