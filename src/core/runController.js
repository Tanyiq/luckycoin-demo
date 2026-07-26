import {
  cloneDiscoveryRecord,
  mergeDiscoveryRecords
} from "./discoverySystem.js"
import {
  createEmptySaveData,
  MemorySaveRepository,
  SAVE_VERSION
} from "./saveRepository.js"
import {
  awardBossFragments,
  createRunRules,
  normalizeMetaProgress,
  normalizeRunRules,
  purchaseTalent
} from "./metaProgression.js"

export const RunStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  DEFEAT: "DEFEAT",
  COMPLETED: "COMPLETED"
})

function clone(value) {
  return value == null
    ? value
    : JSON.parse(JSON.stringify(value))
}

function cloneRunPlayer(player) {
  const cloned = clone(player)
  delete cloned.discovery
  return cloned
}

function normalizeSaveData(data) {
  const empty = createEmptySaveData()
  if (!data || ![1, SAVE_VERSION].includes(data.version)) {
    return empty
  }
  const currentRun = data.currentRun ? clone(data.currentRun) : null
  if (
    currentRun &&
    currentRun.mapState === undefined &&
    currentRun.chapterState !== undefined
  ) {
    currentRun.mapState = currentRun.chapterState
    delete currentRun.chapterState
  }
  if (currentRun) {
    currentRun.runRules = normalizeRunRules(currentRun.runRules)
  }
  return {
    version: SAVE_VERSION,
    profile: {
      tutorialCompleted:
        data.profile?.tutorialCompleted === true,
      discovery: mergeDiscoveryRecords(
        empty.profile.discovery,
        data.profile?.discovery
      ),
      metaProgress: normalizeMetaProgress(
        data.profile?.metaProgress
      )
    },
    currentRun
  }
}

export class RunController {
  #repository
  #saveData

  constructor({ repository = new MemorySaveRepository() } = {}) {
    this.#repository = repository
    this.#saveData = normalizeSaveData(repository.load())
    this.#commit()
  }

  getProfile() {
    return clone(this.#saveData.profile)
  }

  getCurrentRun() {
    return clone(this.#saveData.currentRun)
  }

  getStartingChapterId() {
    return this.#saveData.profile.tutorialCompleted
      ? "chapter_1"
      : "chapter_0"
  }

  createNextRunRules() {
    return createRunRules(this.#saveData.profile.metaProgress)
  }

  beginRun({
    chapterId,
    player,
    mapState = null,
    runRules = this.createNextRunRules()
  }) {
    this.#saveData.currentRun = {
      runId: `run_${Date.now()}`,
      status: RunStatus.ACTIVE,
      chapterId,
      player: cloneRunPlayer(player),
      runRules: normalizeRunRules(runRules),
      mapState: clone(mapState),
      summary: null
    }
    this.recordDiscovery(player.discovery)
    this.#commit()
    return this.getCurrentRun()
  }

  saveActiveRun({ chapterId, player, mapState }) {
    const current = this.#saveData.currentRun
    if (!current || current.status !== RunStatus.ACTIVE) {
      return null
    }
    current.chapterId = chapterId
    current.player = cloneRunPlayer(player)
    current.mapState = clone(mapState)
    this.recordDiscovery(player.discovery)
    this.#commit()
    return this.getCurrentRun()
  }

  completeTutorialAndAdvance({ player }) {
    this.#saveData.profile.tutorialCompleted = true
    this.recordDiscovery(player.discovery)
    const current = this.#saveData.currentRun
    current.status = RunStatus.ACTIVE
    current.chapterId = "chapter_1"
    current.player = cloneRunPlayer(player)
    current.mapState = null
    current.summary = null
    this.#commit()
    return this.getCurrentRun()
  }

  failRun({ player, mapState, summary }) {
    const current = this.#saveData.currentRun
    if (!current) {
      return null
    }
    current.status = RunStatus.DEFEAT
    current.player = cloneRunPlayer(player)
    current.mapState = clone(mapState)
    current.summary = clone(summary)
    this.recordDiscovery(player.discovery)
    this.#commit()
    return this.getCurrentRun()
  }

  completeRun({ player, mapState, summary }) {
    const current = this.#saveData.currentRun
    if (!current) {
      return null
    }
    current.status = RunStatus.COMPLETED
    current.player = cloneRunPlayer(player)
    current.mapState = clone(mapState)
    current.summary = clone(summary)
    this.recordDiscovery(player.discovery)
    this.#commit()
    return this.getCurrentRun()
  }

  recordDiscovery(discovery) {
    this.#saveData.profile.discovery = mergeDiscoveryRecords(
      this.#saveData.profile.discovery,
      discovery
    )
    this.#commit()
    return cloneDiscoveryRecord(this.#saveData.profile.discovery)
  }

  awardBossVictory({ chapterId, nodeId }) {
    const current = this.#saveData.currentRun
    if (!current) {
      throw new Error("当前没有可记录的Run")
    }
    const result = awardBossFragments(this.#saveData.profile, {
      chapterId,
      claimKey: `${current.runId}:${chapterId}:${nodeId}`
    })
    this.#commit()
    return result
  }

  purchaseTalent(talentId) {
    if (this.#saveData.currentRun?.status === RunStatus.ACTIVE) {
      throw new Error("局外权限只能在当前Run结束后激活")
    }
    const result = purchaseTalent(this.#saveData.profile, talentId)
    this.#commit()
    return result
  }

  clearCurrentRun() {
    this.#saveData.currentRun = null
    this.#commit()
  }

  #commit() {
    this.#repository.save(this.#saveData)
  }
}
