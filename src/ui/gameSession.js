import { BattleEngine, BattleStatus } from "../core/battleEngine.js"
import {
  cloneDiscoveryRecord,
  createDiscoveryRecord,
  mergeDiscoveryRecords
} from "../core/discoverySystem.js"
import {
  ChapterController,
  ChapterStatus
} from "../core/chapterController.js"
import { createChapter1Config } from "../core/chapterMapGenerator.js"
import {
  EventStatus,
  ConfiguredEvent,
  FateSpringEvent
} from "../core/eventSystem.js"
import {
  createBattlePlayerConfig,
  createInitialPlayerProgress,
  saveBattlePlayerState
} from "../core/playerProgress.js"
import {
  getTalentState,
  resolveChapterRunRules
} from "../core/metaProgression.js"
import { RelicRewardSystem } from "../core/relicRewardSystem.js"
import { RunController, RunStatus } from "../core/runController.js"
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
import { events as eventConfigs } from "../data/events.js"
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
import {
  metaTalentBranches,
  metaTalents
} from "../data/metaProgression.js"
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
  CHAPTER_PENDING: "CHAPTER_PENDING",
  SUMMARY: "SUMMARY"
})

function clonePlayer(player) {
  return {
    ...player,
    coins: player.coins.map((coin) => ({ ...coin })),
    relicIds: [...player.relicIds],
    bannedRelicIds: [...player.bannedRelicIds],
    metaUnlockedRelicIds: [
      ...(player.metaUnlockedRelicIds ?? [])
    ],
    unlockedCoinIds: [...player.unlockedCoinIds],
    discovery: cloneDiscoveryRecord(player.discovery),
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
  #runController
  #runRules
  #listeners = new Set()
  #player
  #chapter
  #chapterConfig = null
  #pendingChapterId = null
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
  #returnableShop = false
  #revisitingShop = false
  #summary = null
  #buildOpen = false
  #collectionOpen = false
  #metaProgressOpen = false
  #selectedCoinUids = []
  #discoveryRecord = createDiscoveryRecord()
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
    animationDuration = null,
    saveRepository = undefined
  } = {}) {
    this.#random = random
    this.#animationDuration = animationDuration
    this.#runController = new RunController({
      repository: saveRepository
    })
    this.#restoreOrStart()
  }

  subscribe(listener) {
    this.#listeners.add(listener)
    listener(this.getSnapshot())
    return () => this.#listeners.delete(listener)
  }

  startRun() {
    this.#runController.clearCurrentRun()
    this.#tutorial.clearAnchors([
      ...battleTutorialAnchors,
      "reward",
      "relic"
    ])
    this.#runRules = this.#runController.createNextRunRules()
    this.#player = createInitialPlayerProgress(
      players.tutorialPlayer,
      {
        maxHpBonus: this.#runRules.maxHpBonus,
        startingChips: this.#runRules.startingChips,
        unlockedRelicIds: this.#runRules.unlockedRelicIds
      }
    )
    this.#discoveryRecord = mergeDiscoveryRecords(
      this.#runController.getProfile().discovery,
      this.#player.discovery
    )
    this.#player.discovery = this.#discoveryRecord
    const startingChapterId =
      this.#runController.getStartingChapterId()
    this.#chapterConfig = chapters.chapter0
    this.#pendingChapterId = null
    if (startingChapterId === chapters.chapter0.id) {
      this.#chapter = new ChapterController({
        chapterConfig: this.#chapterConfig,
        playerProgress: this.#player,
        enemyConfigs: enemies
      })
      this.#chapter.startChapter()
      this.#screen = Screen.MAP
    } else {
      this.#chapter = null
      this.#chapterConfig = null
      this.#pendingChapterId = startingChapterId
      this.#screen = Screen.CHAPTER_PENDING
    }
    this.#node = null
    this.#battle = null
    this.#reward = null
    this.#event = null
    this.#shop = null
    this.#relicReward = null
    this.#relicCandidates = []
    this.#busy = false
    this.#animation = null
    this.#message = null
    this.#shopSelection = null
    this.#returnableShop = false
    this.#revisitingShop = false
    this.#summary = null
    this.#buildOpen = false
    this.#collectionOpen = false
    this.#metaProgressOpen = false
    this.#selectedCoinUids = []
    this.#resourceInspectorOpen = false
    this.#runController.beginRun({
      chapterId: startingChapterId,
      player: this.#player,
      mapState: this.#chapter?.getState() ?? null,
      runRules: this.#runRules
    })
    this.#emit()
  }

  enterCurrentNode() {
    this.#clearMessage()
    this.#returnableShop = false
    this.#revisitingShop = false
    this.#node = this.#chapter.enterCurrentNode()
    if (this.#node.type === NodeType.EVENT) {
      if (this.#node.eventId === "fate_spring") {
        this.#event = new FateSpringEvent({
          player: this.#player,
          coinConfigs: coins,
          relicDefinitions: relics,
          random: this.#random
        })
      } else {
        const eventConfig = findById(
          eventConfigs,
          this.#node.eventId
        )
        if (!eventConfig) {
          throw new Error(`找不到事件配置：${this.#node.eventId}`)
        }
        this.#event = new ConfiguredEvent({
          player: this.#player,
          eventConfig,
          coinConfigs: coins,
          coinPools,
          random: this.#random
        })
      }
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
      const battleRules = resolveChapterRunRules(
        this.#runRules,
        this.#chapterConfig.id
      )
      this.#battle = new BattleEngine({
        playerConfig: createBattlePlayerConfig(this.#player),
        enemyConfig: enemies[this.#node.enemyId],
        coinConfigs: coins,
        relicDefinitions: relics,
        drawCount: battleRules.drawCount,
        maxCoinsPerTurn: battleRules.baseMaxCoinsPerTurn,
        selectionRules: {
          ...battleRules.selectionRules,
          isBossBattle:
            this.#node.type === NodeType.BOSS_BATTLE
        },
        random: this.#random
      })
      this.#battleState = this.#battle.start()
      this.#selectedCoinUids = []
      this.#screen = Screen.BATTLE
      this.#tutorial.trigger(TutorialHintId.COIN_BASICS)
      this.#triggerLuckTutorial()
    }
    this.#emit()
  }

  startPendingChapter() {
    if (
      this.#screen !== Screen.CHAPTER_PENDING ||
      this.#pendingChapterId !== chapters.chapter1.id
    ) {
      throw new Error("当前没有可开始的章节")
    }
    this.#chapterConfig = createChapter1Config({
      random: this.#random
    })
    this.#chapter = new ChapterController({
      chapterConfig: this.#chapterConfig,
      playerProgress: this.#player,
      enemyConfigs: enemies
    })
    this.#chapter.startChapter()
    this.#pendingChapterId = null
    this.#screen = Screen.MAP
    this.#emit()
  }

  async playCoin(coinUid, confirmedCoinUids = null) {
    if (this.#busy || this.#screen !== Screen.BATTLE) {
      return
    }
    if (
      confirmedCoinUids === null &&
      this.#battleState.maxCoinsPerTurn > 1
    ) {
      const index = this.#selectedCoinUids.indexOf(coinUid)
      if (index >= 0) {
        this.#selectedCoinUids.splice(index, 1)
      } else if (
        this.#selectedCoinUids.length <
        this.#battleState.maxCoinsPerTurn
      ) {
        this.#selectedCoinUids.push(coinUid)
      }
      this.#emit()
      return
    }
    const coinUids = confirmedCoinUids ?? [coinUid]
    const selectedCoins = coinUids.map((uid) =>
      this.#battleState.drawnCoins.find((coin) => coin.uid === uid)
    )
    if (
      coinUids.length < 1 ||
      selectedCoins.some((coin) => !coin?.isUsable)
    ) {
      throw new Error("当前生命不足以使用这枚硬币")
    }

    this.#tutorial.dismissActiveAnchor(battleTutorialAnchors, {
      advance: false
    })
    this.#busy = true
    this.#selectedCoinUids = []
    const beforeState = this.#battleState
    const logStart = beforeState.logs.length
    this.#battleState = this.#battle.playCoins(coinUids)
    if (this.#battleState.status === BattleStatus.PLAYER_DECIDING) {
      this.#busy = false
      this.#animation = null
      this.#emit()
      return
    }
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

  async confirmCoinSelection() {
    if (
      this.#screen !== Screen.BATTLE ||
      this.#selectedCoinUids.length === 0
    ) {
      return
    }
    return this.playCoin(null, [...this.#selectedCoinUids])
  }

  async resolveBattleDecision(choice) {
    if (
      this.#busy ||
      this.#screen !== Screen.BATTLE ||
      this.#battleState.status !== BattleStatus.PLAYER_DECIDING
    ) {
      return
    }
    this.#busy = true
    const beforeState = this.#battleState
    const logStart = beforeState.logs.length
    this.#battleState = this.#battle.resolveDecision(choice)
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
        this.#emit()
        return
      }
    }
    this.#finishNode(result)
  }

  selectBossRelic(relicId) {
    this.#tutorial.dismissActiveAnchor("relic", { advance: false })
    const relicReward = this.#relicReward.acquire(relicId)
    this.#tutorial.trigger(TutorialHintId.RELIC_PASSIVE)
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
    if (this.#revisitingShop) {
      this.#revisitingShop = false
      this.#screen = Screen.MAP
      this.#shopSelection = null
      this.#clearMessage()
      this.#emit()
      return
    }
    this.#returnableShop = true
    this.#finishNode({
      success: true,
      resultType: "SHOP_COMPLETED"
    })
  }

  returnToShop() {
    if (
      this.#screen !== Screen.MAP ||
      !this.#returnableShop ||
      !this.#shop
    ) {
      throw new Error("当前无法返回商店")
    }
    this.#shopState = this.#shop.resume()
    this.#revisitingShop = true
    this.#shopSelection = null
    this.#screen = Screen.SHOP
    this.#clearMessage()
    this.#emit()
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
    this.#collectionOpen = false
    this.#metaProgressOpen = false
    this.#buildOpen = true
    this.#emit()
  }

  closeBuild() {
    this.#buildOpen = false
    this.#emit()
  }

  openCollection() {
    if (this.#busy) {
      return
    }
    this.#buildOpen = false
    this.#resourceInspectorOpen = false
    this.#metaProgressOpen = false
    this.#collectionOpen = true
    this.#emit()
  }

  closeCollection() {
    this.#collectionOpen = false
    this.#emit()
  }

  openMetaProgress() {
    if (this.#busy) {
      return
    }
    this.#buildOpen = false
    this.#collectionOpen = false
    this.#resourceInspectorOpen = false
    this.#metaProgressOpen = true
    this.#emit()
  }

  closeMetaProgress() {
    this.#metaProgressOpen = false
    this.#emit()
  }

  purchaseMetaTalent(talentId) {
    this.#runController.purchaseTalent(talentId)
    this.#message = `已激活“${metaTalents[talentId].name}”`
    this.#emit()
  }

  openResourceInspector() {
    this.#buildOpen = false
    this.#collectionOpen = false
    this.#metaProgressOpen = false
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
    const chapterState = this.#chapter?.getState() ?? {
      chapterId: this.#pendingChapterId,
      status: ChapterStatus.NOT_STARTED,
      currentNodeId: null,
      completedNodeIds: [],
      nodeStates: {}
    }
    const currentNodeView =
      chapterState.status === ChapterStatus.IN_PROGRESS
          ? this.#chapter?.getCurrentNodeView()
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
      canReturnToShop:
        this.#screen === Screen.MAP && this.#returnableShop,
      tutorial: this.#tutorial.getState(),
      player: clonePlayer(this.#player),
      selectedCoinUids: [...this.#selectedCoinUids],
      buildOpen: this.#buildOpen,
      collection: {
        open: this.#collectionOpen,
        discovery: cloneDiscoveryRecord(
          this.#runController.getProfile().discovery
        )
      },
      metaProgress: {
        open: this.#metaProgressOpen,
        canPurchase:
          this.#runController.getCurrentRun()?.status !==
          RunStatus.ACTIVE,
        branches: metaTalentBranches.map((branch) => ({
          ...branch,
          nodes: branch.nodes.map((id) =>
            getTalentState(this.#runController.getProfile(), id)
          )
        }))
      },
      profile: this.#runController.getProfile(),
      currentRun: this.#runController.getCurrentRun(),
      pendingChapterId: this.#pendingChapterId,
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
      chapterConfig: this.#chapterConfig ?? {
        id: this.#pendingChapterId,
        name: "章节1",
        nodes: []
      },
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
      configs: { coins, enemies, relics, events: eventConfigs }
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
    if (this.#node.type === NodeType.BOSS_BATTLE) {
      const fragmentReward = this.#runController.awardBossVictory({
        chapterId: this.#chapterConfig.id,
        nodeId: this.#node.id
      })
      result = {
        ...result,
        fragmentReward
      }
    }
    this.#chapter.completeCurrentNode(result)
    if (this.#chapter.getState().status === ChapterStatus.COMPLETED) {
      if (this.#chapterConfig.id === chapters.chapter0.id) {
        this.#runController.completeTutorialAndAdvance({
          player: this.#player
        })
        this.#chapter = null
        this.#chapterConfig = null
        this.#pendingChapterId = "chapter_1"
        this.#screen = Screen.CHAPTER_PENDING
      } else {
        this.#openSummary()
      }
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
    if (this.#chapter.getState().status === ChapterStatus.FAILED) {
      this.#runController.failRun({
        player: this.#player,
        mapState: this.#getPersistedMapState(),
        summary: this.#summary
      })
    } else if (
      this.#chapter.getState().status === ChapterStatus.COMPLETED
    ) {
      this.#runController.completeRun({
        player: this.#player,
        mapState: this.#getPersistedMapState(),
        summary: this.#summary
      })
    }
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
    this.#discoveryRecord = this.#runController.recordDiscovery(
      this.#player.discovery
    )
    this.#player.discovery = this.#discoveryRecord
    if (this.#screen === Screen.MAP && this.#chapter) {
      this.#runController.saveActiveRun({
        chapterId: this.#chapterConfig.id,
        player: this.#player,
        mapState: this.#getPersistedMapState()
      })
    }
    const snapshot = this.getSnapshot()
    this.#listeners.forEach((listener) => listener(snapshot))
  }

  #restoreOrStart() {
    const currentRun = this.#runController.getCurrentRun()
    if (!currentRun) {
      this.startRun()
      return
    }
    this.#player = {
      ...currentRun.player,
      coins: currentRun.player.coins.map((coin) => ({ ...coin })),
      relicIds: [...currentRun.player.relicIds],
      bannedRelicIds: [...currentRun.player.bannedRelicIds],
      metaUnlockedRelicIds: [
        ...(currentRun.player.metaUnlockedRelicIds ?? [])
      ],
      unlockedCoinIds: [...currentRun.player.unlockedCoinIds],
      runStats: { ...currentRun.player.runStats },
      discovery: cloneDiscoveryRecord(
        this.#runController.getProfile().discovery
      )
    }
    this.#runRules = currentRun.runRules
    this.#discoveryRecord = this.#player.discovery
    this.#resetTransientState()
    if (
      currentRun.status === RunStatus.ACTIVE &&
      currentRun.mapState
    ) {
      this.#chapterConfig =
        currentRun.chapterId === chapters.chapter0.id
          ? chapters.chapter0
          : currentRun.mapState.generatedChapterConfig
      this.#chapter = new ChapterController({
        chapterConfig: this.#chapterConfig,
        playerProgress: this.#player,
        enemyConfigs: enemies,
        runtimeState: currentRun.mapState
      })
      this.#screen = Screen.MAP
    } else if (currentRun.status === RunStatus.DEFEAT) {
      this.#chapterConfig =
        currentRun.chapterId === chapters.chapter0.id
          ? chapters.chapter0
          : currentRun.mapState.generatedChapterConfig
      this.#chapter = new ChapterController({
        chapterConfig: this.#chapterConfig,
        playerProgress: this.#player,
        enemyConfigs: enemies,
        runtimeState: currentRun.mapState
      })
      this.#summary = currentRun.summary
      this.#screen = Screen.SUMMARY
    } else if (currentRun.status === RunStatus.ACTIVE) {
      this.#chapter = null
      this.#chapterConfig = null
      this.#pendingChapterId = currentRun.chapterId
      this.#screen = Screen.CHAPTER_PENDING
    } else {
      this.#chapterConfig =
        currentRun.mapState?.generatedChapterConfig ??
        chapters.chapter1
      this.#chapter = currentRun.mapState?.generatedChapterConfig
        ? new ChapterController({
            chapterConfig: this.#chapterConfig,
            playerProgress: this.#player,
            enemyConfigs: enemies,
            runtimeState: currentRun.mapState
          })
        : null
      this.#summary = currentRun.summary
      this.#screen = Screen.SUMMARY
    }
  }

  #getPersistedMapState() {
    if (!this.#chapter) {
      return null
    }
    const state = this.#chapter.getState()
    return this.#chapterConfig.generated
      ? {
          ...state,
          generatedChapterConfig: this.#chapterConfig
        }
      : state
  }

  #resetTransientState() {
    this.#node = null
    this.#battle = null
    this.#battleState = null
    this.#reward = null
    this.#rewardState = null
    this.#event = null
    this.#eventState = null
    this.#shop = null
    this.#shopState = null
    this.#relicReward = null
    this.#relicCandidates = []
    this.#busy = false
    this.#animation = null
    this.#message = null
    this.#shopSelection = null
    this.#returnableShop = false
    this.#revisitingShop = false
    this.#summary = null
    this.#buildOpen = false
    this.#collectionOpen = false
    this.#metaProgressOpen = false
    this.#selectedCoinUids = []
    this.#resourceInspectorOpen = false
    this.#pendingChapterId = null
  }
}
