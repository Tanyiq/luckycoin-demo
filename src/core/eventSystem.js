import {
  getUpgradeableCoins,
  upgradeCoin
} from "./coinProgression.js"
import {
  HealthRecoverySource,
  recoverHealth
} from "./healthSystem.js"
import { RelicRewardSystem } from "./relicRewardSystem.js"

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
