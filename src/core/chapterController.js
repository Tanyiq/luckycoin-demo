import { startChapter as restoreAtChapterStart } from "./playerProgress.js"

export const ChapterStatus = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED"
})

export const MapNodeStatus = Object.freeze({
  LOCKED: "LOCKED",
  AVAILABLE: "AVAILABLE",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED"
})

export class ChapterController {
  #config
  #player
  #enemyConfigs
  #runtime

  constructor({
    chapterConfig,
    playerProgress,
    enemyConfigs,
    runtimeState = null
  }) {
    this.#config = chapterConfig
    this.#player = playerProgress
    this.#enemyConfigs = enemyConfigs
    this.#runtime = runtimeState
      ? this.#cloneRuntime(runtimeState)
      : {
          chapterId: chapterConfig.id,
          status: ChapterStatus.NOT_STARTED,
          currentNodeId: null,
          completedNodeIds: [],
          nodeStates: Object.fromEntries(
            chapterConfig.nodes.map((node) => [
              node.id,
              {
                nodeId: node.id,
                status: MapNodeStatus.LOCKED,
                attempts: 0,
                result: null
              }
            ])
          )
        }
    this.#validateConfig()
    this.#validateRuntime()
  }

  startChapter() {
    if (this.#runtime.status !== ChapterStatus.NOT_STARTED) {
      throw new Error("章节只能开始一次")
    }
    restoreAtChapterStart(this.#player)
    this.#runtime.status = ChapterStatus.IN_PROGRESS
    this.#runtime.currentNodeId = this.#config.firstNodeId
    this.#runtime.nodeStates[this.#config.firstNodeId].status =
      MapNodeStatus.AVAILABLE
    return this.getState()
  }

  getCurrentNode() {
    if (!this.#runtime.currentNodeId) {
      return null
    }
    return this.#config.nodes.find(
      ({ id }) => id === this.#runtime.currentNodeId
    )
  }

  getCurrentNodeView() {
    const node = this.getCurrentNode()
    if (!node) {
      return null
    }
    const enemy = node.enemyId ? this.#enemyConfigs[node.enemyId] : null
    return {
      id: node.id,
      type: node.type,
      title: node.title,
      description: node.description,
      status: this.#runtime.nodeStates[node.id].status,
      enemy: enemy
        ? {
            id: enemy.id,
            name: enemy.name,
            description: enemy.description
          }
        : null,
      player: {
        hp: this.#player.hp,
        maxHp: this.#player.maxHp,
        luck: this.#player.luck,
        coinCount: this.#player.coins.length,
        chips: this.#player.chips ?? 0
      }
    }
  }

  enterCurrentNode() {
    if (this.#runtime.status !== ChapterStatus.IN_PROGRESS) {
      throw new Error("当前章节不能进入节点")
    }
    if (this.#player.hp <= 0) {
      throw new Error("玩家生命为0，不能进入节点")
    }
    const node = this.getCurrentNode()
    const runtime = this.#runtime.nodeStates[node.id]
    if (runtime.status !== MapNodeStatus.AVAILABLE) {
      throw new Error("当前节点不可进入")
    }
    runtime.status = MapNodeStatus.IN_PROGRESS
    runtime.attempts += 1
    return node
  }

  completeCurrentNode(result) {
    const node = this.getCurrentNode()
    const runtime = this.#runtime.nodeStates[node.id]
    if (runtime.status !== MapNodeStatus.IN_PROGRESS) {
      throw new Error("只有进行中的节点可以完成")
    }
    runtime.status = MapNodeStatus.COMPLETED
    runtime.result = result
    this.#runtime.completedNodeIds.push(node.id)

    const nextNodeId = node.nextNodeIds[0] ?? null
    if (!nextNodeId) {
      this.#runtime.currentNodeId = null
      this.#runtime.status = ChapterStatus.COMPLETED
    } else {
      this.#runtime.currentNodeId = nextNodeId
      this.#runtime.nodeStates[nextNodeId].status =
        MapNodeStatus.AVAILABLE
    }
    return this.getState()
  }

  failCurrentNode(result) {
    const node = this.getCurrentNode()
    const runtime = this.#runtime.nodeStates[node.id]
    if (runtime.status !== MapNodeStatus.IN_PROGRESS) {
      throw new Error("只有进行中的节点可以失败")
    }
    runtime.status = MapNodeStatus.FAILED
    runtime.result = result
    this.#runtime.status = ChapterStatus.FAILED
    return this.getState()
  }

  getState() {
    return {
      ...this.#runtime,
      completedNodeIds: [...this.#runtime.completedNodeIds],
      nodeStates: Object.fromEntries(
        Object.entries(this.#runtime.nodeStates).map(([id, state]) => [
          id,
          { ...state }
        ])
      )
    }
  }

  #validateConfig() {
    const ids = new Set(this.#config.nodes.map(({ id }) => id))
    if (!ids.has(this.#config.firstNodeId)) {
      throw new Error("章节起始节点不存在")
    }
    for (const node of this.#config.nodes) {
      for (const nextId of node.nextNodeIds) {
        if (!ids.has(nextId)) {
          throw new Error(`后续节点不存在：${nextId}`)
        }
      }
    }
  }

  #validateRuntime() {
    if (this.#runtime.chapterId !== this.#config.id) {
      throw new Error("章节存档与章节配置不匹配")
    }
    for (const node of this.#config.nodes) {
      if (!this.#runtime.nodeStates[node.id]) {
        throw new Error(`章节存档缺少节点：${node.id}`)
      }
    }
  }

  #cloneRuntime(runtime) {
    return {
      ...runtime,
      completedNodeIds: [...runtime.completedNodeIds],
      nodeStates: Object.fromEntries(
        Object.entries(runtime.nodeStates).map(([id, state]) => [
          id,
          { ...state }
        ])
      )
    }
  }
}
