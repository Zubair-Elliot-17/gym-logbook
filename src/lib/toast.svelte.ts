// Toasts (design review 5A/3A): one status toast at a time (Undo, 5 s) and save-failed alerts that
// stay until Retry or dismiss.

export interface Toast {
  id: number
  text: string
  kind: 'status' | 'alert'
  action?: { label: string; run: () => void }
}

let nextId = 1
const timers = new Map<number, ReturnType<typeof setTimeout>>()

class Toasts {
  items = $state<Toast[]>([])

  show(t: Omit<Toast, 'id'>, ms?: number): number {
    const id = nextId++
    // A new status toast replaces the old one; alerts stack.
    if (t.kind === 'status') this.items.filter((x) => x.kind === 'status').forEach((x) => this.dismiss(x.id))
    this.items.push({ ...t, id })
    if (ms) timers.set(id, setTimeout(() => this.dismiss(id), ms))
    return id
  }

  dismiss(id: number) {
    clearTimeout(timers.get(id))
    timers.delete(id)
    this.items = this.items.filter((x) => x.id !== id)
  }

  /** Undo toast: 5 s by default. */
  undo(text: string, run: () => void, ms = 5000) {
    return this.show({ kind: 'status', text, action: { label: 'Undo', run } }, ms)
  }
}

export const toasts = new Toasts()

/**
 * Run a write. The UI only renders committed rows, so on failure nothing changes on screen: show the
 * retry alert and return false.
 */
export async function attempt(write: () => Promise<unknown>, failText = 'Couldn’t save that set.'): Promise<boolean> {
  try {
    await write()
    return true
  } catch (e) {
    console.error(e)
    toasts.show({ kind: 'alert', text: failText, action: { label: 'Retry', run: () => void attempt(write, failText) } })
    return false
  }
}
