import {
  getUpgradeableCoins,
  isCoinUpgradeable,
  upgradeCoin
} from "./coinProgression.js"
import { RelicSystem, RelicTrigger } from "./relicSystem.js"
import { earnChips } from "./chipSystem.js"

export const RewardStatus = Object.freeze({
  SHOWING_EXP: "SHOWING_EXP",
  SHOWING_FIXED_REWARD: "SHOWING_FIXED_REWARD",
  SELECTING_REWARD_TYPE: "SELECTING_REWARD_TYPE",
  SELECTING_NEW_COIN: "SELECTING_NEW_COIN",
  SELECTING_UPGRADE_TARGET: "SELECTING_UPGRADE_TARGET",
  SELECTING_REMOVE_TARGET: "SELECTING_REMOVE_TARGET",
  COMPLETED: "COMPLETED"
})

export const RewardType = Object.freeze({
  ADD_COIN: "addCoin",
  UPGRADE_COIN: "upgradeCoin",
  REMOVE_COIN: "removeCoin"
})

function clonePlayer(player) {
  return {
    ...player,
    coins: player.coins.map((coin) => ({ ...coin })),
    unlockedCoinIds: [...player.unlockedCoinIds],
    relicIds: [...(player.relicIds ?? [])],
    bannedRelicIds: [...(player.bannedRelicIds ?? [])]
  }
}

function levelForExp(exp, thresholds) {
  let level = 1
  thresholds.forEach((threshold, index) => {
    if (exp >= threshold) {
      level = index + 1
    }
  })
  return level
}

function drawUnique(items, count, random) {
  const pool = [...items]
  const selected = []
  while (selected.length < count && pool.length > 0) {
    const index = Math.floor(random() * pool.length)
    selected.push(pool.splice(index, 1)[0])
  }
  return selected
}

export class RewardSystem {
  #player
  #config
  #coinConfigs
  #coinPools
  #thresholds
  #random
  #relicSystem
  #state

