// Service worker registration (registerType: 'prompt'): an update is never applied on its own,
// so a deploy can't land mid-workout. The UI offers it in Settings and once after a Finish (5A).

import { useRegisterSW } from 'virtual:pwa-register/svelte'
import { derived, writable } from 'svelte/store'

const sw = useRegisterSW({ immediate: true })

export const needRefresh = sw.needRefresh
export const updateApp = () => sw.updateServiceWorker(true)

// Ready offline = the precache finished this session, or a service worker already controls the page.
const controlled = writable(typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller)
navigator.serviceWorker?.addEventListener('controllerchange', () => controlled.set(true))
export const offlineReady = derived([sw.offlineReady, controlled], ([ready, ctl]) => ready || ctl)

/** Running from the home screen (Safari's storage-eviction exemption only applies there). */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
