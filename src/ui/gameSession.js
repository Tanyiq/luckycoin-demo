import { BattleEngine, BattleStatus } from "../core/battleEngine.js"
import {
  ChapterController,
  ChapterStatus
} from "../core/chapterController.js"
import {
  EventStatus,
  FateSpringEvent
} from "../core/eventSystem.js"
import {
  createBattlePlayerConfig,
  createInitialPlayerProgress,
  saveBattlePlayerState
} from "../core/playerProgress.js"
import { RelicRewardSystem } from "../core/relicRewardSystem.js"
import {
  RewardStatus,
  RewardSystem
} from "../core/rewardSystem.js"
import {
  ShopCategory,
  ShopSystem
} from "../core/shopSystem.js"
import { createRunSummary } from "../core/runSummary.js"
import { chapters, NodeType } from "../data/chapters.js"
import { coins } from "../data/coins.js"
import { enemies } from "../data/enemies.js"
import { gameConfig } from "../data/gameConfig.js"
import { narrative } from "../data/narrative.js"
import { players } from "../data/players.js"
import {
  battleRewards,
  coinPools,
  experienceThresholds
} from "../data/progression.js"
import { relics } from "../data/relics.js"
import {
  ResourceStatus,
  resourceManifest
} from "../data/resources.js"
import { shops, shopPriceTables } from "../data/shops.js"
import { createBattlePresentation } from "./battlePresentation.js"
import {
  TutorialHintId,
  TutorialSystem
} from "./tutorialSystem.js"

export const Screen = Object.freeze({
  MAP: "MAP",
  BATTLE: "BATTLE",
  REWARD: "REWARD",
  EVENT: "EVENT",
  SHOP: "SHOP",
  RELIC_REWARD: "RELIC_REWARD",
  SUMMARY: "SUMMARY"
})

function clonePlayer(player) {
  return {
    ...player,
    coins: player.coins.map((coin) => ({ ...coin })),
    relicIds: [...player.relicIds],
    bannedRelicIds: [...player.bannedRelicIds],
    unlockedCoinIds: [...player.unlockedCoinIds],
    runStats: { ...player.runStats }
  }
}

function findById(collection, id) {
  return Object.values(collection).find((item) => item.id === id)
}

const battleTutorialAnchors = Object.freeze([
  "coin",
  "shield",
  "luck"
])

