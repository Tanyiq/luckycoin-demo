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
  PLAYER_DECIDING: "PLAYER_DECIDING",
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
    backEffect: { ...coin.backEffect },
    displayFrontEffect: coin.displayFrontEffect
      ? { ...coin.displayFrontEffect }
      : undefined,
    displayBackEffect: coin.displayBackEffect
      ? { ...coin.displayBackEffect }
      : undefined
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
            indicators: (
              state.enemy.currentIntent.indicators ?? []
            ).map((indicator) => ({ ...indicator })),
            effects: state.enemy.currentIntent.effects.map((effect) => ({
              ...effect
            }))
          }
        : null
    },
    coins: state.coins.map(cloneCoin),
    drawnCoins: state.drawnCoins.map(cloneCoin),
    playedCoins: state.playedCoins.map((coin) => ({ ...coin })),
    extraBetSources: [...state.extraBetSources],
    selectionRules: {
      ...state.selectionRules,
      extraBetIntervals: state.selectionRules.extraBetIntervals.map(
        (rule) => ({ ...rule })
      )
    },
    lastToss: state.lastToss ? { ...state.lastToss } : null,
    pendingDecision: state.pendingDecision
      ? {
          ...state.pendingDecision,
          options: state.pendingDecision.options.map((option) => ({
            ...option
          })),
          selectedCoinUids: [
            ...(state.pendingDecision.selectedCoinUids ?? [])
          ],
          provisionalToss: state.pendingDecision.provisionalToss
            ? {
                ...state.pendingDecision.provisionalToss,
                effect: {
                  ...state.pendingDecision.provisionalToss.effect
                }
              }
            : undefined,
          probability: state.pendingDecision.probability
            ? {
                ...state.pendingDecision.probability,
                logs: [...state.pendingDecision.probability.logs]
              }
            : undefined
        }
      : null,
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

function requiredHpForCoin(coin) {
  return Math.max(
    coin.frontEffect.type === "selfCostDamage"
      ? coin.frontEffect.cost
      : 0,
    coin.backEffect.type === "selfCostDamage"
      ? coin.backEffect.cost
      : 0
  )
}

export class BattleEngine {
  #state
  #coinSystem
  #intentSystem
  #relicSystem
  #setupLogs
  #random
  #forcedToss = null

  constructor({
    playerConfig,
    enemyConfig,
    coinConfigs,
    relicDefinitions = {},
    drawCount,
    maxCoinsPerTurn = 1,
    selectionRules = {},
    random = Math.random
  }) {
    this.#validateConfig(playerConfig, enemyConfig)
    this.#random = random
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
        chips: Math.max(0, Math.floor(playerConfig.chips ?? 0)),
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
      baseMaxCoinsPerTurn: maxCoinsPerTurn,
      maxCoinsPerTurn,
      selectionCount: 0,
      extraBetSources: [],
      selectionRules: {
        isBossBattle: selectionRules.isBossBattle === true,
        extraBetIntervals: (
          selectionRules.extraBetIntervals ?? []
        ).map((rule) => ({ ...rule }))
      },
      lastToss: null,
      pendingDecision: null,
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
      (total, coin) => total + requiredHpForCoin(coin),
      0
    )
    if (this.#state.player.hp - requiredHp < 1) {
      throw new Error("当前生命不足以使用所选硬币")
    }

