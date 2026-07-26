function resolveEffect(effect, enemy) {
  if (effect.type === "damagePlayer" && effect.valueFrom === "attack") {
    return {
      ...effect,
      value: enemy.attack + enemy.attackBonus + (effect.bonus ?? 0)
    }
  }
  if (effect.type === "conditionalDamagePlayer") {
    return {
      ...effect,
      type: "damagePlayer",
      value: enemy[effect.stateField]
        ? effect.activeValue
        : effect.defaultValue
    }
  }
  if (effect.type === "spendStolenLuckAttack") {
    return {
      ...effect,
      value:
        effect.baseValue +
        (enemy[effect.stateField] ?? 0) * effect.valuePerPoint
    }
  }
  if (effect.type === "enemyCoinToss") {
    const streak = enemy[effect.streakField] ?? 0
    return {
      ...effect,
      successDamage:
        effect.successDamage +
        streak * (effect.successDamagePerStreak ?? 0),
      failureSelfDamage:
        effect.failureSelfDamage +
        streak * (effect.failureDamagePerStreak ?? 0)
    }
  }
  if (effect.type === "collectDebt") {
    const debt = enemy.debt ?? 0
    return {
      ...effect,
      debt,
      chipCost: debt * effect.chipPerDebt,
      hpCost: debt * effect.hpPerDebt
    }
  }
  return { ...effect }
}

function describeIntent(behavior, effects) {
  return effects.map((effect) => {
    if (effect.type === "damagePlayer") {
      return `造成${effect.value}点伤害`
    }
    if (effect.type === "shieldSelf") {
      return `获得${effect.value}点护盾`
    }
    if (effect.type === "increaseAttack") {
      return `后续攻击增加${effect.value}点伤害`
    }
    if (effect.type === "changePlayerLuck") {
      return `幸运${effect.value >= 0 ? "+" : ""}${effect.value}`
    }
    if (effect.type === "setEnemyState") {
      return effect.description
    }
    if (effect.type === "stealPlayerLuck") {
      return `暂时窃取${effect.value}点幸运`
    }
    if (effect.type === "spendStolenLuckAttack") {
      return `消耗暂存幸运，造成${effect.value}点伤害`
    }
    if (effect.type === "returnStolenLuck") {
      return "返还剩余的暂存幸运"
    }
    if (effect.type === "enemyCoinToss") {
      return (
        `成功率${Math.round(effect.frontRate * 100)}%；` +
        `成功造成${effect.successDamage}点伤害，` +
        `失败自身受到${effect.failureSelfDamage}点伤害`
      )
    }
    if (effect.type === "activateProbabilityConvergence") {
      return "下一回合所有硬币概率向50%收拢"
    }
    if (effect.type === "enableRerollReview") {
      return "下一回合首次投掷可选择接受或强制重投"
    }
    if (effect.type === "resultTax") {
      return (
        `正面：获得${effect.frontShield}点护盾；` +
        `反面：造成${effect.backDamage}点伤害`
      )
    }
    if (effect.type === "toggleHouseSide") {
      return "切换并公开庄家面"
    }
    if (effect.type === "settleHouseEdge") {
      return (
        `造成${effect.baseDamage}点伤害；` +
        `每层庄家优势追加${effect.damagePerEdge}点，然后优势归零`
      )
    }
    if (effect.type === "offerLoan") {
      return (
        `可接受${effect.chips}筹码并增加${effect.debt}层债务；` +
        `拒绝则敌人获得${effect.rejectShield}点护盾`
      )
    }
    if (effect.type === "increaseDebt") {
      return `债务增加${effect.value}层`
    }
    if (effect.type === "collectDebt") {
      if (effect.debt <= 0) {
        return "无债务时催收作废"
      }
      return (
        `清偿${effect.debt}层债务：支付${effect.chipCost}筹码` +
        `或失去${effect.hpCost}点生命`
      )
    }
    return behavior.description
  }).join("，")
}

function selectWeighted(behaviors, random) {
  const totalWeight = behaviors.reduce(
    (sum, behavior) => sum + behavior.weight,
    0
  )
  let roll = random() * totalWeight

  for (const behavior of behaviors) {
    roll -= behavior.weight
    if (roll < 0) {
      return behavior
    }
  }
  return behaviors.at(-1)
}

export class IntentSystem {
  #behaviors
  #rule
  #random

