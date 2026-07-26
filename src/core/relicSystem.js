import {
  calculateFinalFrontRate,
  clampLuck
} from "./luckSystem.js"
import { RelicTrigger } from "../data/relics.js"

function cloneEffect(effect) {
  return { ...effect }
}

function scaleNumber(value, multiplier) {
  const scaled = Math.floor(Math.abs(value) * multiplier)
  const improved = Math.max(Math.abs(value) + 1, scaled)
  return Math.sign(value || 1) * improved
}

function boostNumericEffect(effect, multiplier) {
  const result = cloneEffect(effect)
  if (Number.isFinite(result.value)) {
    result.value = scaleNumber(result.value, multiplier)
  }
  if (result.type === "counter") {
    result.shield = scaleNumber(result.shield, multiplier)
    result.damage = scaleNumber(result.damage, multiplier)
    return result
  }
  for (const key of [
    "bonus",
    "damagePerHit",
    "damage",
    "heal",
    "shield",
    "luck"
  ]) {
    if (Number.isFinite(result[key])) {
      result[key] = scaleNumber(result[key], multiplier)
    }
  }
  return result
}

function comparableValue(effect) {
  if (["damage", "shield", "changeLuck"].includes(effect.type)) {
    return { category: effect.type, key: "value", value: effect.value }
  }
  if (effect.type === "counter") {
    return { category: "shield", key: "shield", value: effect.shield }
  }
  if (effect.type === "conditionalDamage") {
    return { category: "damage", key: "value", value: effect.value }
  }
  if (effect.type === "multiDamage") {
    return {
      category: "damage",
      key: "damagePerHit",
      value: effect.damagePerHit * effect.hits,
      divisor: effect.hits
    }
  }
  if (effect.type === "heal") {
    return { category: "heal", key: "value", value: effect.value }
  }
  if (["damageAndHeal", "selfCostDamage", "damageAndLuck"].includes(
    effect.type
  )) {
    return { category: "damage", key: "damage", value: effect.damage }
  }
  if (effect.type === "shieldAndLuck") {
    return { category: "shield", key: "shield", value: effect.shield }
  }
  return null
}

function balanceFaceEffect(coin, side, effect, ratio) {
  const current = comparableValue(effect)
  const oppositeEffect =
    side === "front" ? coin.backEffect : coin.frontEffect
  const opposite = comparableValue(oppositeEffect)
  if (
    !current ||
    !opposite ||
    current.category !== opposite.category ||
    current.value === opposite.value
  ) {
    return effect
  }

  const delta = Math.max(
    1,
    Math.round(Math.abs(current.value - opposite.value) * ratio)
  )
  const result = cloneEffect(effect)
  const balancedValue =
    current.value > opposite.value
      ? Math.max(0, current.value - delta)
      : current.value + delta
  result[current.key] = current.divisor
    ? Math.max(1, Math.round(balancedValue / current.divisor))
    : balancedValue
  return result
}

export class RelicSystem {
  #definitions
  #relicIds
  #bannedRelicIds
  #random
  #runtime

