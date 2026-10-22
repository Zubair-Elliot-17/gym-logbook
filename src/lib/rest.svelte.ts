// The running rest timer: one per app, started when a set is logged. The end time is kept in
// localStorage so it survives iOS killing the app between sets.

import { adjustEnd, secondsLeft } from './rest'

const KEY = 'gym-logbook:rest'
/** How long "Rest over" stays up before the row goes away. */
const OVER_MS = 4000

class RestTimer {
  endsAt = $state<number | null>(null)
  /** Length when started (plus adjustments): the progress bar's 100%. */
  total = $state(0)
  now = $state(Date.now())
  /** When it reached zero; "Rest over" shows for a moment after. */
  overAt = $state<number | null>(null)
  #tick: ReturnType<typeof setInterval> | undefined

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { endsAt: number; total: number } | null
      if (saved && saved.endsAt > Date.now()) {
        this.endsAt = saved.endsAt
        this.total = saved.total
        this.#run()
      }
    } catch {
      // No storage (private mode): the timer just won't survive a reload.
    }
  }

  get left(): number {
    return this.endsAt === null ? 0 : secondsLeft(this.endsAt, this.now)
  }

  get running(): boolean {
    return this.endsAt !== null
  }

  start(seconds: number) {
    if (seconds <= 0) return
    this.now = Date.now()
    this.endsAt = this.now + seconds * 1000
    this.total = seconds
    this.overAt = null
    this.#save()
    this.#run()
  }

  adjust(deltaSeconds: number) {
    if (this.endsAt === null) return
    this.now = Date.now()
    this.endsAt = adjustEnd(this.endsAt, this.now, deltaSeconds)
    this.total = Math.max(this.total + deltaSeconds, secondsLeft(this.endsAt, this.now), 1)
    this.#save()
    if (this.left === 0) this.#finish()
  }

  stop() {
    this.endsAt = null
    this.overAt = null
    clearInterval(this.#tick)
    this.#tick = undefined
    this.#save()
  }

  #run() {
    clearInterval(this.#tick)
    this.#tick = setInterval(() => {
      this.now = Date.now()
      if (this.endsAt !== null && this.left === 0) this.#finish()
      if (this.overAt !== null && this.now - this.overAt > OVER_MS) this.stop()
    }, 250)
  }

  #finish() {
    if (this.overAt !== null) return
    this.endsAt = null
    this.overAt = Date.now()
    this.#save()
    try {
      navigator.vibrate?.([200, 100, 200])
    } catch {
      // Not supported (iOS): the row still turns to "Rest over".
    }
  }

  #save() {
    try {
      if (this.endsAt === null) localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, JSON.stringify({ endsAt: this.endsAt, total: this.total }))
    } catch {
      // See constructor.
    }
  }
}

export const rest = new RestTimer()