  constructor({ behaviors, intentRule, random = Math.random }) {
    if (!Array.isArray(behaviors) || behaviors.length === 0) {
      throw new Error("敌人至少需要一个行为")
    }
    this.#behaviors = behaviors
    this.#rule = intentRule
    this.#random = random
  }

  createInitialRuntime(enemyConfig) {
    return {
      turnCount: 0,
      attackBonus: 0,
      maxAttackBonus: enemyConfig.maxAttackBonus ?? 0,
      lastBehaviorId: null,
      behaviorCooldowns: {},
      ...(enemyConfig.intentState ?? {})
    }
  }

  chooseIntent(enemy) {
    const behavior = this.#chooseBehavior(enemy)
    const effects = behavior.effects.map((effect) =>
      resolveEffect(effect, enemy)
    )
    return {
      behaviorId: behavior.id,
      name: behavior.name,
      type: behavior.type,
      description: describeIntent(behavior, effects),
      indicators: (this.#rule.indicators ?? []).map((indicator) => {
        const value = enemy[indicator.field]
        return {
          field: indicator.field,
          label: indicator.label,
          value:
            indicator.values?.[value] ??
            (typeof value === "boolean"
              ? value
                ? indicator.trueLabel
                : indicator.falseLabel
              : `${value ?? 0}${indicator.suffix ?? ""}`)
        }
      }),
      effects
    }
  }

  completeIntent(enemy, behaviorId) {
    const behavior = this.#findBehavior(behaviorId)
    const cooldowns = {}

    for (const [id, remaining] of Object.entries(enemy.behaviorCooldowns)) {
      if (remaining > 1) {
        cooldowns[id] = remaining - 1
      }
    }
    if (behavior.cooldown > 0) {
      cooldowns[behavior.id] = behavior.cooldown
    }

    enemy.behaviorCooldowns = cooldowns
    enemy.lastBehaviorId = behavior.id
    enemy.turnCount += 1
  }

  #chooseBehavior(enemy) {
    if (this.#rule.type === "sequence") {
      const sequence = this.#rule.sequence
      return this.#findBehavior(
        sequence[enemy.turnCount % sequence.length]
      )
    }
    if (this.#rule.type === "state_machine") {
      const state =
        enemy[this.#rule.stateField] ?? this.#rule.defaultState
      return this.#findBehavior(
        this.#rule.transitions[state] ??
          this.#rule.fallbackBehaviorId
      )
    }
    if (enemy.turnCount === 0 && this.#rule.firstBehaviorId) {
      return this.#findBehavior(this.#rule.firstBehaviorId)
    }
    if (this.#rule.type === "fixed") {
      return this.#findBehavior(this.#rule.fallbackBehaviorId)
    }

    const available = this.#behaviors.filter((behavior) => {
      if (enemy.turnCount === 0 && !behavior.firstTurnAllowed) {
        return false
      }
      if ((enemy.behaviorCooldowns[behavior.id] ?? 0) > 0) {
        return false
      }
      if (
        behavior.preventImmediateRepeat &&
        enemy.lastBehaviorId === behavior.id
      ) {
        return false
      }
      if (
        behavior.effects.some(
          (effect) => effect.type === "increaseAttack"
        ) &&
        enemy.attackBonus >= enemy.maxAttackBonus
      ) {
        return false
      }
      if (
        behavior.requiresPositiveState &&
        (enemy[behavior.requiresPositiveState] ?? 0) <= 0
      ) {
        return false
      }
      if (
        behavior.requiresZeroState &&
        (enemy[behavior.requiresZeroState] ?? 0) !== 0
      ) {
        return false
      }
      if (
        behavior.requiresActiveState &&
        !enemy[behavior.requiresActiveState]
      ) {
        return false
      }
      if (
        behavior.requiresInactiveState &&
        enemy[behavior.requiresInactiveState]
      ) {
        return false
      }
      return true
    })

    if (available.length === 0) {
      return this.#findBehavior(this.#rule.fallbackBehaviorId)
    }
    return selectWeighted(available, this.#random)
  }

  #findBehavior(behaviorId) {
    const behavior = this.#behaviors.find(({ id }) => id === behaviorId)
    if (!behavior) {
      throw new Error(`找不到敌人行为：${behaviorId}`)
    }
    return behavior
  }
}
