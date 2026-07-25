import { clamp } from "../utils/clamp.js"
import { CoinSystem } from "./coinSystem.js"
import { IntentSystem } from "./intentSystem.js"
import {
  calculateFinalFrontRate,
  clampLuck
} from "./luckSystem.js"
import {
  RelicSystem,
  RelicTrigger
} from "./relicSystem.js"
import {
  HealthRecoverySource,
  recoverHealth
} from "./healthSystem.js"

export const BattleStatus = Object.freeze({
  CREATED: "CREATED",
  PLAYER_SELECTING: "PLAYER_SELECTING",
  RESOLVING: "RESOLVING",
  VICTORY: "VICTORY",
  DEFEAT: "DEFEAT"
})

function createCombatant(config, runtime = {}) {
  return {
    id: config.id,
    name: config.name,
    description: config.description,
    intro: config.intro,
    defeatText: config.defeatText,
    hp: config.initialHp,
    maxHp: config.maxHp,
    shield: config.initialShield ?? 0,
    ...runtime
  }
}

function cloneCoin(coin) {
  return {
    ...coin,
    frontEffect: { ...coin.frontEffect },
    backEffect: { ...coin.backEffect }
  }
}

function cloneResolutionEvent(event) {
  return {
    ...event,
    effect: event.effect ? { ...event.effect } : undefined,
    player: event.player
      ? {
          ...event.player,
          relicIds: [...event.player.relicIds],
          bannedRelicIds: [...event.player.bannedRelicIds]
        }
      : undefined,
    enemy: event.enemy ? { ...event.enemy } : undefined,
    messages: event.messages ? [...event.messages] : []
  }
}

function cloneState(state) {
  return {
    ...state,
    player: {
      ...state.player,
      relicIds: [...state.player.relicIds],
      bannedRelicIds: [...state.player.bannedRelicIds]
    },
    enemy: {
      ...state.enemy,
      behaviorCooldowns: { ...state.enemy.behaviorCooldowns },
      currentIntent: state.enemy.currentIntent
        ? {
            ...state.enemy.currentIntent,
            effects: state.enemy.currentIntent.effects.map((effect) => ({
              ...effect
            }))
          }
        : null
    },
    coins: state.coins.map(cloneCoin),
    drawnCoins: state.drawnCoins.map(cloneCoin),
    playedCoins: state.playedCoins.map((coin) => ({ ...coin })),
    lastToss: state.lastToss ? { ...state.lastToss } : null,
    resolutionEvents: state.resolutionEvents.map(cloneResolutionEvent),
    logs: [...state.logs]
  }
}

function receiveDamage(target, rawDamage) {
  const damage = Math.max(0, rawDamage)
  const absorbed = Math.min(target.shield, damage)
  const hpDamage = damage - absorbed
  target.shield -= absorbed
  target.hp = clamp(target.hp - hpDamage, 0, target.maxHp)
  return { absorbed, hpDamage }
}

export class BattleEngine {
  #state
  #coinSystem
  #intentSystem
  #relicSystem
  #setupLogs

