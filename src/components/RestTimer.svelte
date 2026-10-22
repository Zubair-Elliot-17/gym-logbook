<script lang="ts">
  // Rest timer row in the Finish bar: "REST 1:23 [−15] [+15] [Skip]" over a draining ink rule.
  // At zero it stamps "Rest over" (and buzzes where the phone allows), then goes away.
  // While shown it lifts toasts by its height (--rest-h) so they never cover it.
  import { formatClock } from '../lib/rest'
  import { rest } from '../lib/rest.svelte'

  const shown = $derived(rest.running || rest.overAt !== null)
  const fraction = $derived(rest.running && rest.total > 0 ? rest.left / rest.total : 0)

  $effect(() => {
    document.documentElement.style.setProperty('--rest-h', shown ? '64px' : '0px')
    return () => document.documentElement.style.setProperty('--rest-h', '0px')
  })
</script>

{#if shown}
  <div class="rest" class:over={!rest.running}>
    {#if rest.running}
      <p class="clock" role="timer" aria-label="Rest, {rest.left} seconds left">
        <span class="label">Rest</span>
        <span class="num time" aria-hidden="true">{formatClock(rest.left)}</span>
      </p>
      <div class="tools">
        <button type="button" class="tool num" aria-label="15 seconds less" onclick={() => rest.adjust(-15)}>−15</button>
        <button type="button" class="tool num" aria-label="15 seconds more" onclick={() => rest.adjust(15)}>+15</button>
        <button type="button" class="tool skip" onclick={() => rest.stop()}>Skip</button>
      </div>
      <div class="drain" aria-hidden="true"><span style:transform="scaleX({fraction})"></span></div>
    {:else}
      <p class="done display" role="status">Rest over · next set</p>
      <button type="button" class="tool skip" onclick={() => rest.stop()}>OK</button>
    {/if}
  </div>
{/if}

<style>
  .rest {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--s2);
    min-height: 56px;
    margin-bottom: var(--s2);
    padding: 0 var(--s2) 0 var(--s3);
    background: var(--sheet);
    border: 2px solid var(--ink);
    border-radius: var(--radius);
    overflow: hidden;
  }
  /* Over: an inked stamp, like a logged set */
  .rest.over {
    background: var(--ink);
    color: var(--paper);
    box-shadow:
      inset 0 0 0 3px var(--ink),
      inset 0 0 0 4px var(--paper);
    animation: stamp 120ms var(--ease-out);
  }
  @keyframes stamp {
    from {
      transform: scale(0.96);
    }
  }
  .clock {
    display: flex;
    align-items: baseline;
    gap: var(--s2);
  }
  .time {
    font-size: 26px;
    min-width: 3.2ch;
  }
  .tools {
    display: flex;
    gap: var(--s1);
  }
  .tool {
    min-width: var(--tap);
    min-height: 40px;
    padding: 0 var(--s2);
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    font-size: 15px;
  }
  .skip {
    font-weight: 700;
  }
  .over .tool {
    border-color: var(--paper);
  }
  .done {
    font-size: 20px;
    letter-spacing: 0.04em;
  }
  .drain {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    background: var(--rule);
  }
  .drain span {
    display: block;
    height: 100%;
    background: var(--ink);
    transform-origin: left;
    transition: transform 250ms linear;
  }
  @media (prefers-reduced-motion: reduce) {
    .rest.over {
      animation: none;
    }
    .drain span {
      transition: none;
    }
  }
</style>
