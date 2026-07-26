export const TutorialHintId = Object.freeze({
  COIN_BASICS: "coin_basics",
  SHIELD_DURATION: "shield_duration",
  LUCK_PROBABILITY: "luck_probability",
  BUILD_REWARD: "build_reward",
  RELIC_PASSIVE: "relic_passive"
})

const hintDefinitions = Object.freeze({
  [TutorialHintId.COIN_BASICS]: Object.freeze({
    id: TutorialHintId.COIN_BASICS,
    anchor: "coin",
    title: "先看两面",
    message: "每枚硬币都有正反两种效果。选择前，记得两面都看看。"
  }),
  [TutorialHintId.SHIELD_DURATION]: Object.freeze({
    id: TutorialHintId.SHIELD_DURATION,
    anchor: "shield",
    title: "护盾已生效",
    message: "护盾抵消本回合的攻击，进入下一回合时清零。"
  }),
  [TutorialHintId.LUCK_PROBABILITY]: Object.freeze({
    id: TutorialHintId.LUCK_PROBABILITY,
    anchor: "luck",
    title: "幸运正在干预",
    message: "幸运会影响所有硬币的正面概率。越高越容易出现正面。",
    detail: "-10 必定反面 · +10 必定正面"
  }),
  [TutorialHintId.BUILD_REWARD]: Object.freeze({
    id: TutorialHintId.BUILD_REWARD,
    anchor: "reward",
    title: "调整你的构筑",
    message: "新增扩充构筑，强化提高数值，删除让抽取更稳定。"
  }),
  [TutorialHintId.RELIC_PASSIVE]: Object.freeze({
    id: TutorialHintId.RELIC_PASSIVE,
    anchor: "relic",
    title: "遗物已经加入构筑",
    message: "遗物会自动生效。点击右上角“查看构筑”，可以查看完整效果。"
  })
})

function cloneHint(id) {
  return id ? { ...hintDefinitions[id] } : null
}

export class TutorialSystem {
  #shownIds = new Set()
  #pendingIds = []
  #activeId = null

  trigger(id) {
    if (!hintDefinitions[id]) {
      throw new Error(`未知的新手提示：${id}`)
    }
    if (
      this.#shownIds.has(id) ||
      this.#activeId === id ||
      this.#pendingIds.includes(id)
    ) {
      return false
    }
    if (this.#activeId) {
      this.#pendingIds.push(id)
    } else {
      this.#activate(id)
    }
    return true
  }

  dismissActive({ advance = true } = {}) {
    if (!this.#activeId) {
      return false
    }
    this.#activeId = null
    if (advance) {
      this.advance()
    }
    return true
  }

  dismissActiveAnchor(anchors, options = {}) {
    const anchorList = Array.isArray(anchors) ? anchors : [anchors]
    const active = hintDefinitions[this.#activeId]
    if (!active || !anchorList.includes(active.anchor)) {
      return false
    }
    return this.dismissActive(options)
  }

  clearAnchors(anchors) {
    const anchorList = Array.isArray(anchors) ? anchors : [anchors]
    this.dismissActiveAnchor(anchorList, { advance: false })
    this.#pendingIds = this.#pendingIds.filter(
      (id) => !anchorList.includes(hintDefinitions[id].anchor)
    )
  }

  advance() {
    if (this.#activeId || this.#pendingIds.length === 0) {
      return false
    }
    this.#activate(this.#pendingIds.shift())
    return true
  }

  getState() {
    return {
      activeHint: cloneHint(this.#activeId),
      shownIds: [...this.#shownIds],
      pendingIds: [...this.#pendingIds]
    }
  }

  #activate(id) {
    this.#activeId = id
    this.#shownIds.add(id)
  }
}