  constructor({
    playerConfig,
    enemyConfig,
    coinConfigs,
    relicDefinitions = {},
    drawCount,
    maxCoinsPerTurn = 1,
    random = Math.random
  }) {
    this.#validateConfig(playerConfig, enemyConfig)
    const relicIds = [...(playerConfig.relicIds ?? [])]
    const bannedRelicIds = [...(playerConfig.bannedRelicIds ?? [])]
    this.#relicSystem = new RelicSystem({
      relicDefinitions,
      relicIds,
      bannedRelicIds,
      random
    })
    const setup = this.#relicSystem.trigger(RelicTrigger.BATTLE_SETUP, {
      drawCount
    })
    this.#setupLogs = setup.logs
    this.#coinSystem = new CoinSystem({
      loadout: playerConfig.coinLoadout,
      coinInstances: playerConfig.coinInstances,
      coinConfigs,
      drawCount: setup.drawCount,
      random
    })
    this.#intentSystem = new IntentSystem({
      behaviors: enemyConfig.behaviors,
      intentRule: enemyConfig.intentRule,
      random
    })
    const enemyRuntime = this.#intentSystem.createInitialRuntime(enemyConfig)
    if (!Number.isInteger(maxCoinsPerTurn) || maxCoinsPerTurn < 1) {
      throw new Error("每回合硬币使用上限必须是正整数")
    }
    this.#state = {
      status: BattleStatus.CREATED,
      turn: 0,
      player: createCombatant(playerConfig, {
        luck: clampLuck(playerConfig.initialLuck ?? 0),
        counterCharges: 0,
        counterDamage: 0,
        shieldReflectionActive: false,
        shieldConsumedThisEnemyAction: 0,
        relicIds,
        bannedRelicIds
      }),
      enemy: createCombatant(enemyConfig, {
        attack: enemyConfig.attack,
        ...enemyRuntime,
        currentIntent: null
      }),
      coins: this.#coinSystem.getCoins(),
      drawnCoins: [],
      playedCoins: [],
      maxCoinsPerTurn,
      lastToss: null,
      resolutionEvents: [],
      logs: []
    }
  }

  start() {
    if (this.#state.status !== BattleStatus.CREATED) {
      throw new Error("战斗只能开始一次")
    }
    this.#state.logs.push(
      `战斗开始：${this.#state.player.name} VS ${this.#state.enemy.name}`
    )
    this.#state.logs.push(...this.#setupLogs)
    const relicStart = this.#relicSystem.trigger(
      RelicTrigger.BATTLE_START,
      { player: this.#state.player }
    )
    this.#state.logs.push(...relicStart.logs)
    this.#state.enemy.currentIntent = this.#intentSystem.chooseIntent(
      this.#state.enemy
    )
    this.#beginPlayerTurn()
    return this.getState()
  }

  playCoins(coinUids) {
    if (this.#state.status !== BattleStatus.PLAYER_SELECTING) {
      throw new Error(`当前状态 ${this.#state.status} 不能使用硬币`)
    }
    if (
      !Array.isArray(coinUids) ||
      coinUids.length < 1 ||
      coinUids.length > this.#state.maxCoinsPerTurn
    ) {
      throw new Error(
        `每回合必须使用1到${this.#state.maxCoinsPerTurn}枚硬币`
      )
    }
    if (new Set(coinUids).size !== coinUids.length) {
      throw new Error("同一枚硬币每回合只能使用一次")
    }
    const selectedCoins = coinUids.map((coinUid) => {
      const coin = this.#state.drawnCoins.find(
        (candidate) => candidate.uid === coinUid
      )
      if (!coin) {
        throw new Error("只能使用本回合抽取的硬币")
      }
      return coin
    })
    const requiredHp = selectedCoins.reduce(
      (total, coin) =>
        total +
        Math.max(
          coin.frontEffect.type === "selfCostDamage"
            ? coin.frontEffect.cost
            : 0,
          coin.backEffect.type === "selfCostDamage"
            ? coin.backEffect.cost
            : 0
        ),
      0
    )
    if (this.#state.player.hp - requiredHp < 1) {
      throw new Error("当前生命不足以使用所选硬币")
    }

    this.#state.status = BattleStatus.RESOLVING
    this.#state.playedCoins = []
    this.#state.resolutionEvents = []

    for (const coin of selectedCoins) {
      const probability = this.#resolveFinalFrontRate(
        coin.frontRate,
        coin
      )
      const finalFrontRate = probability.rate
      const toss = this.#coinSystem.toss(coin, finalFrontRate)
      this.#state.lastToss = {
        coinUid: coin.uid,
        coinName: coin.name,
        side: toss.side,
        rate: toss.rate
      }
      this.#state.playedCoins.push({
        coinUid: coin.uid,
        coinName: coin.name,
        side: toss.side,
        rate: toss.rate
      })
      this.#state.logs.push(
        `${this.#state.player.name}使用${coin.name}，` +
        `当前幸运${this.#formatLuck(this.#state.player.luck)}，` +
        `最终正面概率${Math.round(toss.rate * 100)}%，` +
        `投掷结果：${toss.side === "front" ? "正面" : "反面"}`
      )
      this.#recordResolutionEvent("COIN_TOSSED", {
        coinUid: coin.uid,
        coinId: coin.id,
        coinName: coin.name,
        side: toss.side,
        rate: toss.rate,
        message: `${coin.name}投出${toss.side === "front" ? "正面" : "反面"}`
      })
      this.#state.logs.push(...probability.logs)
      const modified = this.#relicSystem.trigger(
        RelicTrigger.COIN_EFFECT_MODIFY,
        {
          player: this.#state.player,
          coin,
          side: toss.side,
          effect: toss.effect
        }
      )
      this.#state.logs.push(...modified.logs)
      const effectLogStart = this.#state.logs.length
      this.#resolveEffect(modified.effect)
      this.#recordResolutionEvent("PLAYER_EFFECT", {
        coinUid: coin.uid,
        coinId: coin.id,
        coinName: coin.name,
        side: toss.side,
        effect: modified.effect,
        messages: this.#state.logs.slice(effectLogStart)
      })
      const relicLogStart = this.#state.logs.length
      const tossRecorded = this.#relicSystem.trigger(
        RelicTrigger.AFTER_COIN_TOSS,
        {
          player: this.#state.player,
          side: toss.side
        }
      )
      this.#state.logs.push(...tossRecorded.logs)
      if (tossRecorded.logs.length > 0) {
        this.#recordResolutionEvent("RELIC_TRIGGERED", {
          source: "AFTER_COIN_TOSS",
          messages: this.#state.logs.slice(relicLogStart)
        })
      }
      if (coin.consumable) {
        this.#coinSystem.consume(coin.uid)
        this.#state.coins = this.#coinSystem.getCoins()
        this.#state.logs.push(`${coin.name}本场战斗已消耗`)
      }
      if (this.#state.enemy.hp <= 0) {
        break
      }
    }

    if (this.#state.enemy.hp <= 0) {
      this.#state.status = BattleStatus.VICTORY
      this.#state.drawnCoins = []
      this.#state.enemy.currentIntent = null
      this.#state.logs.push(`${this.#state.enemy.name}被击败，战斗胜利`)
      this.#recordResolutionEvent("BATTLE_RESULT", {
        result: BattleStatus.VICTORY,
        message: "战斗胜利"
      })
      return this.getState()
    }

    const beforeEnemyRelicLogStart = this.#state.logs.length
    const beforeEnemyAction = this.#relicSystem.trigger(
      RelicTrigger.BEFORE_ENEMY_ACTION,
      {
        player: this.#state.player,
        enemy: this.#state.enemy
      }
    )
    this.#state.logs.push(...beforeEnemyAction.logs)
    if (beforeEnemyAction.logs.length > 0) {
      this.#recordResolutionEvent("RELIC_TRIGGERED", {
        source: "BEFORE_ENEMY_ACTION",
        messages: this.#state.logs.slice(beforeEnemyRelicLogStart)
      })
    }
    if (this.#state.enemy.hp <= 0) {
      this.#state.status = BattleStatus.VICTORY
      this.#state.drawnCoins = []
      this.#state.enemy.currentIntent = null
      this.#state.logs.push(`${this.#state.enemy.name}被消灭，战斗胜利`)
      this.#recordResolutionEvent("BATTLE_RESULT", {
        result: BattleStatus.VICTORY,
        message: "战斗胜利"
      })
      return this.getState()
    }

    this.#resolveEnemyAction()
    if (this.#state.player.hp <= 0) {
      this.#state.status = BattleStatus.DEFEAT
      this.#state.drawnCoins = []
      this.#state.enemy.currentIntent = null
      this.#state.logs.push(`${this.#state.player.name}被击败，战斗失败`)
      this.#recordResolutionEvent("BATTLE_RESULT", {
        result: BattleStatus.DEFEAT,
        message: "战斗失败"
      })
      return this.getState()
    }
    if (this.#state.enemy.hp <= 0) {
      this.#state.status = BattleStatus.VICTORY
      this.#state.drawnCoins = []
      this.#state.enemy.currentIntent = null
      this.#state.logs.push(`${this.#state.enemy.name}被反击击败，战斗胜利`)
      this.#recordResolutionEvent("BATTLE_RESULT", {
        result: BattleStatus.VICTORY,
        message: "反击完成战斗"
      })
      return this.getState()
    }

    this.#state.enemy.currentIntent = this.#intentSystem.chooseIntent(
      this.#state.enemy
    )
    this.#beginPlayerTurn()
    return this.getState()
  }

  getState() {
    return cloneState(this.#state)
  }

  #beginPlayerTurn() {
    const continuesResolution =
      this.#state.status === BattleStatus.RESOLVING
    this.#state.turn += 1
    this.#state.player.shield = 0
    this.#state.drawnCoins = this.#coinSystem
      .drawCandidates()
      .map((coin) => ({
        ...coin,
        finalFrontRate: this.#resolveFinalFrontRate(
          coin.frontRate,
          coin
        ).rate,
        isUsable:
          this.#state.player.hp -
            Math.max(
              coin.frontEffect.type === "selfCostDamage"
                ? coin.frontEffect.cost
                : 0,
              coin.backEffect.type === "selfCostDamage"
                ? coin.backEffect.cost
                : 0
            ) >=
          1
      }))
    this.#state.status = BattleStatus.PLAYER_SELECTING
    this.#state.logs.push(
      `第${this.#state.turn}回合：抽取${this.#state.drawnCoins.length}枚硬币，` +
      `请选择最多${this.#state.maxCoinsPerTurn}枚`
    )
    if (continuesResolution) {
      this.#recordResolutionEvent("TURN_STARTED", {
        turn: this.#state.turn,
        message: `进入第${this.#state.turn}回合`
      })
    }
  }

  #resolveEffect(effect) {
    if (effect.type === "damage") {
      const result = this.#dealPlayerDamage(effect.value, "coin")
      this.#state.logs.push(
        `${this.#state.enemy.name}受到${result.hpDamage}点伤害`
      )
      return
    }

    if (effect.type === "shield") {
      this.#state.player.shield += effect.value
      this.#state.logs.push(
        `${this.#state.player.name}获得${effect.value}点护盾`
      )
      return
    }
    if (effect.type === "shieldWithExistingBonus") {
      const bonus = this.#state.player.shield > 0 ? effect.bonus : 0
      const gained = effect.shield + bonus
      this.#state.player.shield += gained
      this.#state.logs.push(
        `${this.#state.player.name}获得${gained}点护盾` +
        `${bonus > 0 ? "（已有护盾奖励）" : ""}`
      )
      return
    }
    if (effect.type === "reflectionShield") {
      this.#state.player.shield += effect.shield
      this.#state.player.shieldReflectionActive = true
      this.#state.logs.push(
        `${this.#state.player.name}获得${effect.shield}点护盾并进入反震状态`
      )
      return
    }
    if (effect.type === "changeLuck") {
      const before = this.#state.player.luck
      this.#state.player.luck = clampLuck(before + effect.value)
      const changed = this.#state.player.luck - before
      this.#state.logs.push(
        `${this.#state.player.name}幸运${changed >= 0 ? "+" : ""}${changed}，` +
        `当前幸运${this.#formatLuck(this.#state.player.luck)}`
      )
      return
    }
    if (effect.type === "conditionalDamage") {
      const hasShield = this.#state.enemy.shield > 0
      const damage =
        effect.value +
        (hasShield && effect.condition === "enemyHasShield"
          ? effect.bonus
          : 0)
      const result = this.#dealPlayerDamage(damage, "coin")
      this.#state.logs.push(
        `${this.#state.enemy.name}受到${result.hpDamage}点伤害` +
        `${hasShield ? "（触发护盾追加伤害）" : ""}`
      )
      return
    }
    if (effect.type === "multiDamage") {
      for (let hit = 1; hit <= effect.hits; hit += 1) {
        const result = this.#dealPlayerDamage(
          effect.damagePerHit,
          "coin"
        )
        this.#state.logs.push(
          `第${hit}段：${this.#state.enemy.name}受到${result.hpDamage}点伤害`
        )
        if (this.#state.enemy.hp <= 0) {
          break
        }
      }
      return
    }
    if (effect.type === "heal") {
      const recovery = recoverHealth(
        this.#state.player,
        effect.value,
        HealthRecoverySource.COIN
      )
      this.#state.logs.push(
        `${this.#state.player.name}恢复${recovery.recovered}点生命`
      )
      return
    }
    if (effect.type === "damageAndHeal") {
      const damage = this.#dealPlayerDamage(effect.damage, "coin")
      const recovery = recoverHealth(
        this.#state.player,
        effect.heal,
        HealthRecoverySource.COIN
      )
      this.#state.logs.push(
        `${this.#state.enemy.name}受到${damage.hpDamage}点伤害，` +
        `${this.#state.player.name}恢复${recovery.recovered}点生命`
      )
      return
    }
    if (effect.type === "selfCostDamage") {
      this.#state.player.hp -= effect.cost
      const damage = this.#dealPlayerDamage(effect.damage, "coin")
      this.#state.logs.push(
        `${this.#state.player.name}失去${effect.cost}点生命，` +
        `${this.#state.enemy.name}受到${damage.hpDamage}点伤害`
      )
      return
    }
    if (effect.type === "damageAndLuck") {
      const damage = this.#dealPlayerDamage(effect.damage, "coin")
      this.#state.player.luck = clampLuck(
        this.#state.player.luck + effect.luck
      )
      this.#state.logs.push(
        `${this.#state.enemy.name}受到${damage.hpDamage}点伤害，` +
        `当前幸运${this.#formatLuck(this.#state.player.luck)}`
      )
      return
    }
    if (effect.type === "luckDamage") {
      const multiplier = Math.max(
        effect.minMultiplier,
        this.#state.player.luck
      )
      const damage = this.#dealPlayerDamage(
        effect.baseDamage * multiplier,
        "coin"
      )
      this.#state.logs.push(
        `${this.#state.enemy.name}受到${damage.hpDamage}点伤害` +
        `（幸运倍率×${multiplier}）`
      )
      return
    }
    if (effect.type === "shieldAndLuck") {
      this.#state.player.shield += effect.shield
      this.#state.player.luck = clampLuck(
        this.#state.player.luck + effect.luck
      )
      this.#state.logs.push(
        `${this.#state.player.name}获得${effect.shield}点护盾，` +
        `当前幸运${this.#formatLuck(this.#state.player.luck)}`
      )
      return
    }
    if (effect.type === "counter") {
      this.#state.player.shield += effect.shield
      this.#state.player.counterCharges += 1
      this.#state.player.counterDamage = effect.damage
      this.#state.logs.push(
        `${this.#state.player.name}获得${effect.shield}点护盾和1次反击`
      )
      return
    }

    throw new Error(`不支持的硬币效果：${effect.type}`)
  }

  #resolveEnemyAction() {
    this.#state.enemy.shield = 0
    this.#state.player.shieldConsumedThisEnemyAction = 0
    const intent = this.#state.enemy.currentIntent
    this.#state.logs.push(`${this.#state.enemy.name}执行意图：${intent.name}`)
    this.#recordResolutionEvent("ENEMY_INTENT_START", {
      intentName: intent.name,
      intentType: intent.type,
      message: `${this.#state.enemy.name}执行${intent.name}`
    })

    for (const effect of intent.effects) {
      this.#resolveEnemyEffect(effect)
      if (this.#state.enemy.hp <= 0) {
        break
      }
    }

    if (
      this.#state.player.shieldReflectionActive &&
      this.#state.player.shieldConsumedThisEnemyAction > 0 &&
      this.#state.enemy.hp > 0
    ) {
      const reflection = this.#dealPlayerDamage(
        this.#state.player.shieldConsumedThisEnemyAction,
        "reflection"
      )
      this.#state.logs.push(
        `反震造成${reflection.hpDamage}点伤害`
      )
      this.#recordResolutionEvent("COUNTER_TRIGGERED", {
        source: "reflection",
        damage: reflection.hpDamage,
        message: `反震造成${reflection.hpDamage}点伤害`
      })
    }
    this.#state.player.shieldReflectionActive = false
    this.#state.player.shieldConsumedThisEnemyAction = 0

    this.#intentSystem.completeIntent(
      this.#state.enemy,
      intent.behaviorId
    )
  }

  #resolveEnemyEffect(effect) {
    if (effect.type === "damagePlayer") {
      const result = receiveDamage(this.#state.player, effect.value)
      if (this.#state.player.shieldReflectionActive) {
        this.#state.player.shieldConsumedThisEnemyAction += result.absorbed
      }
      this.#state.logs.push(
        `${this.#state.player.name}受到${result.hpDamage}点伤害`
      )
      this.#recordResolutionEvent("ENEMY_EFFECT", {
        effect,
        rawDamage: effect.value,
        absorbed: result.absorbed,
        hpDamage: result.hpDamage,
        message:
          result.absorbed > 0
            ? `护盾抵消${result.absorbed}点伤害，生命受到${result.hpDamage}点伤害`
            : `受到${result.hpDamage}点生命伤害`
      })
      if (result.hpDamage > 0) {
        const relicDamageLogStart = this.#state.logs.length
        const relicDamage = this.#relicSystem.trigger(
          RelicTrigger.AFTER_HP_DAMAGE,
          {
            player: this.#state.player,
            enemy: this.#state.enemy,
            hpDamage: result.hpDamage
          }
        )
        this.#state.logs.push(...relicDamage.logs)
        if (relicDamage.counterDamage > 0) {
          const relicCounter = this.#dealPlayerDamage(
            relicDamage.counterDamage,
            "relicCounter"
          )
          this.#state.logs.push(
            `${this.#state.enemy.name}受到${relicCounter.hpDamage}点遗物反击伤害`
          )
        }
        if (
          relicDamage.logs.length > 0 ||
          relicDamage.counterDamage > 0
        ) {
          this.#recordResolutionEvent("RELIC_TRIGGERED", {
            source: "AFTER_HP_DAMAGE",
            damage: relicDamage.counterDamage,
            messages: this.#state.logs.slice(relicDamageLogStart)
          })
        }
      }
      if (this.#state.player.counterCharges > 0) {
        this.#state.player.counterCharges -= 1
        const counterResult = this.#dealPlayerDamage(
          this.#state.player.counterDamage,
          "counter"
        )
        this.#state.logs.push(
          `${this.#state.player.name}发动反击，` +
          `${this.#state.enemy.name}受到${counterResult.hpDamage}点伤害`
        )
        this.#recordResolutionEvent("COUNTER_TRIGGERED", {
          source: "counter",
          damage: counterResult.hpDamage,
          message: `反击触发，造成${counterResult.hpDamage}点伤害`
        })
      }
      if (this.#state.player.hp <= 0) {
        const deathLogStart = this.#state.logs.length
        const death = this.#relicSystem.trigger(
          RelicTrigger.BEFORE_DEATH,
          { player: this.#state.player }
        )
        this.#state.logs.push(...death.logs)
        this.#state.player.relicIds = this.#relicSystem.getRelicIds()
        this.#state.player.bannedRelicIds =
          this.#relicSystem.getBannedRelicIds()
        if (death.logs.length > 0) {
          this.#recordResolutionEvent("RELIC_TRIGGERED", {
            source: "BEFORE_DEATH",
            revived: death.revived,
            messages: this.#state.logs.slice(deathLogStart)
          })
        }
      }
      return
    }
    if (effect.type === "shieldSelf") {
      this.#state.enemy.shield += effect.value
      this.#state.logs.push(
        `${this.#state.enemy.name}获得${effect.value}点护盾`
      )
      this.#recordResolutionEvent("ENEMY_EFFECT", {
        effect,
        message: `${this.#state.enemy.name}获得${effect.value}点护盾`
      })
      return
    }
    if (effect.type === "increaseAttack") {
      const before = this.#state.enemy.attackBonus
      this.#state.enemy.attackBonus = Math.min(
        before + effect.value,
        this.#state.enemy.maxAttackBonus
      )
      const gained = this.#state.enemy.attackBonus - before
      this.#state.logs.push(
        `${this.#state.enemy.name}后续攻击增加${gained}点伤害`
      )
      this.#recordResolutionEvent("ENEMY_EFFECT", {
        effect: { ...effect, value: gained },
        message: `后续攻击增加${gained}点伤害`
      })
      return
    }
    if (effect.type === "changePlayerLuck") {
      const before = this.#state.player.luck
      this.#state.player.luck = clampLuck(before + effect.value)
      const changed = this.#state.player.luck - before
      this.#state.logs.push(
        `${this.#state.player.name}幸运${changed >= 0 ? "+" : ""}${changed}，` +
        `当前幸运${this.#formatLuck(this.#state.player.luck)}`
      )
      this.#recordResolutionEvent("ENEMY_EFFECT", {
        effect: { ...effect, value: changed },
        message: `幸运${changed >= 0 ? "+" : ""}${changed}`
      })
      return
    }
    throw new Error(`不支持的敌人意图效果：${effect.type}`)
  }

  #validateConfig(playerConfig, enemyConfig) {
    if (
      !playerConfig ||
      !enemyConfig ||
      (!playerConfig.coinLoadout && !playerConfig.coinInstances) ||
      !enemyConfig.behaviors ||
      !enemyConfig.intentRule
    ) {
      throw new Error("创建战斗缺少必要配置")
    }
    const numericValues = [
      playerConfig.maxHp,
      playerConfig.initialHp,
      enemyConfig.maxHp,
      enemyConfig.initialHp,
      enemyConfig.attack
    ]
    if (numericValues.some((value) => !Number.isFinite(value) || value < 0)) {
      throw new Error("生命和攻击配置必须是非负数")
    }
    if (
      playerConfig.initialHp > playerConfig.maxHp ||
      enemyConfig.initialHp > enemyConfig.maxHp
    ) {
      throw new Error("初始生命不能超过最大生命")
    }
  }

  #formatLuck(luck) {
    return luck >= 0 ? `+${luck}` : `${luck}`
  }

  #dealPlayerDamage(rawDamage, source) {
    const modified = this.#relicSystem.trigger(
      RelicTrigger.PLAYER_DAMAGE_MODIFY,
      {
        player: this.#state.player,
        enemy: this.#state.enemy,
        damage: rawDamage,
        source
      }
    )
    this.#state.logs.push(...modified.logs)
    return receiveDamage(this.#state.enemy, modified.damage)
  }

  #resolveFinalFrontRate(baseRate, coin) {
    const base = calculateFinalFrontRate(
      baseRate,
      this.#state.player.luck
    )
    return this.#relicSystem.trigger(
      RelicTrigger.PROBABILITY_MODIFY,
      {
        rate: base,
        luck: this.#state.player.luck
      }
    )
  }

  #recordResolutionEvent(type, detail = {}) {
    this.#state.resolutionEvents.push({
      sequence: this.#state.resolutionEvents.length,
      type,
      ...detail,
      effect: detail.effect ? { ...detail.effect } : undefined,
      messages: detail.messages
        ? [...detail.messages]
        : detail.message
          ? [detail.message]
          : [],
      player: {
        hp: this.#state.player.hp,
        maxHp: this.#state.player.maxHp,
        shield: this.#state.player.shield,
        luck: this.#state.player.luck,
        counterCharges: this.#state.player.counterCharges,
        counterDamage: this.#state.player.counterDamage,
        relicIds: [...this.#state.player.relicIds],
        bannedRelicIds: [...this.#state.player.bannedRelicIds]
      },
      enemy: {
        hp: this.#state.enemy.hp,
        maxHp: this.#state.enemy.maxHp,
        shield: this.#state.enemy.shield,
        attackBonus: this.#state.enemy.attackBonus
      }
    })
  }

}