  constructor({
    relicDefinitions,
    relicIds = [],
    bannedRelicIds = [],
    random = Math.random
  }) {
    this.#definitions = relicDefinitions
    this.#relicIds = relicIds
    this.#bannedRelicIds = bannedRelicIds
    this.#random = random
    this.#runtime = {
      tossStreakSide: null,
      tossStreakCount: 0,
      triggeredOnce: new Set()
    }
  }

  trigger(trigger, context) {
    const result = {
      ...context,
      effect: context.effect ? cloneEffect(context.effect) : undefined,
      logs: [],
      counterDamage: 0,
      revived: false,
      directKill: false
    }

    for (const relicId of [...this.#relicIds]) {
      const relic = this.#definitions[relicId]
      if (!relic) {
        continue
      }
      for (const relicEffect of relic.effects) {
        if (relicEffect.trigger !== trigger) {
          continue
        }
        this.#applyOperation(relic, relicEffect, result)
      }
    }
    return result
  }

  getRelicIds() {
    return [...this.#relicIds]
  }

  getBannedRelicIds() {
    return [...this.#bannedRelicIds]
  }

  #applyOperation(relic, effect, context) {
    if (effect.operation === "ADD_MAX_COINS_ON_INTERVAL") {
      if (context.selectionCount % effect.interval === 0) {
        context.maxCoinsPerTurn += effect.value
        context.extraBetSources.push(relic.name)
        context.logs.push(`${relic.name}：本次选择可以追加下注`)
      }
      return
    }

    if (effect.operation === "ADD_DRAW_COUNT") {
      context.drawCount += effect.value
      context.logs.push(`${relic.name}：每回合额外抽取${effect.value}枚硬币`)
      return
    }

    if (effect.operation === "LOW_HP_ADD_LUCK") {
      if (context.player.hp / context.player.maxHp <= effect.threshold) {
        context.player.luck = clampLuck(context.player.luck + effect.value)
        context.logs.push(`${relic.name}：幸运+${effect.value}`)
      }
      return
    }

    if (effect.operation === "SHIFT_AWAY_FROM_STREAK") {
      if (
        Math.abs(context.luck) === 10 ||
        this.#runtime.tossStreakCount < 2
      ) {
        return
      }
      const shift = Math.min(
        (this.#runtime.tossStreakCount - 1) * effect.step,
        effect.max
      )
      context.rate +=
        this.#runtime.tossStreakSide === "front" ? -shift : shift
      context.rate = Math.min(1, Math.max(0, context.rate))
      context.logs.push(
        `${relic.name}：正面概率${shift >= 0 ? "修正" : ""}` +
        `${Math.round(shift * 100)}%`
      )
      return
    }

    if (effect.operation === "RECORD_TOSS_STREAK") {
      if (this.#runtime.tossStreakSide === context.side) {
        this.#runtime.tossStreakCount += 1
      } else {
        this.#runtime.tossStreakSide = context.side
        this.#runtime.tossStreakCount = 1
      }
      return
    }

    if (effect.operation === "NEGATE_LUCK_ON_ACQUIRE") {
      context.player.luck = clampLuck(-context.player.luck)
      context.logs.push(
        `${relic.name}：当前幸运变为${context.player.luck >= 0 ? "+" : ""}` +
        `${context.player.luck}`
      )
      return
    }

    if (effect.operation === "EXECUTE_BELOW_LUCK") {
      if (context.enemy.hp < context.player.luck) {
        context.enemy.hp = 0
        context.directKill = true
        context.logs.push(`${relic.name}：敌人生命低于幸运值，直接消灭`)
      }
      return
    }

    if (effect.operation === "HEAL_ON_BACK") {
      if (context.side === "back") {
        const before = context.player.hp
        context.player.hp = Math.min(
          context.player.maxHp,
          context.player.hp + effect.value
        )
        context.logs.push(
          `${relic.name}：恢复${context.player.hp - before}点生命`
        )
      }
      return
    }

    if (effect.operation === "LOW_HP_DAMAGE_MULTIPLIER") {
      if (context.player.hp / context.player.maxHp < effect.threshold) {
        context.damage = Math.floor(context.damage * effect.multiplier)
        context.logs.push(`${relic.name}：伤害提高50%`)
      }
      return
    }

    if (effect.operation === "BOOST_BACK_WHEN_UNLUCKY") {
      if (context.side === "back" && context.player.luck < 0) {
        context.effect = boostNumericEffect(
          context.effect,
          effect.multiplier
        )
        context.logs.push(`${relic.name}：反面数值效果提高20%`)
      }
      return
    }

    if (effect.operation === "BALANCE_COIN_FACES") {
      context.effect = balanceFaceEffect(
        context.coin,
        context.side,
        context.effect,
        effect.ratio
      )
      context.logs.push(`${relic.name}：正反面效果趋于均衡`)
      return
    }

    if (effect.operation === "FIRST_DAMAGE_ADD_LUCK") {
      const key = `${relic.id}:${effect.operation}`
      if (!this.#runtime.triggeredOnce.has(key)) {
        this.#runtime.triggeredOnce.add(key)
        context.player.luck = clampLuck(
          context.player.luck + effect.value
        )
        context.logs.push(`${relic.name}：幸运+${effect.value}`)
      }
      return
    }

    if (effect.operation === "COUNTER_DAMAGE") {
      context.counterDamage += effect.value
      context.logs.push(`${relic.name}：反击${effect.value}点伤害`)
      return
    }

    if (effect.operation === "ADD_MAX_HP_AND_HEAL") {
      context.player.maxHp += effect.value
      context.player.hp = Math.min(
        context.player.hp + effect.value,
        context.player.maxHp
      )
      context.logs.push(
        `${relic.name}：最大生命+${effect.value}，恢复${effect.value}点生命`
      )
      return
    }

    if (effect.operation === "REVIVE_COIN_TOSS") {
      const rate = calculateFinalFrontRate(
        effect.baseRate,
        context.player.luck
      )
      const isFront = this.#random() < rate
      this.#consumeAndBan(relic.id)
      context.revived = isFront
      context.reviveRate = rate
      if (isFront) {
        context.player.hp = effect.hp
      }
      context.logs.push(
        `${relic.name}：最终正面概率${Math.round(rate * 100)}%，` +
        `${isFront ? "正面，以1点生命复活" : "反面，复活失败"}`
      )
    }
  }

  #consumeAndBan(relicId) {
    const index = this.#relicIds.indexOf(relicId)
    if (index !== -1) {
      this.#relicIds.splice(index, 1)
    }
    if (!this.#bannedRelicIds.includes(relicId)) {
      this.#bannedRelicIds.push(relicId)
    }
  }
}

export { RelicTrigger }