    if (this.#state.enemy.rerollReviewActive) {
      const coin = selectedCoins[0]
      const probability = this.#resolveFinalFrontRate(
        coin.frontRate,
        coin
      )
      const provisionalToss = this.#coinSystem.toss(
        coin,
        probability.rate
      )
      this.#state.enemy.rerollReviewActive = false
      if (provisionalToss.side === "back") {
        this.#forcedToss = {
          coinUid: coin.uid,
          toss: provisionalToss,
          probability
        }
        this.#state.logs.push(
          `二次复核：${coin.name}投出反面，无需重投`
        )
        return this.playCoins(coinUids)
      }
      this.#state.status = BattleStatus.PLAYER_DECIDING
      this.#state.pendingDecision = {
        type: "REROLL_REVIEW",
        title: "二次复核",
        message:
          `${coin.name}第一次投出正面。根据二次复核条款，` +
          "必须重新投掷并接受新结果。",
        selectedCoinUids: [...coinUids],
        coinUid: coin.uid,
        coinName: coin.name,
        provisionalToss,
        probability,
        options: [
          { id: "reroll", label: "按要求重新投掷", enabled: true }
        ]
      }
      this.#state.logs.push(
        `二次复核：${coin.name}第一次投出` +
        `${provisionalToss.side === "front" ? "正面" : "反面"}`
      )
      return this.getState()
    }

    this.#state.status = BattleStatus.RESOLVING
    this.#state.playedCoins = []
    this.#state.resolutionEvents = []

    for (const coin of selectedCoins) {
      const forced =
        this.#forcedToss?.coinUid === coin.uid
          ? this.#forcedToss
          : null
      const probability =
        forced?.probability ??
        this.#resolveFinalFrontRate(coin.frontRate, coin)
      const finalFrontRate = probability.rate
      const toss =
        forced?.toss ??
        this.#coinSystem.toss(coin, finalFrontRate)
      if (forced) {
        this.#forcedToss = null
      }
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
      this.#state.enemy.lastPlayerSide = toss.side
      this.#updateHouseEdge(toss.side)
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

    this.#state.enemy.probabilityConvergenceActive = false

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

    const enemyActionCompleted = this.#resolveEnemyAction()
    if (!enemyActionCompleted) {
      return this.getState()
    }
    return this.#finishEnemyTurn()
  }

  resolveDecision(choice) {
    if (
      this.#state.status !== BattleStatus.PLAYER_DECIDING ||
      !this.#state.pendingDecision
    ) {
      throw new Error("当前没有需要处理的战斗决策")
    }
    const decision = this.#state.pendingDecision
    const option = decision.options.find(({ id }) => id === choice)
    if (!option?.enabled) {
      throw new Error("该选项当前不可用")
    }
    this.#state.pendingDecision = null

    if (decision.type === "REROLL_REVIEW") {
      const coin = this.#state.drawnCoins.find(
        ({ uid }) => uid === decision.coinUid
      )
      const toss = this.#coinSystem.toss(
        coin,
        decision.probability.rate
      )
      this.#forcedToss = {
        coinUid: decision.coinUid,
        toss,
        probability: decision.probability
      }
      this.#state.logs.push(
        `复核重投结果：${toss.side === "front" ? "正面" : "反面"}`
      )
      this.#state.status = BattleStatus.PLAYER_SELECTING
      return this.playCoins(decision.selectedCoinUids)
    }

    if (decision.type === "LOAN_OFFER") {
      if (choice === "accept") {
        this.#state.player.chips += decision.chips
        this.#state.enemy.debt += decision.debt
        this.#state.logs.push(
          `接受垫款：获得${decision.chips}筹码，债务增加${decision.debt}层`
        )
      } else {
        this.#state.enemy.shield += decision.rejectShield
        this.#state.logs.push(
          `拒绝垫款，${this.#state.enemy.name}获得${decision.rejectShield}点护盾`
        )
      }
    } else if (decision.type === "DEBT_COLLECTION") {
      if (choice === "pay_chips") {
        this.#state.player.chips -= decision.chipCost
        this.#state.logs.push(`支付${decision.chipCost}筹码清偿债务`)
      } else {
        this.#resolveDirectHpLoss(decision.hpCost, "债务催收")
      }
      this.#state.enemy.debt = 0
    } else {
      throw new Error(`不支持的战斗决策：${decision.type}`)
    }

    this.#state.status = BattleStatus.RESOLVING
    this.#completeEnemyAction()
    return this.#finishEnemyTurn()
  }

  #finishEnemyTurn() {
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
    this.#state.selectionCount += 1
    this.#state.maxCoinsPerTurn =
      this.#state.baseMaxCoinsPerTurn
    this.#state.extraBetSources = []
    for (const rule of this.#state.selectionRules.extraBetIntervals) {
      if (
        this.#state.selectionCount % rule.interval === 0 &&
        (!rule.bossOnly || this.#state.selectionRules.isBossBattle)
      ) {
        this.#state.maxCoinsPerTurn += 1
        this.#state.extraBetSources.push(rule.source)
        this.#state.logs.push(`${rule.source}：本次选择可以追加下注`)
      }
    }
    const selectionRelics = this.#relicSystem.trigger(
      RelicTrigger.PLAYER_SELECTION_START,
      {
        selectionCount: this.#state.selectionCount,
        maxCoinsPerTurn: this.#state.maxCoinsPerTurn,
        extraBetSources: [...this.#state.extraBetSources]
      }
    )
    this.#state.maxCoinsPerTurn = selectionRelics.maxCoinsPerTurn
    this.#state.extraBetSources = selectionRelics.extraBetSources
    this.#state.logs.push(...selectionRelics.logs)
    this.#state.player.shield = 0
    const isEligible = (coin) =>
      this.#state.player.hp - requiredHpForCoin(coin) >= 1
    const initialDraw = this.#coinSystem.drawCandidates()
    const fallbackDraw = initialDraw.some(isEligible)
      ? []
      : this.#coinSystem.drawCandidates({ isEligible })
    this.#state.drawnCoins = (
      fallbackDraw.length > 0 ? fallbackDraw : initialDraw
    )
      .map((coin) => ({
        ...coin,
        displayFrontEffect: this.#previewCoinEffect(coin, "front"),
        displayBackEffect: this.#previewCoinEffect(coin, "back"),
        finalFrontRate: this.#resolveFinalFrontRate(
          coin.frontRate,
          coin
        ).rate,
        isUsable: isEligible(coin)
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
      this.#state.player.counterCharges = 1
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
      const paused = this.#resolveEnemyEffect(effect)
      if (paused) {
        return false
      }
      if (this.#state.enemy.hp <= 0) {
        break
      }
    }

    this.#completeEnemyAction()
    return true
  }

  #completeEnemyAction() {
    const intent = this.#state.enemy.currentIntent
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
    this.#state.player.counterCharges = 0
    this.#state.player.counterDamage = 0

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
    if (effect.type === "setEnemyState") {
      this.#state.enemy[effect.field] = effect.value
      const message =
        effect.message ??
        `${this.#state.enemy.name}调整了战斗状态`
      this.#state.logs.push(message)
      this.#recordResolutionEvent("ENEMY_EFFECT", {
        effect,
        message
      })
      return
    }
    if (effect.type === "stealPlayerLuck") {
      const before = this.#state.player.luck
      this.#state.player.luck = clampLuck(before - effect.value)
      const stolen = before - this.#state.player.luck
      this.#state.enemy[effect.stateField] =
        (this.#state.enemy[effect.stateField] ?? 0) + stolen
      const message =
        `${this.#state.enemy.name}暂存${stolen}点幸运，` +
        `玩家当前幸运${this.#formatLuck(this.#state.player.luck)}`
      this.#state.logs.push(message)
      this.#recordResolutionEvent("ENEMY_EFFECT", {
        effect: { ...effect, value: stolen },
        message
      })
      return
    }
    if (effect.type === "spendStolenLuckAttack") {
      this.#resolveEnemyEffect({
        type: "damagePlayer",
        value: effect.value
      })
      const stored = this.#state.enemy[effect.stateField] ?? 0
      this.#state.enemy[effect.stateField] = Math.max(
        0,
        stored - effect.consume
      )
      return
    }
    if (effect.type === "returnStolenLuck") {
      const stored = this.#state.enemy[effect.stateField] ?? 0
      const before = this.#state.player.luck
      this.#state.player.luck = clampLuck(before + stored)
      const returned = this.#state.player.luck - before
      this.#state.enemy[effect.stateField] = 0
      const message =
        `${this.#state.enemy.name}返还${returned}点幸运，` +
        `玩家当前幸运${this.#formatLuck(this.#state.player.luck)}`
      this.#state.logs.push(message)
      this.#recordResolutionEvent("ENEMY_EFFECT", {
        effect: { ...effect, value: returned },
        message
      })
      return
    }
    if (effect.type === "enemyCoinToss") {
      const succeeded = this.#random() < effect.frontRate
      if (succeeded) {
        this.#state.enemy[effect.outcomeField] = "win"
        this.#state.enemy[effect.streakField] =
          (this.#state.enemy[effect.streakField] ?? 0) + 1
        this.#state.logs.push(
          `${this.#state.enemy.name}投掷成功，连胜继续`
        )
        this.#resolveEnemyEffect({
          type: "damagePlayer",
          value: effect.successDamage
        })
      } else {
        this.#state.enemy[effect.outcomeField] = "loss"
        this.#state.enemy[effect.streakField] = 0
        const result = receiveDamage(
          this.#state.enemy,
          effect.failureSelfDamage
        )
        const message =
          `${this.#state.enemy.name}投掷失败，` +
          `自身受到${result.hpDamage}点伤害`
        this.#state.logs.push(message)
        this.#recordResolutionEvent("ENEMY_EFFECT", {
          effect: {
            ...effect,
            result: "back",
            value: result.hpDamage
          },
          hpDamage: result.hpDamage,
          message
        })
      }
      return
    }
    if (effect.type === "activateProbabilityConvergence") {
      this.#state.enemy.probabilityConvergenceActive = true
      this.#state.enemy.probabilityConvergenceFactor = effect.factor
      const message =
        `下一回合所有硬币概率向50%收拢` +
        `（保留${Math.round(effect.factor * 100)}%偏差）`
      this.#state.logs.push(message)
      this.#recordResolutionEvent("ENEMY_EFFECT", { effect, message })
      return
    }
    if (effect.type === "enableRerollReview") {
      this.#state.enemy.rerollReviewActive = true
      const message = "下一回合第一次投掷可在揭晓后选择重投"
      this.#state.logs.push(message)
      this.#recordResolutionEvent("ENEMY_EFFECT", { effect, message })
      return
    }
    if (effect.type === "resultTax") {
      if (this.#state.enemy.lastPlayerSide === "front") {
        this.#resolveEnemyEffect({
          type: "shieldSelf",
          value: effect.frontShield
        })
      } else {
        this.#resolveEnemyEffect({
          type: "damagePlayer",
          value: effect.backDamage
        })
      }
      return
    }
    if (effect.type === "toggleHouseSide") {
      const previous = this.#state.enemy.houseSide
      this.#state.enemy.houseSide =
        previous === "front" ? "back" : "front"
      this.#state.enemy.houseMechanicActive = true
      const sideName =
        this.#state.enemy.houseSide === "front" ? "正面" : "反面"
      const message = `庄家宣布：本轮庄家面为${sideName}`
      this.#state.logs.push(message)
      this.#recordResolutionEvent("ENEMY_EFFECT", { effect, message })
      return
    }
    if (effect.type === "settleHouseEdge") {
      const edge = Math.min(
        this.#state.enemy.houseEdge ?? 0,
        effect.maxEdge
      )
      const damage = effect.baseDamage + edge * effect.damagePerEdge
      this.#resolveEnemyEffect({
        type: "damagePlayer",
        value: damage
      })
      this.#state.enemy.houseEdge = 0
      const message = `庄家优势结算完毕，优势归零`
      this.#state.logs.push(message)
      this.#recordResolutionEvent("ENEMY_EFFECT", { effect, message })
      return
    }
    if (effect.type === "offerLoan") {
      this.#state.pendingDecision = {
        type: "LOAN_OFFER",
        title: "高息垫款",
        message:
          `接受可立即获得${effect.chips}筹码，但增加` +
          `${effect.debt}层债务；拒绝则债主获得护盾。`,
        chips: effect.chips,
        debt: effect.debt,
        rejectShield: effect.rejectShield,
        options: [
          { id: "accept", label: "接受垫款", enabled: true },
          { id: "reject", label: "拒绝垫款", enabled: true }
        ]
      }
      this.#state.status = BattleStatus.PLAYER_DECIDING
      return true
    }
    if (effect.type === "increaseDebt") {
      this.#state.enemy.debt += effect.value
      const message = `债务增加${effect.value}层，当前${this.#state.enemy.debt}层`
      this.#state.logs.push(message)
      this.#recordResolutionEvent("ENEMY_EFFECT", { effect, message })
      return
    }
    if (effect.type === "collectDebt") {
      const debt = this.#state.enemy.debt ?? 0
      if (debt <= 0) {
        this.#state.logs.push("当前没有债务，催收作废")
        return
      }
      const chipCost = debt * effect.chipPerDebt
      const hpCost = debt * effect.hpPerDebt
      this.#state.pendingDecision = {
        type: "DEBT_COLLECTION",
        title: "到期催收",
        message:
          `清偿${debt}层债务：支付${chipCost}筹码，` +
          `或失去${hpCost}点生命。`,
        debt,
        chipCost,
        hpCost,
        options: [
          {
            id: "pay_chips",
            label: `支付${chipCost}筹码`,
            enabled: this.#state.player.chips >= chipCost
          },
          {
            id: "pay_hp",
            label: `失去${hpCost}生命`,
            enabled: true
          }
        ]
      }
      this.#state.status = BattleStatus.PLAYER_DECIDING
      return true
    }
    throw new Error(`不支持的敌人意图效果：${effect.type}`)
  }

  #resolveDirectHpLoss(value, source) {
    const hpDamage = Math.min(this.#state.player.hp, Math.max(0, value))
    this.#state.player.hp -= hpDamage
    const message = `${source}使玩家失去${hpDamage}点生命`
    this.#state.logs.push(message)
    this.#recordResolutionEvent("ENEMY_EFFECT", {
      effect: { type: "directHpLoss", value: hpDamage },
      hpDamage,
      message
    })
    if (this.#state.player.hp <= 0) {
      const death = this.#relicSystem.trigger(
        RelicTrigger.BEFORE_DEATH,
        { player: this.#state.player }
      )
      this.#state.logs.push(...death.logs)
      this.#state.player.relicIds = this.#relicSystem.getRelicIds()
      this.#state.player.bannedRelicIds =
        this.#relicSystem.getBannedRelicIds()
    }
  }

  #updateHouseEdge(side) {
    if (!this.#state.enemy.houseMechanicActive) {
      return
    }
    const before = this.#state.enemy.houseEdge ?? 0
    const max = this.#state.enemy.maxHouseEdge ?? 4
    const matched = side === this.#state.enemy.houseSide
    this.#state.enemy.houseEdge = matched
      ? Math.min(max, before + 1)
      : Math.max(0, before - 1)
    const sideName = side === "front" ? "正面" : "反面"
    const message = matched
      ? `${sideName}符合庄家面，庄家优势增加至${this.#state.enemy.houseEdge}`
      : `${sideName}偏离庄家面，庄家优势降低至${this.#state.enemy.houseEdge}`
    this.#state.logs.push(message)
    this.#recordResolutionEvent("ENEMY_REACTION", {
      side,
      matched,
      houseEdge: this.#state.enemy.houseEdge,
      message
    })
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
    const modified = this.#relicSystem.trigger(
      RelicTrigger.PROBABILITY_MODIFY,
      {
        rate: base,
        luck: this.#state.player.luck
      }
    )
    if (
      this.#state.enemy.probabilityConvergenceActive &&
      Math.abs(this.#state.player.luck) < 10
    ) {
      const factor =
        this.#state.enemy.probabilityConvergenceFactor ?? 0.5
      return {
        ...modified,
        rate: clamp(0.5 + (modified.rate - 0.5) * factor, 0, 1),
        logs: [
          ...modified.logs,
          "规则篡改：最终概率向50%收拢"
        ]
      }
    }
    return modified
  }

  #previewCoinEffect(coin, side) {
    return this.#relicSystem.trigger(
      RelicTrigger.COIN_EFFECT_MODIFY,
      {
        player: this.#state.player,
        coin,
        side,
        effect:
          side === "front" ? coin.frontEffect : coin.backEffect
      }
    ).effect
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
