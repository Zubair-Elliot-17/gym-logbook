// Plate maths for barbell lifts: what goes on each side of the bar. Pure, so it's tested directly.

/** A standard Olympic bar. */
export const BAR_KG = 20

/** Plates a typical gym has, heaviest first. */
export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]

export interface PlateLoad {
  /** Plates for one side, heaviest first. */
  perSide: number[]
  /** Kilos the plates can't make (per bar, not per side): 0 when exact. */
  shortKg: number
}

/**
 * Greedy load for one side: (total − bar) / 2, heaviest plate first. Returns null when the weight is
 * the bar or less, since there's nothing to load. Works in grams so 1.25s add up exactly.
 */
export function plateLoad(totalKg: number, barKg = BAR_KG, plates = PLATES_KG): PlateLoad | null {
  if (!Number.isFinite(totalKg) || totalKg <= barKg) return null
  let leftG = Math.round(((totalKg - barKg) / 2) * 1000)
  const perSide: number[] = []
  for (const p of plates) {
    const g = Math.round(p * 1000)
    while (leftG >= g) {
      perSide.push(p)
      leftG -= g
    }
  }
  return { perSide, shortKg: (leftG * 2) / 1000 }
}

/** "20 + 10 + 2.5 a side", with repeats grouped: "2 × 20 + 5 a side". */
export function formatPlates(load: PlateLoad): string {
  const groups: [number, number][] = []
  for (const p of load.perSide) {
    const last = groups.at(-1)
    if (last && last[0] === p) last[1]++
    else groups.push([p, 1])
  }
  const text = groups.map(([p, n]) => (n > 1 ? `${n} × ${p}` : String(p))).join(' + ')
  return load.shortKg > 0 ? `${text} a side (${load.shortKg} kg short)` : `${text} a side`
}
