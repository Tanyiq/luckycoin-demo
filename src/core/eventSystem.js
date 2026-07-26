import {
  getUpgradeableCoins,
  upgradeCoin
} from "./coinProgression.js"
import {
  HealthRecoverySource,
  recoverHealth
} from "./healthSystem.js"
import { RelicRewardSystem } from "./relicRewardSystem.js"
import { earnChips, spendChips } from "./chipSystem.js"
import { clampLuck } from "./luckSystem.js"
import { recordCoinDiscovery } from "./discoverySystem.js"

export const EventStatus = Object.freeze({
  SELECTING_OPTION: "SELECTING_OPTION",
  SELECTING_UPGRADE_TARGET: "SELECTING_UPGRADE_TARGET",
  COMPLETED: "COMPLETED"
})

export const FateSpringOption = Object.freeze({
  RECOVER_HP: "recover_hp",
  SACRIFICE_HP_UPGRADE_COIN: "sacrifice_hp_upgrade_coin",
  SACRIFICE_MAX_HP_RELIC: "sacrifice_max_hp_relic"
})

export class FateSpringEvent {
  #player
  #coinConfigs
  #state
  #relicRewards

  constructor({
    player,
    coinConfigs,
    relicDefinitions = {},
    random = Math.random
  }) {
    this.#player = player
    this.#coinConfigs = coinConfigs
    this.#relicRewards = new RelicRewardSystem({
      player,
      relicDefinitions,
      random
    })
    this.#state = {
      eventId: "fate_spring",
      name: "命运泉水",
      title: "经审计的奇迹",
      description: [
        "命运泉水散发着可以恢复生命的微光。",
        "旁边的工作人员提醒你：免费项目只包括恢复，改变人生需要付费。"
      ],
      status: EventStatus.SELECTING_OPTION,
      selectedOption: null,
      result: null
    }
  }

  getOptions() {
    return [
      {
        id: FateSpringOption.RECOVER_HP,
        name: "汲取泉水",
        description: "恢复25点生命",
        available: true
      },
      {
        id: FateSpringOption.SACRIFICE_HP_UPGRADE_COIN,
        name: "献祭命运",
        description: "失去20点生命，强化一枚硬币",
        available:
          this.#player.hp > 20 &&
          getUpgradeableCoins(this.#player, this.#coinConfigs).length > 0
      },
      {
        id: FateSpringOption.SACRIFICE_MAX_HP_RELIC,
        name: "献祭生命本源",
        description: "失去20点最大生命，随机获得一个遗物",
        available:
          this.#player.maxHp > 20 &&
          this.#relicRewards.getAvailableRelicIds({
            excludeSpecial: true
          }).length > 0
      }
    ]
  }

  chooseOption(optionId) {
    if (this.#state.status !== EventStatus.SELECTING_OPTION) {
      throw new Error("当前事件状态不能选择选项")
    }
    const option = this.getOptions().find(({ id }) => id === optionId)
    if (!option || !option.available) {
      throw new Error("该事件选项当前不可用")
    }
    this.#state.selectedOption = optionId

    if (optionId === FateSpringOption.RECOVER_HP) {
      const hpBefore = this.#player.hp
      const recovery = recoverHealth(
        this.#player,
        25,
        HealthRecoverySource.EVENT
      )
      this.#state.result = {
        eventId: this.#state.eventId,
        optionId,
        hpBefore,
        hpAfter: this.#player.hp,
        recoveredHp: recovery.recovered
      }
      this.#state.status = EventStatus.COMPLETED
    } else if (
      optionId === FateSpringOption.SACRIFICE_HP_UPGRADE_COIN
    ) {
      this.#state.status = EventStatus.SELECTING_UPGRADE_TARGET
    } else {
      const maxHpBefore = this.#player.maxHp
      const hpBefore = this.#player.hp
      const relic = this.#relicRewards.acquireRandom({
        excludeSpecial: true
      })
      this.#player.maxHp -= 20
      this.#player.hp = Math.min(this.#player.hp, this.#player.maxHp)
      this.#state.result = {
        eventId: this.#state.eventId,
        optionId,
        maxHpBefore,
        maxHpAfter: this.#player.maxHp,
        hpBefore,
        hpAfter: this.#player.hp,
        relicId: relic.relicId
      }
      this.#state.status = EventStatus.COMPLETED
    }
    return this.getState()
  }

  getUpgradeableCoins() {
    return getUpgradeableCoins(this.#player, this.#coinConfigs)
  }

  selectUpgradeTarget(coinUid) {
    if (this.#state.status !== EventStatus.SELECTING_UPGRADE_TARGET) {
      throw new Error("当前事件状态不能选择强化目标")
    }
    if (this.#player.hp <= 20) {
      throw new Error("生命不足，献祭后必须至少保留1点生命")
    }

    const target = this.#player.coins.find(({ uid }) => uid === coinUid)
    if (!target || !getUpgradeableCoins(
      this.#player,
      this.#coinConfigs
    ).some(({ uid }) => uid === coinUid)) {
      throw new Error("该硬币不能强化")
    }

    const hpBefore = this.#player.hp
    const upgraded = upgradeCoin(
      this.#player,
      this.#coinConfigs,
      coinUid
    )
    this.#player.runStats.upgradeCount += 1
    this.#player.hp -= 20
    this.#state.result = {
      eventId: this.#state.eventId,
      optionId: this.#state.selectedOption,
      hpBefore,
      hpAfter: this.#player.hp,
      ...upgraded
    }
    this.#state.status = EventStatus.COMPLETED
    return this.getState()
  }

  getState() {
    return {
      ...this.#state,
      result: this.#state.result ? { ...this.#state.result } : null
    }
  }
}

