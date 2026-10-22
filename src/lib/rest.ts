// Rest timer rules: pure, so they're tested without a clock. The running timer is rest.svelte.ts.

/** Choices in Settings, in seconds. 0 = off. */
export const REST_CHOICES = [0, 60, 90, 120, 180, 240]

/** Installs from before the setting existed get the default. */
export const DEFAULT_REST_SECONDS = 90

export function restSecondsOf(state: { restSeconds?: number }): number {
  return state.restSeconds ?? DEFAULT_REST_SECONDS
}

/** Whole seconds left, never negative; rounds up so "0:00" only shows once it's over. */
export function secondsLeft(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000))
}

/** 83 → "1:23", 5 → "0:05". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Settings label: "Off", "1:30". */
export function restLabel(seconds: number): string {
  return seconds === 0 ? 'Off' : formatClock(seconds)
}

/** Move the end by delta seconds, never into the past. */
export function adjustEnd(endsAt: number, now: number, deltaSeconds: number): number {
  return Math.max(now, endsAt + deltaSeconds * 1000)
}
