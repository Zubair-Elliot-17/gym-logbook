// The weight unit every screen shows and takes. App keeps it in step with state.units.

import type { Unit } from './units'

class Units {
  current = $state<Unit>('kg')
}

export const units = new Units()