export class ConfiguredEvent {
  #player
  #config
  #coinConfigs
  #coinPools
  #random
  #state

  constructor({
    player,
    eventConfig,
    coinConfigs,
    coinPools,
    random = Math.random
  }) {
    this.#player = player
    this.#config = eventConfig
    this.#coinConfigs = coinConfigs
    this.#coinPools = coinPools
    this.#random = random
    this.#state = {
      eventId: eventConfig.id,
      name: eventConfig.name,
      title: eventConfig.title,
      description: [...eventConfig.description],
      status: EventStatus.SELECTING_OPTION,
      selectedOption: null,
      result: null
    }
  }

  getOptions() {
    return this.#config.options.map((option) => ({
      id: option.id,
      name: option.name,
      description: option.description,
      available: this.#meetsRequirements(option.requirements)
    }))
  }

  chooseOption(optionId) {
    if (this.#state.status !== EventStatus.SELECTING_OPTION) {
      throw new Error("当前事件状态不能选择选项")
    }
    const config = this.#config.options.find(({ id }) => id === optionId)
    const option = this.getOptions().find(({ id }) => id === optionId)
    if (!config || !option?.available) {
      throw new Error("该事件选项当前不可用")
    }
    this.#state.selectedOption = optionId
    if (config.targetEffect) {
      this.#state.status = EventStatus.SELECTING_UPGRADE_TARGET
      return this.getState()
    }
    const messages = []
    this.#applyEffects(config.effects ?? [], messages)
    this.#complete(messages)
    return this.getState()
  }

  getUpgradeableCoins() {
    return getUpgradeableCoins(this.#player, this.#coinConfigs)
  }

  selectUpgradeTarget(coinUid) {
    if (this.#state.status !== EventStatus.SELECTING_UPGRADE_TARGET) {
      throw new Error("当前事件状态不能选择强化目标")
    }
    const option = this.#config.options.find(
      ({ id }) => id === this.#state.selectedOption
    )
    const effect = option.targetEffect
    const target = this.#player.coins.find(({ uid }) => uid === coinUid)
    if (
      !target ||
      !this.getUpgradeableCoins().some(({ uid }) => uid === coinUid)
    ) {
      throw new Error("该硬币不能强化")
    }
    spendChips(this.#player, effect.chipCost)
    const messages = [`支付${effect.chipCost}筹码`]
    if (this.#random() < effect.successRate) {
      const upgraded = upgradeCoin(
        this.#player,
        this.#coinConfigs,
        coinUid
      )
      this.#player.runStats.upgradeCount += 1
      messages.push(
        `${this.#coinConfigs[upgraded.coinId].name}强化至 Lv.${upgraded.newLevel}`
      )
    } else {
      messages.push("翻新失败，柜台确认硬币至少比刚才更干净")
    }
    this.#complete(messages)
    return this.getState()
  }

  getState() {
    return {
      ...this.#state,
      description: [...this.#state.description],
      result: this.#state.result
        ? {
            ...this.#state.result,
            messages: [...this.#state.result.messages]
          }
        : null
    }
  }

  #meetsRequirements(requirements = {}) {
    if (
      requirements.minChips !== undefined &&
      (this.#player.chips ?? 0) < requirements.minChips
    ) {
      return false
    }
    if (
      requirements.hpAbove !== undefined &&
      this.#player.hp <= requirements.hpAbove
    ) {
      return false
    }
    if (
      requirements.luckAbove !== undefined &&
      this.#player.luck <= requirements.luckAbove
    ) {
      return false
    }
    if (
      requirements.luckBelow !== undefined &&
      this.#player.luck >= requirements.luckBelow
    ) {
      return false
    }
    if (
      requirements.hasUpgradeableCoin &&
      this.getUpgradeableCoins().length === 0
    ) {
      return false
    }
    return true
  }

  #applyEffects(effects, messages) {
    for (const effect of effects) {
      if (effect.type === "changeChips") {
        if (effect.value >= 0) {
          earnChips(this.#player, effect.value)
          messages.push(`获得${effect.value}筹码`)
        } else {
          spendChips(this.#player, -effect.value)
          messages.push(`支付${-effect.value}筹码`)
        }
      } else if (effect.type === "changeLuck") {
        const before = this.#player.luck
        this.#player.luck = clampLuck(before + effect.value)
        const changed = this.#player.luck - before
        messages.push(`幸运${changed >= 0 ? "+" : ""}${changed}`)
      } else if (effect.type === "changeHp") {
        const before = this.#player.hp
        this.#player.hp = Math.max(
          1,
          Math.min(this.#player.maxHp, before + effect.value)
        )
        messages.push(`生命${this.#player.hp - before}`)
      } else if (effect.type === "randomOutcome") {
        const front = this.#random() < effect.frontRate
        messages.push(front ? "概率判定：成功" : "概率判定：失败")
        this.#applyEffects(
          front ? effect.frontEffects : effect.backEffects,
          messages
        )
      } else if (effect.type === "acquireRandomCoin") {
        const pool = this.#coinPools[effect.coinPoolId]
        if (!pool?.length) {
          throw new Error(`事件硬币池不存在：${effect.coinPoolId}`)
        }
        const coinId = pool[Math.floor(this.#random() * pool.length)]
        const coin = {
          uid: `${coinId}_${this.#player.nextCoinSequence++}`,
          coinId,
          level: 1
        }
        this.#player.coins.push(coin)
        if (!this.#player.unlockedCoinIds.includes(coinId)) {
          this.#player.unlockedCoinIds.push(coinId)
        }
        recordCoinDiscovery(this.#player, coinId)
        messages.push(`获得“${this.#coinConfigs[coinId].name}”`)
      } else {
        throw new Error(`不支持的事件效果：${effect.type}`)
      }
    }
  }

  #complete(messages) {
    this.#state.result = {
      eventId: this.#state.eventId,
      optionId: this.#state.selectedOption,
      messages
    }
    this.#state.status = EventStatus.COMPLETED
  }
}
