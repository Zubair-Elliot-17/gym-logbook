// kg / lb. Everything is stored in kilos; these convert only for showing and typing weights.
// lb shows to 0.1 and kg is stored to 4 decimals, so a typed 135 lb always reads back as 135 and two
// 135 lb sets are the same number (PRs compare equal).

export type Unit = 'kg' | 'lb'

export const LB_PER_KG = 2.20462262

/** Kilos in the chosen unit, rounded for display (kg to 0.01, lb to 0.1). */
export function toUnit(kg: number, unit: Unit): number {
  if (unit === 'kg') return kg
  return Math.round(kg * LB_PER_KG * 10) / 10
}

/** A typed weight in the chosen unit, as stored kilos. */
export function fromUnit(value: number, unit: Unit): number {
  if (unit === 'kg') return Math.round(value * 100) / 100
  return Math.round((value / LB_PER_KG) * 10000) / 10000
}

/** −/+ step in the chosen unit: kg keeps the exercise's step; lb uses 5 (2.5 for micro steps). */
export function stepIn(stepKg: number, unit: Unit): number {
  if (unit === 'kg') return stepKg
  return stepKg >= 2 ? 5 : 2.5
}

/** Move a stored weight by n steps in the chosen unit, never below 0. Returns kilos. */
export function stepWeight(kg: number, stepKg: number, dir: number, unit: Unit): number {
  const shown = toUnit(kg, unit)
  return fromUnit(Math.max(0, Math.round((shown + dir * stepIn(stepKg, unit)) * 100) / 100), unit)
}

/** Read aloud: "kilos" / "pounds". */
export const spokenUnit = (unit: Unit) => (unit === 'kg' ? 'kilos' : 'pounds')

/** Bar and plates for the plate calculator, in the chosen unit. */
export function barAndPlates(unit: Unit): { bar: number; plates: number[] } {
  return unit === 'kg' ? { bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] } : { bar: 45, plates: [45, 35, 25, 10, 5, 2.5] }
}
