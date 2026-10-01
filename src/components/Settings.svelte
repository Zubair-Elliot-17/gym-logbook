<script lang="ts">
  // Wireframe 8: status notices on top, then Export / Import / Restore snapshot / Go back a day /
  // Install / Update.
  import { onMount } from 'svelte'
  import {
    ImportError,
    backupOverdue,
    hasSnapshot,
    importBackup,
    parseBackup,
    recordExport,
    restoreSnapshot,
    shareExport,
    type BackupFile,
  } from '../lib/backup'
  import { goBackDay, type LogbookDB } from '../lib/db'
  import { daysAgo, lastFinish, type TodayData } from '../lib/today'
  import { attempt, toasts } from '../lib/toast.svelte'
  import Sheet from './Sheet.svelte'

  let {
    db,
    data,
    standalone,
    offlineReady,
    updateReady,
    onupdate,
    onclose,
  }: {
    db: LogbookDB
    data: TodayData
    standalone: boolean
    offlineReady: boolean
    updateReady: boolean
    onupdate: () => void
    onclose: () => void
  } = $props()

  let snapshot = $state(false)
  let reading = $state(false)
  let importError = $state('')
  let download = $state<{ url: string; name: string } | null>(null)
  let sheet = $state<'import' | 'restore' | 'goback' | 'install' | null>(null)
  let pending = $state.raw<BackupFile | null>(null)
  let fileInput: HTMLInputElement

  const finish = $derived(lastFinish(data))
  const lastExport = $derived(data.state.lastExportAt)
  const overdue = $derived(backupOverdue(data.state))

  const refreshSnapshot = async () => (snapshot = await hasSnapshot(db))
  onMount(() => {
    void refreshSnapshot()
    return () => download && URL.revokeObjectURL(download.url)
  })

  async function exportNow() {
    try {
      const r = await shareExport(db)
      if (r.status === 'shared') toasts.show({ kind: 'status', text: 'Backup saved' }, 4000)
      if (r.status === 'download') {
        if (download) URL.revokeObjectURL(download.url)
        download = { url: URL.createObjectURL(r.file), name: r.file.name }
      }
    } catch (e) {
      console.error(e)
      toasts.show({ kind: 'alert', text: 'Couldn’t export.', action: { label: 'Retry', run: exportNow } })
    }
  }

  async function pickFile() {
    const file = fileInput.files?.[0]
    fileInput.value = ''
    if (!file) return
    importError = ''
    reading = true
    try {
      pending = parseBackup(await file.text())
      sheet = 'import'
    } catch (e) {
      importError = e instanceof ImportError ? `${e.message}. Nothing changed.` : 'That file couldn’t be read. Nothing changed.'
    } finally {
      reading = false
    }
  }

  async function confirmImport() {
    const file = pending
    sheet = null
    pending = null
    if (!file) return
    let sets = 0
    const ok = await attempt(async () => {
      sets = (await importBackup(db, file)).sets
    }, 'Couldn’t import. Nothing changed.')
    if (ok) {
      toasts.show({ kind: 'status', text: `Restored ${sets} ${sets === 1 ? 'set' : 'sets'}` }, 4000)
      await refreshSnapshot()
    }
  }

  async function confirmRestore() {
    sheet = null
    let sets = 0
    const ok = await attempt(async () => {
      sets = (await restoreSnapshot(db)).sets
    }, 'Couldn’t restore the snapshot.')
    if (ok) toasts.show({ kind: 'status', text: `Restored ${sets} ${sets === 1 ? 'set' : 'sets'} from before the import` }, 4000)
  }

  async function confirmGoBack() {
    sheet = null
    const name = finish?.dayName
    if (await attempt(() => goBackDay(db), 'Couldn’t go back a day.')) {
      toasts.show({ kind: 'status', text: `Back on ${name}` }, 4000)
      onclose()
    }
  }

  const fmtDate = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'an unknown date'
</script>

<header class="head">
  <button type="button" class="link back" onclick={onclose}>‹ Today</button>
  <h1 class="display">Settings</h1>
</header>

