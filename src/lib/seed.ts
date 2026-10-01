// The training plan. In v1 this file is the only way to change the plan:
// edit it, bump SEED_VERSION, add a matching Dexie upgrade in db.ts, redeploy.
// Ids are stable slugs; never rename one that has logged history.
// Ad-hoc exercises created in the app use `custom-<uuid>`, so seed ids must not start with "custom-".

export const SEED_VERSION = 1

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

type PlanRow = [id: string, name: string, equipment: Equipment, sets: number, reps: number]

const plan: Record<string, PlanRow[]> = {
  upper: [
    ['bench-press', 'Bench press', 'barbell', 3, 8],
    ['bent-over-row', 'Bent-over row', 'barbell', 3, 8],
    ['overhead-press', 'Overhead press', 'barbell', 3, 8],
    ['lat-pulldown', 'Lat pulldown', 'machine', 3, 10],
    ['lateral-raise', 'Lateral raise', 'dumbbell', 3, 12],
  ],
  lower: [
    ['back-squat', 'Back squat', 'barbell', 3, 6],
    ['romanian-deadlift', 'Romanian deadlift', 'barbell', 3, 8],
    ['leg-press', 'Leg press', 'machine', 3, 10],
    ['leg-curl', 'Leg curl', 'machine', 3, 12],
    ['standing-calf-raise', 'Standing calf raise', 'machine', 3, 12],
  ],
  arms: [
    ['barbell-curl', 'Barbell curl', 'barbell', 3, 10],
    ['close-grip-bench-press', 'Close-grip bench press', 'barbell', 3, 8],
    ['hammer-curl', 'Hammer curl', 'dumbbell', 3, 12],
    ['triceps-pushdown', 'Triceps pushdown', 'machine', 3, 12],
    ['overhead-triceps-extension', 'Overhead triceps extension', 'dumbbell', 3, 12],
  ],
  'back-chest': [
    ['deadlift', 'Deadlift', 'barbell', 3, 5],
    ['incline-dumbbell-press', 'Incline dumbbell press', 'dumbbell', 3, 10],
    ['seated-cable-row', 'Seated cable row', 'machine', 3, 10],
    ['cable-fly', 'Cable fly / pec deck', 'machine', 3, 12],
    // Weight 0 = bodyweight; use the assist weight if on the machine.
    ['pull-up', 'Pull-up', 'machine', 3, 8],
  ],
}

export const exercises: Exercise[] = Object.values(plan)
  .flat()
  .map(([id, name, equipment]) => ({ id, name, stepKg: stepFor(equipment) }))

export const dayExercises: DayExercise[] = Object.entries(plan).flatMap(([cycleDayId, rows]) =>
  rows.map(([exerciseId, , , plannedSets, seedReps], i) => ({
    cycleDayId,
    exerciseId,
    order: i + 1,
    plannedSets,
    seedWeightKg: null,
    seedReps,
  })),
)

// Quick-log chips on rest days: one tap logs the kind with its default minutes.
export const restActivities: { kind: string; minutes: number }[] = [
  { kind: 'Walk', minutes: 30 },
  { kind: 'Mobility', minutes: 15 },
  { kind: 'Sauna', minutes: 20 },
  { kind: 'Bike', minutes: 30 },
]
