function resolveEffect(effect, enemy) {
  if (effect.type === "damagePlayer" && effect.valueFrom === "attack") {
    return {
      type: effect.type,
      value: enemy.attack + enemy.attackBonus + (effect.bonus ?? 0)
    }
  }
  return { type: effect.type, value: effect.value }
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
      behaviorCooldowns: {}
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