<div class="notices">
  <p class="notice" class:ok={offlineReady}>
    {offlineReady ? '✓ Ready offline' : 'Not ready offline yet: open once with signal'}
  </p>
  <p class="notice" class:warn={overdue}>
    {lastExport ? `Last backup: ${daysAgo(lastExport)}.` : 'No backup yet.'}
    <button type="button" class="inline" onclick={exportNow}>Export now</button>
  </p>
  {#if !standalone}
    <p class="notice warn">Not installed yet. Data logged in a browser tab won’t carry over to the home-screen app.</p>
  {/if}
  {#if download}
    <p class="notice">
      <a href={download.url} download={download.name} onclick={() => void recordExport(db)}>Save {download.name}</a>
    </p>
  {/if}
  {#if importError}
    <p class="notice warn" role="alert">{importError}</p>
  {/if}
</div>

<ul class="list">
  {#if updateReady}
    <li><button type="button" class="row strong" onclick={onupdate}><span>Update the app</span><span>›</span></button></li>
  {/if}
  <li><button type="button" class="row" onclick={exportNow}><span>Export backup</span><span>›</span></button></li>
  <li>
    <button type="button" class="row" disabled={reading} onclick={() => fileInput.click()}>
      <span>{reading ? 'Reading backup…' : 'Import backup'}</span><span>›</span>
    </button>
    <input bind:this={fileInput} class="visually-hidden" type="file" accept="application/json,.json" tabindex="-1" onchange={pickFile} />
  </li>
  <li>
    <button type="button" class="row" disabled={!snapshot} onclick={() => (sheet = 'restore')}>
      <span>Restore pre-import snapshot</span><span>›</span>
    </button>
  </li>
  <li>
    <button type="button" class="row" disabled={!finish} onclick={() => (sheet = 'goback')}>
      <span>Go back a day</span>
      <span class="caption">{finish ? `undo “Finish ${finish.dayName}”` : 'nothing to undo'}</span>
    </button>
  </li>
  <li><button type="button" class="row" onclick={() => (sheet = 'install')}><span>Install to Home Screen</span><span>›</span></button></li>
</ul>

{#if sheet === 'import' && pending}
  <Sheet title="Replace all data?" onclose={() => (sheet = null)}>
    <p>
      Replace everything with the backup from {fmtDate(pending.exportedAt)} ({pending.set.length}
      {pending.set.length === 1 ? 'set' : 'sets'})? Your current data is saved as a snapshot first.
    </p>
    <button type="button" class="btn primary danger" onclick={confirmImport}>Replace</button>
    <button type="button" class="btn" onclick={() => (sheet = null)}>Cancel</button>
  </Sheet>
{:else if sheet === 'restore'}
  <Sheet title="Restore the snapshot?" onclose={() => (sheet = null)}>
    <p>This puts back your data from just before the last import, replacing what’s here now.</p>
    <button type="button" class="btn primary danger" onclick={confirmRestore}>Restore</button>
    <button type="button" class="btn" onclick={() => (sheet = null)}>Cancel</button>
  </Sheet>
{:else if sheet === 'goback' && finish}
  <Sheet title="Undo “Finish {finish.dayName}”?" onclose={() => (sheet = null)}>
    <p>{finish.dayName} becomes today again. Sets and activities you logged stay where they are.</p>
    <button type="button" class="btn primary" onclick={confirmGoBack}>Go back to {finish.dayName}</button>
    <button type="button" class="btn" onclick={() => (sheet = null)}>Cancel</button>
  </Sheet>
{:else if sheet === 'install'}
  <Sheet title="Install to Home Screen" onclose={() => (sheet = null)}>
    <ol class="steps">
      <li>Open this page in <strong>Safari</strong> on your iPhone.</li>
      <li>Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</li>
      <li>Open <strong>Logbook</strong> from your home screen and log from there.</li>
    </ol>
    <p class="caption">The home-screen app keeps its own data, separate from Safari tabs. Export a backup now and then.</p>
    <button type="button" class="btn" onclick={() => (sheet = null)}>Done</button>
  </Sheet>
{/if}

<style>
  .head {
    margin: var(--s3) 0 var(--s4);
  }
  .back {
    margin-left: calc(-1 * var(--s1));
  }
  h1 {
    font-size: var(--fs-day);
    margin-top: var(--s2);
  }
  .notices {
    display: grid;
    gap: var(--s2);
    margin-bottom: var(--s4);
  }
  .notice {
    border: 1.5px dotted var(--pencil);
    border-radius: var(--radius);
    padding: var(--s3);
    font-size: var(--fs-caption);
  }
  .notice.ok {
    border: 1.5px solid var(--ink);
  }
  .notice.warn {
    border: 1.5px dashed var(--ink);
  }
  .notice a,
  .inline {
    color: var(--ink);
    text-decoration: underline;
    text-underline-offset: 3px;
    font-size: inherit;
  }
  .list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .row {
    width: 100%;
    min-height: 52px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--s3);
    border-bottom: 1px solid var(--rule);
    text-align: left;
  }
  .row:disabled {
    color: var(--pencil);
    cursor: default;
  }
  .row.strong {
    font-weight: 700;
  }
  .steps {
    margin: 0;
    padding-left: 1.2em;
    display: grid;
    gap: var(--s2);
  }
</style>
