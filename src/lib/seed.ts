// The split (cycle days) is fixed in code: edit it here and bump SEED_VERSION to change it.
// Exercises are the user's own data, chosen in the app (see catalog.ts); nothing here writes them.
// Day ids are stable slugs; never rename one that has logged history.

export const SEED_VERSION = 2

export type Equipment = 'barbell' | 'dumbbell' | 'machine'

export interface CycleDay {
  id: string
  order: number
  name: string
  type: 'lift' | 'rest'
  archived: boolean
}

export interface Exercise {
  id: string
  name: string
  stepKg: number
  /** Set when created; older rows fall back to the library entry (catalog.equipmentOf). */
  equipment?: Equipment
  /** Barbell lifts on a lighter bar (EZ, women's). Missing = the standard bar for your unit. */
  barKg?: number
}

export interface DayExercise {
  cycleDayId: string
  exerciseId: string
  order: number
  plannedSets: number
  // null = no working weight known yet: the ghost shows an empty weight
  // and tapping it opens the editor instead of logging.
  seedWeightKg: number | null
  seedReps: number
}

export function stepFor(equipment: Equipment): number {
  return equipment === 'dumbbell' ? 2 : 2.5
}

// First by order is where a fresh install starts.
export const cycleDays: CycleDay[] = [
  { id: 'upper', order: 1, name: 'Upper', type: 'lift', archived: false },
  { id: 'lower', order: 2, name: 'Lower', type: 'lift', archived: false },
  { id: 'active-rest', order: 3, name: 'Active rest', type: 'rest', archived: false },
  { id: 'recovery', order: 4, name: 'Recovery', type: 'rest', archived: false },
  { id: 'arms', order: 5, name: 'Arms', type: 'lift', archived: false },
  { id: 'back-chest', order: 6, name: 'Back & Chest', type: 'lift', archived: false },
]

// Quick-log chips on rest days: one tap logs the kind with its default minutes.
export const restActivities: { kind: string; minutes: number }[] = [
  { kind: 'Walk', minutes: 30 },
  { kind: 'Mobility', minutes: 15 },
  { kind: 'Sauna', minutes: 20 },
  { kind: 'Bike', minutes: 30 },
]
