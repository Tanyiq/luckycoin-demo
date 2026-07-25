import { clamp } from "../utils/clamp.js"

export const HealthRecoverySource = Object.freeze({
  EVENT: "event",
  RELIC: "relic",
  COIN: "coin"
})

const allowedSources = new Set(Object.values(HealthRecoverySource))

export function recoverHealth(target, amount, source) {
  if (!allowedSources.has(source)) {
    throw new Error(`不允许的生命恢复来源：${source}`)
  }
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("生命恢复量必须是非负数")
  }
  const before = target.hp
  target.hp = clamp(target.hp + amount, 0, target.maxHp)
  return {
    source,
    requested: amount,
    recovered: target.hp - before,
    hp: target.hp
  }
}