export class GameSession {
  #random
  #animationDuration
  #listeners = new Set()
  #player
  #chapter
  #node
  #battle
  #battleState
  #reward
  #rewardState
  #event
  #eventState
  #shop
  #shopState
  #relicReward
  #relicCandidates = []
  #screen = Screen.MAP
  #busy = false
  #animation = null
  #message = null
  #shopSelection = null
  #summary = null
  #buildOpen = false
  #resourceInspectorOpen = false
  #resourceStatuses = resourceManifest.map((resource) => ({
    id: resource.id,
    status: resource.path
      ? ResourceStatus.UNCHECKED
      : ResourceStatus.MISSING_CONFIG
  }))
  #tutorial = new TutorialSystem()

  constructor({
    random = Math.random,
    animationDuration = null
  } = {}) {
    this.#random = random
    this.#animationDuration = animationDuration
    this.startRun()
  }

  subscribe(listener) {
    this.#listeners.add(listener)
    listener(this.getSnapshot())
    return () => this.#listeners.delete(listener)
  }

  startRun() {
    this.#tutorial.clearAnchors([
      ...battleTutorialAnchors,
      "reward",
      "relic"
    ])
    this.#player = createInitialPlayerProgress(players.tutorialPlayer)
    this.#chapter = new ChapterController({
      chapterConfig: chapters.chapter0,
      playerProgress: this.#player,
      enemyConfigs: enemies
    })
    this.#chapter.startChapter()
    this.#node = null
    this.#battle = null
    this.#reward = null
    this.#event = null
    this.#shop = null
    this.#relicReward = null
    this.#relicCandidates = []
    this.#screen = Screen.MAP
    this.#busy = false
    this.#animation = null
    this.#message = null
    this.#shopSelection = null
    this.#summary = null
    this.#buildOpen = false
    this.#resourceInspectorOpen = false
    this.#emit()
  }

  enterCurrentNode() {
    this.#clearMessage()
    this.#node = this.#chapter.enterCurrentNode()
    if (this.#node.type === NodeType.EVENT) {
      this.#event = new FateSpringEvent({
        player: this.#player,
        coinConfigs: coins,
        relicDefinitions: relics,
        random: this.#random
      })
      this.#eventState = this.#event.getState()
      this.#screen = Screen.EVENT
    } else if (this.#node.type === NodeType.SHOP) {
      const config = findById(shops, this.#node.shopId)
      this.#shop = new ShopSystem({
        player: this.#player,
        shopConfig: config,
        priceTable: shopPriceTables[config.priceTableId],
        coinConfigs: coins,
        relicDefinitions: relics,
        random: this.#random
      })
      this.#shopState = this.#shop.getState()
      this.#screen = Screen.SHOP
    } else {
      this.#battle = new BattleEngine({
        playerConfig: createBattlePlayerConfig(this.#player),
        enemyConfig: enemies[this.#node.enemyId],
        coinConfigs: coins,
        relicDefinitions: relics,
        drawCount: gameConfig.drawCount,
        maxCoinsPerTurn: gameConfig.maxCoinsPerTurn,
        random: this.#random
      })
      this.#battleState = this.#battle.start()
      this.#screen = Screen.BATTLE
      this.#tutorial.trigger(TutorialHintId.COIN_BASICS)
      this.#triggerLuckTutorial()
    }
    this.#emit()
  }

  async playCoin(coinUid) {
    if (this.#busy || this.#screen !== Screen.BATTLE) {
      return
    }
    const selected = this.#battleState.drawnCoins.find(
      (coin) => coin.uid === coinUid
    )
    if (!selected?.isUsable) {
      throw new Error("当前生命不足以使用这枚硬币")
    }

    this.#tutorial.dismissActiveAnchor(battleTutorialAnchors, {
      advance: false
    })
    this.#busy = true
    const beforeState = this.#battleState
    const logStart = beforeState.logs.length
    this.#battleState = this.#battle.playCoins([coinUid])
    const presentation = createBattlePresentation({
      beforeState,
      afterState: this.#battleState,
      nodeType: this.#node.type,
      newLogs: this.#battleState.logs.slice(logStart)
    })
    for (
      let stepIndex = 0;
      stepIndex < presentation.steps.length;
      stepIndex += 1
    ) {
      const activeStep = presentation.steps[stepIndex]
      this.#animation = {
        ...presentation,
        activeStepIndex: stepIndex,
        activeStep
      }
      this.#triggerBattleStepTutorial(presentation, stepIndex)
      this.#emit()
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          this.#animationDuration ?? activeStep.duration
        )
      )
    }
    this.#animation = null
    this.#busy = false

    if (
      this.#battleState.status === BattleStatus.VICTORY ||
      this.#battleState.status === BattleStatus.DEFEAT
    ) {
      saveBattlePlayerState(this.#player, this.#battleState)
    }
    if (this.#battleState.status === BattleStatus.VICTORY) {
      this.#openReward()
    } else if (this.#battleState.status === BattleStatus.DEFEAT) {
      this.#chapter.failCurrentNode({
        success: false,
        resultType: "BATTLE_DEFEAT"
      })
      this.#openSummary()
    } else {
      this.#triggerLuckTutorial()
      this.#tutorial.advance()
    }
    this.#emit()
  }

  continueReward() {
    this.#rewardState = this.#reward.continueAfterExp()
    if (this.#rewardState.status === RewardStatus.SELECTING_REWARD_TYPE) {
      this.#tutorial.trigger(TutorialHintId.BUILD_REWARD)
    }
    this.#emit()
  }

  claimFixedReward() {
    this.#rewardState = this.#reward.claimFixedReward()
    this.#emit()
  }

  chooseRewardType(type) {
    this.#tutorial.dismissActiveAnchor("reward", { advance: false })
    this.#rewardState = this.#reward.chooseRewardType(type)
    this.#emit()
  }

  selectRewardCoin(coinId) {
    this.#rewardState = this.#reward.selectNewCoin(coinId)
    this.#emit()
  }

  selectRewardUpgrade(coinUid) {
    this.#rewardState = this.#reward.selectUpgradeCoin(coinUid)
    this.#emit()
  }

  selectRewardRemove(coinUid) {
    this.#rewardState = this.#reward.selectRemoveCoin(coinUid)
    this.#emit()
  }

  completeReward() {
    if (this.#rewardState.status !== RewardStatus.COMPLETED) {
      throw new Error("奖励尚未完成")
    }
    const result = {
      success: true,
      resultType: "BATTLE_VICTORY",
      rewardResult: this.#rewardState.result
    }
    if (this.#node.type === NodeType.BOSS_BATTLE) {
      this.#relicReward = new RelicRewardSystem({
        player: this.#player,
        relicDefinitions: relics,
        random: this.#random
      })
      this.#relicCandidates = this.#relicReward.drawCandidates(3)
      if (this.#relicCandidates.length > 0) {
        this.#screen = Screen.RELIC_REWARD
        this.#tutorial.trigger(TutorialHintId.RELIC_PASSIVE)
        this.#emit()
        return
      }
    }
    this.#finishNode(result)
  }

  selectBossRelic(relicId) {
    this.#tutorial.dismissActiveAnchor("relic", { advance: false })
    const relicReward = this.#relicReward.acquire(relicId)
    this.#finishNode({
      success: true,
      resultType: "BATTLE_VICTORY",
      rewardResult: this.#rewardState.result,
      relicReward
    })
  }

  chooseEventOption(optionId) {
    this.#eventState = this.#event.chooseOption(optionId)
    if (this.#eventState.result?.relicId) {
      this.#tutorial.trigger(TutorialHintId.RELIC_PASSIVE)
    }
    this.#emit()
  }

  selectEventUpgrade(coinUid) {
    this.#eventState = this.#event.selectUpgradeTarget(coinUid)
    this.#emit()
  }

  completeEvent() {
    if (this.#eventState.status !== EventStatus.COMPLETED) {
      throw new Error("事件尚未完成")
    }
    this.#tutorial.dismissActiveAnchor("relic", { advance: false })
    this.#finishNode({
      success: true,
      resultType: "EVENT_COMPLETED",
      eventResult: this.#eventState.result
    })
  }

  chooseShopListing(listingId) {
    const listing = this.#shopState.inventory.find(
      (item) => item.listingId === listingId
    )
    if (!listing) {
      throw new Error("找不到该商品")
    }
    if (listing.category === ShopCategory.COIN) {
      const result = this.#shop.buyCoin(listingId)
      this.#shopState = result.state
      this.#message = `获得“${coins[result.transaction.coinId].name}”`
    } else if (listing.category === ShopCategory.RELIC) {
      const result = this.#shop.buyRelic(listingId)
      this.#shopState = result.state
      this.#message =
        `获得遗物“${relics[result.transaction.relicId].name}”`
      this.#tutorial.trigger(TutorialHintId.RELIC_PASSIVE)
    } else {
      this.#shopSelection = {
        listingId,
        category: listing.category
      }
    }
    this.#emit()
  }

  selectShopTarget(coinUid) {
    const { listingId, category } = this.#shopSelection ?? {}
    if (category === ShopCategory.UPGRADE) {
      const result = this.#shop.upgrade(listingId, coinUid)
      this.#shopState = result.state
      this.#message =
        `${coins[result.transaction.coinId].name}强化至` +
        ` Lv.${result.transaction.newLevel}`
    } else if (category === ShopCategory.RECYCLE) {
      const result = this.#shop.recycle(listingId, coinUid)
      this.#shopState = result.state
      this.#message =
        `回收“${coins[result.transaction.coinId].name}”，` +
        `获得 ${result.transaction.payout} 筹码`
    } else {
      throw new Error("当前没有选择商店服务")
    }
    this.#shopSelection = null
    this.#emit()
  }

  cancelShopSelection() {
    this.#shopSelection = null
    this.#emit()
  }

  leaveShop() {
    this.#tutorial.dismissActiveAnchor("relic", { advance: false })
    this.#shopState = this.#shop.leave()
    this.#finishNode({
      success: true,
      resultType: "SHOP_COMPLETED"
    })
  }

  reportError(error) {
    this.#message = error.message ?? String(error)
    this.#emit()
  }

  openBuild() {
    if (this.#busy) {
      return
    }
    this.#resourceInspectorOpen = false
    this.#buildOpen = true
    this.#emit()
  }

  closeBuild() {
    this.#buildOpen = false
    this.#emit()
  }

  openResourceInspector() {
    this.#buildOpen = false
    this.#resourceInspectorOpen = true
    this.#emit()
  }

  closeResourceInspector() {
    this.#resourceInspectorOpen = false
    this.#emit()
  }

  updateResourceStatuses(statuses) {
    const statusById = new Map(
      statuses.map(({ id, status }) => [id, status])
    )
    this.#resourceStatuses = resourceManifest.map((resource) => ({
      id: resource.id,
      status:
        statusById.get(resource.id) ??
        (resource.path
          ? ResourceStatus.UNCHECKED
          : ResourceStatus.MISSING_CONFIG)
    }))
    this.#emit()
  }

  dismissTutorial() {
    this.#tutorial.dismissActive()
    this.#emit()
  }

  getSnapshot() {
    const chapterState = this.#chapter.getState()
    const currentNodeView =
      chapterState.status === ChapterStatus.IN_PROGRESS
        ? this.#chapter.getCurrentNodeView()
        : null
    return {
      screen: this.#screen,
      busy: this.#busy,
      animation: this.#animation
        ? {
            ...this.#animation,
            beforeState: this.#animation.beforeState,
            afterState: this.#animation.afterState,
            results: this.#animation.results.map((result) => ({
              ...result,
              effect: result.effect ? { ...result.effect } : null
            })),
            steps: this.#animation.steps.map((step) => ({
              ...step,
              messages: [...step.messages],
              revealedCoinUids: [...step.revealedCoinUids]
            })),
            activeStep: {
              ...this.#animation.activeStep,
              messages: [...this.#animation.activeStep.messages],
              revealedCoinUids: [
                ...this.#animation.activeStep.revealedCoinUids
              ]
            },
            logs: [...this.#animation.logs],
            flags: { ...this.#animation.flags }
          }
        : null,
      message: this.#message,
      tutorial: this.#tutorial.getState(),
      player: clonePlayer(this.#player),
      buildOpen: this.#buildOpen,
      resourceInspector: {
        open: this.#resourceInspectorOpen,
        resources: resourceManifest.map((resource) => ({
          ...resource,
          status:
            this.#resourceStatuses.find(
              ({ id }) => id === resource.id
            )?.status ?? ResourceStatus.UNCHECKED
        }))
      },
      buildPlayer: this.#getBuildPlayer(),
      chapterConfig: chapters.chapter0,
      chapterState,
      currentNodeView,
      narrative,
      battleState: this.#battleState,
      rewardState: this.#rewardState,
      rewardUpgradeTargets:
        this.#rewardState?.status === RewardStatus.SELECTING_UPGRADE_TARGET
          ? this.#reward.getUpgradeableCoins()
          : [],
      eventState: this.#eventState,
      eventOptions:
        this.#screen === Screen.EVENT ? this.#event.getOptions() : [],
      eventUpgradeTargets:
        this.#eventState?.status === EventStatus.SELECTING_UPGRADE_TARGET
          ? this.#event.getUpgradeableCoins()
          : [],
      shopState: this.#shopState,
      shopSelection: this.#shopSelection,
      shopTargets: this.#getShopTargets(),
      relicCandidates: [...this.#relicCandidates],
      summary: this.#summary,
      configs: { coins, enemies, relics }
    }
  }

  #openReward() {
    this.#tutorial.clearAnchors(battleTutorialAnchors)
    this.#reward = new RewardSystem({
      player: this.#player,
      rewardConfig: battleRewards[this.#node.rewardConfigId],
      coinConfigs: coins,
      coinPools,
      experienceThresholds,
      relicDefinitions: relics,
      random: this.#random
    })
    this.#rewardState = this.#reward.getState()
    this.#screen = Screen.REWARD
  }

  #finishNode(result) {
    this.#chapter.completeCurrentNode(result)
    if (this.#chapter.getState().status === ChapterStatus.COMPLETED) {
      this.#openSummary()
    } else {
      this.#screen = Screen.MAP
      this.#node = null
    }
    this.#clearMessage()
    this.#emit()
  }

  #openSummary() {
    this.#summary = createRunSummary({
      chapterState: this.#chapter.getState(),
      player: this.#player,
      coinConfigs: coins,
      relicDefinitions: relics
    })
    this.#screen = Screen.SUMMARY
  }

  #getShopTargets() {
    if (!this.#shopSelection) {
      return []
    }
    return this.#shopSelection.category === ShopCategory.UPGRADE
      ? this.#shop.getUpgradeableCoins()
      : this.#shop.getRecyclableCoins()
  }

  #getBuildPlayer() {
    if (this.#screen !== Screen.BATTLE || !this.#battleState) {
      return clonePlayer(this.#player)
    }
    const displayed =
      this.#animation?.activeStep.displayState.player ??
      this.#battleState.player
    return {
      ...clonePlayer(this.#player),
      hp: displayed.hp,
      maxHp: displayed.maxHp,
      luck: displayed.luck,
      relicIds: [...displayed.relicIds],
      chapterLuck: this.#player.luck,
      inBattle: true
    }
  }

  #clearMessage() {
    this.#message = null
  }

  #triggerLuckTutorial() {
    if (!this.#battleState) {
      return
    }
    const luckEffectTypes = new Set([
      "changeLuck",
      "damageAndLuck",
      "shieldAndLuck",
      "luckDamage"
    ])
    const hasLuckCoin = this.#battleState.drawnCoins.some(
      (coin) =>
        luckEffectTypes.has(coin.frontEffect.type) ||
        luckEffectTypes.has(coin.backEffect.type)
    )
    const hasLuckIntent =
      this.#battleState.enemy.currentIntent?.effects.some(
        (effect) => effect.type === "changePlayerLuck"
      ) ?? false
    if (
      hasLuckCoin ||
      hasLuckIntent ||
      this.#battleState.player.luck !== 0
    ) {
      this.#tutorial.trigger(TutorialHintId.LUCK_PROBABILITY)
    }
  }

  #triggerBattleStepTutorial(presentation, stepIndex) {
    const step = presentation.steps[stepIndex]
    if (step.type !== "PLAYER_EFFECT") {
      return
    }
    const previous =
      presentation.steps[stepIndex - 1]?.displayState ??
      presentation.beforeState
    if (step.displayState.player.shield > previous.player.shield) {
      this.#tutorial.trigger(TutorialHintId.SHIELD_DURATION)
    }
  }

  #emit() {
    const snapshot = this.getSnapshot()
    this.#listeners.forEach((listener) => listener(snapshot))
  }
}