  constructor({
    player,
    rewardConfig,
    coinConfigs,
    coinPools,
    experienceThresholds,
    relicDefinitions = {},
    random = Math.random
  }) {
    this.#player = player
    this.#config = rewardConfig
    this.#coinConfigs = coinConfigs
    this.#coinPools = coinPools
    this.#thresholds = experienceThresholds
    this.#random = random
    this.#relicSystem = new RelicSystem({
      relicDefinitions,
      relicIds: player.relicIds ?? [],
      bannedRelicIds: player.bannedRelicIds ?? [],
      random
    })

    const expBefore = player.exp
    const chipsBefore = player.chips ?? 0
    const levelBefore = player.level
    player.exp += rewardConfig.exp
    earnChips(player, rewardConfig.chips ?? 0)
    player.level = levelForExp(player.exp, experienceThresholds)
    this.#state = {
      status: RewardStatus.SHOWING_EXP,
      sourceBattleId: rewardConfig.battleId,
      expBefore,
      expGained: rewardConfig.exp,
      expAfter: player.exp,
      chipsBefore,
      chipsGained: rewardConfig.chips ?? 0,
      chipsAfter: player.chips,
      levelBefore,
      levelAfter: player.level,
      didLevelUp: player.level > levelBefore,
      mode: rewardConfig.mode,
      selectedAction: null,
      coinCandidates: [],
      result: null
    }
  }

  continueAfterExp() {
    this.#requireStatus(RewardStatus.SHOWING_EXP)
    if (!this.#state.didLevelUp || this.#config.mode === "none") {
      this.#state.status = RewardStatus.COMPLETED
    } else if (this.#config.mode === "fixed") {
      this.#state.status = RewardStatus.SHOWING_FIXED_REWARD
    } else {
      this.#state.status = RewardStatus.SELECTING_REWARD_TYPE
    }
    return this.getState()
  }

  claimFixedReward() {
    this.#requireStatus(RewardStatus.SHOWING_FIXED_REWARD)
    const reward = this.#config.fixedReward
    if (reward.type !== RewardType.ADD_COIN) {
      throw new Error(`不支持的固定奖励：${reward.type}`)
    }
    const coin = this.#addCoin(reward.coinId)
    this.#state.result = {
      type: RewardType.ADD_COIN,
      coinId: coin.coinId,
      coinUid: coin.uid,
      message: `获得“${this.#coinConfigs[coin.coinId].name}”`
    }
    this.#state.status = RewardStatus.COMPLETED
    return this.getState()
  }

  chooseRewardType(type) {
    this.#requireStatus(RewardStatus.SELECTING_REWARD_TYPE)
    this.#state.selectedAction = type

    if (type === RewardType.ADD_COIN) {
      const pool = this.#coinPools[this.#config.coinPoolId]
      if (!pool || pool.length === 0) {
        throw new Error("当前硬币池为空")
      }
      this.#state.coinCandidates = drawUnique(
        pool,
        Math.min(3, pool.length),
        this.#random
      )
      this.#state.status = RewardStatus.SELECTING_NEW_COIN
    } else if (type === RewardType.UPGRADE_COIN) {
      if (this.getUpgradeableCoins().length === 0) {
        throw new Error("没有可强化的硬币")
      }
      this.#state.status = RewardStatus.SELECTING_UPGRADE_TARGET
    } else if (type === RewardType.REMOVE_COIN) {
      if (this.#player.coins.length <= 3) {
        throw new Error("硬币库至少保留3枚硬币")
      }
      this.#state.status = RewardStatus.SELECTING_REMOVE_TARGET
    } else {
      throw new Error(`未知奖励类型：${type}`)
    }
    return this.getState()
  }

  selectNewCoin(coinId) {
    this.#requireStatus(RewardStatus.SELECTING_NEW_COIN)
    if (!this.#state.coinCandidates.includes(coinId)) {
      throw new Error("只能选择展示的奖励硬币")
    }
    const coin = this.#addCoin(coinId)
    this.#complete({
      type: RewardType.ADD_COIN,
      coinId,
      coinUid: coin.uid,
      message: `获得“${this.#coinConfigs[coinId].name}”`
    })
    return this.getState()
  }

  selectUpgradeCoin(coinUid) {
    this.#requireStatus(RewardStatus.SELECTING_UPGRADE_TARGET)
    const upgraded = upgradeCoin(
      this.#player,
      this.#coinConfigs,
      coinUid
    )
    this.#player.runStats.upgradeCount += 1
    const coin = this.#player.coins.find(({ uid }) => uid === coinUid)
    this.#complete({
      type: RewardType.UPGRADE_COIN,
      ...upgraded,
      message: `“${this.#coinConfigs[coin.coinId].name}”强化至${coin.level}级`
    })
    return this.getState()
  }

  selectRemoveCoin(coinUid) {
    this.#requireStatus(RewardStatus.SELECTING_REMOVE_TARGET)
    if (this.#player.coins.length <= 3) {
      throw new Error("硬币库至少保留3枚硬币")
    }
    const index = this.#player.coins.findIndex(({ uid }) => uid === coinUid)
    if (index === -1) {
      throw new Error("找不到要删除的硬币")
    }
    const [coin] = this.#player.coins.splice(index, 1)
    this.#player.runStats.removeCount += 1
    const relicResult = this.#relicSystem.trigger(
      RelicTrigger.COIN_REMOVED,
      { player: this.#player }
    )
    this.#complete({
      type: RewardType.REMOVE_COIN,
      coinId: coin.coinId,
      coinUid,
      message:
        `删除“${this.#coinConfigs[coin.coinId].name}”` +
        (relicResult.logs.length
          ? `；${relicResult.logs.join("；")}`
          : "")
    })
    return this.getState()
  }

  getUpgradeableCoins() {
    return getUpgradeableCoins(this.#player, this.#coinConfigs)
  }

  getState() {
    return {
      ...this.#state,
      coinCandidates: [...this.#state.coinCandidates],
      result: this.#state.result ? { ...this.#state.result } : null,
      player: clonePlayer(this.#player)
    }
  }

  #isUpgradeable(coin) {
    return isCoinUpgradeable(coin, this.#coinConfigs)
  }

  #addCoin(coinId) {
    if (!this.#coinConfigs[coinId]) {
      throw new Error(`找不到硬币配置：${coinId}`)
    }
    const coin = {
      uid: `${coinId}_${this.#player.nextCoinSequence++}`,
      coinId,
      level: 1
    }
    this.#player.coins.push(coin)
    if (!this.#player.unlockedCoinIds.includes(coinId)) {
      this.#player.unlockedCoinIds.push(coinId)
    }
    return coin
  }

  #complete(result) {
    this.#state.result = result
    this.#state.status = RewardStatus.COMPLETED
  }

  #requireStatus(expected) {
    if (this.#state.status !== expected) {
      throw new Error(
        `当前奖励状态${this.#state.status}不能执行该操作`
      )
    }
  }
}
