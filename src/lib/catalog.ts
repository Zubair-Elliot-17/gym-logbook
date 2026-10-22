// The exercise library shown in "Add exercise": common lifts grouped by muscle. Static, not stored:
// picking one creates its exercise row. Ids are stable slugs (some match the v1 seed, so history lines
// up); typed-in exercises use `custom-<uuid>` and never collide.

import type { Equipment } from './seed'

export type Muscle = 'Chest' | 'Back' | 'Shoulders' | 'Biceps' | 'Triceps' | 'Legs' | 'Glutes' | 'Core'

export interface CatalogEntry {
  id: string
  name: string
  muscle: Muscle
  equipment: Equipment
  /** Default reps when added to a day. */
  reps: number
}

export const MUSCLES: Muscle[] = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Glutes', 'Core']

const e = (id: string, name: string, muscle: Muscle, equipment: Equipment, reps = 10): CatalogEntry => ({
  id,
  name,
  muscle,
  equipment,
  reps,
})

export const CATALOG: CatalogEntry[] = [
  e('bench-press', 'Bench press', 'Chest', 'barbell', 8),
  e('incline-bench-press', 'Incline bench press', 'Chest', 'barbell', 8),
  e('dumbbell-bench-press', 'Dumbbell bench press', 'Chest', 'dumbbell'),
  e('incline-dumbbell-press', 'Incline dumbbell press', 'Chest', 'dumbbell'),
  e('chest-press-machine', 'Chest press machine', 'Chest', 'machine'),
  e('cable-fly', 'Cable fly / pec deck', 'Chest', 'machine', 12),
  e('dumbbell-fly', 'Dumbbell fly', 'Chest', 'dumbbell', 12),
  e('dips', 'Dips', 'Chest', 'machine', 10),
  e('push-up', 'Push-up', 'Chest', 'machine', 15),

  e('deadlift', 'Deadlift', 'Back', 'barbell', 5),
  e('bent-over-row', 'Bent-over row', 'Back', 'barbell', 8),
  e('pull-up', 'Pull-up', 'Back', 'machine', 8),
  e('chin-up', 'Chin-up', 'Back', 'machine', 8),
  e('lat-pulldown', 'Lat pulldown', 'Back', 'machine'),
  e('seated-cable-row', 'Seated cable row', 'Back', 'machine'),
  e('one-arm-dumbbell-row', 'One-arm dumbbell row', 'Back', 'dumbbell'),
  e('t-bar-row', 'T-bar row', 'Back', 'barbell', 8),
  e('straight-arm-pulldown', 'Straight-arm pulldown', 'Back', 'machine', 12),
  e('shrug', 'Shrug', 'Back', 'dumbbell', 12),

  e('overhead-press', 'Overhead press', 'Shoulders', 'barbell', 8),
  e('dumbbell-shoulder-press', 'Dumbbell shoulder press', 'Shoulders', 'dumbbell'),
  e('lateral-raise', 'Lateral raise', 'Shoulders', 'dumbbell', 12),
  e('cable-lateral-raise', 'Cable lateral raise', 'Shoulders', 'machine', 12),
  e('rear-delt-fly', 'Rear delt fly', 'Shoulders', 'dumbbell', 12),
  e('face-pull', 'Face pull', 'Shoulders', 'machine', 12),
  e('arnold-press', 'Arnold press', 'Shoulders', 'dumbbell'),

  e('barbell-curl', 'Barbell curl', 'Biceps', 'barbell'),
  e('dumbbell-curl', 'Dumbbell curl', 'Biceps', 'dumbbell'),
  e('hammer-curl', 'Hammer curl', 'Biceps', 'dumbbell', 12),
  e('incline-dumbbell-curl', 'Incline dumbbell curl', 'Biceps', 'dumbbell'),
  e('preacher-curl', 'Preacher curl', 'Biceps', 'machine'),
  e('cable-curl', 'Cable curl', 'Biceps', 'machine', 12),

  e('close-grip-bench-press', 'Close-grip bench press', 'Triceps', 'barbell', 8),
  e('triceps-pushdown', 'Triceps pushdown', 'Triceps', 'machine', 12),
  e('overhead-triceps-extension', 'Overhead triceps extension', 'Triceps', 'dumbbell', 12),
  e('skull-crusher', 'Skull crusher', 'Triceps', 'barbell'),
  e('triceps-dip-machine', 'Triceps dip machine', 'Triceps', 'machine'),

  e('back-squat', 'Back squat', 'Legs', 'barbell', 6),
  e('front-squat', 'Front squat', 'Legs', 'barbell', 6),
  e('leg-press', 'Leg press', 'Legs', 'machine'),
  e('hack-squat', 'Hack squat', 'Legs', 'machine', 8),
  e('romanian-deadlift', 'Romanian deadlift', 'Legs', 'barbell', 8),
  e('bulgarian-split-squat', 'Bulgarian split squat', 'Legs', 'dumbbell'),
  e('walking-lunge', 'Walking lunge', 'Legs', 'dumbbell', 12),
  e('leg-extension', 'Leg extension', 'Legs', 'machine', 12),
  e('leg-curl', 'Leg curl', 'Legs', 'machine', 12),
  e('standing-calf-raise', 'Standing calf raise', 'Legs', 'machine', 12),
  e('seated-calf-raise', 'Seated calf raise', 'Legs', 'machine', 15),

  e('hip-thrust', 'Hip thrust', 'Glutes', 'barbell'),
  e('glute-bridge', 'Glute bridge', 'Glutes', 'barbell', 12),
  e('cable-kickback', 'Cable kickback', 'Glutes', 'machine', 12),
  e('hip-abduction', 'Hip abduction machine', 'Glutes', 'machine', 15),

  e('plank', 'Plank (seconds as reps)', 'Core', 'machine', 45),
  e('cable-crunch', 'Cable crunch', 'Core', 'machine', 12),
  e('hanging-leg-raise', 'Hanging leg raise', 'Core', 'machine', 12),
  e('ab-wheel', 'Ab wheel rollout', 'Core', 'machine', 10),
  e('russian-twist', 'Russian twist', 'Core', 'dumbbell', 20),
]

/** Muscle groups the library opens on for each day of the (fixed) split; other groups follow. */
const DAY_MUSCLES: Record<string, Muscle[]> = {
  upper: ['Chest', 'Back', 'Shoulders'],
  lower: ['Legs', 'Glutes', 'Core'],
  arms: ['Biceps', 'Triceps'],
  'back-chest': ['Back', 'Chest'],
}

export function musclesFor(cycleDayId: string): Muscle[] {
  const first = DAY_MUSCLES[cycleDayId] ?? []
  return [...first, ...MUSCLES.filter((m) => !first.includes(m))]
}

const byId = new Map(CATALOG.map((c) => [c.id, c]))
const byName = new Map(CATALOG.map((c) => [c.name.toLowerCase(), c]))

export const catalogEntry = (id: string) => byId.get(id)

/** An exercise's equipment: its own, or its library entry's for rows saved before it was stored. */
export const equipmentOf = (ex: { id: string; equipment?: Equipment }): Equipment | undefined =>
  ex.equipment ?? byId.get(ex.id)?.equipment
export const catalogByName = (name: string) => byName.get(name.trim().toLowerCase())
