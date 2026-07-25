import { clamp } from "../utils/clamp.js"

export const MIN_LUCK = -10
export const MAX_LUCK = 10

export function clampLuck(luck) {
  return clamp(luck, MIN_LUCK, MAX_LUCK)
}

export function calculateFinalFrontRate(baseRate, luck) {
  const safeRate = clamp(baseRate, 0, 1)
  const safeLuck = clampLuck(luck)
  const t = Math.abs(safeLuck) / MAX_LUCK
  const smooth = 3 * t * t - 2 * t * t * t

  if (safeLuck >= 0) {
    return safeRate + (1 - safeRate) * smooth
  }
  return safeRate * (1 - smooth)
}
