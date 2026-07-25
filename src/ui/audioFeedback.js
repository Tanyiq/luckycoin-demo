export const SoundCue = Object.freeze({
  COIN_TOSS: "coin_toss",
  RESULT_FRONT: "result_front",
  RESULT_BACK: "result_back",
  SPECIAL_RESULT: "special_result",
  RELIC_ACQUIRED: "relic_acquired",
  COIN_ACQUIRED: "coin_acquired",
  DAMAGE_HIT: "damage_hit",
  SHIELD_GAIN: "shield_gain",
  HEAL: "heal"
})

export const AudioPriority = Object.freeze({
  NORMAL: "normal",
  HIGH: "high",
  CRITICAL: "critical"
})

const validCues = new Set(Object.values(SoundCue))

export class NullAudioDriver {
  unlock() {}

  play() {}

  stopGroup() {}

  setMuted() {}

  setVolume() {}
}

export class AudioFeedback {
  #driver
  #schedule
  #cancelSchedule
  #playedEventIds = new Set()
  #scheduledEvents = new Map()
  #unlocked = false

  constructor({
    driver = new NullAudioDriver(),
    schedule = (callback, delayMs) => setTimeout(callback, delayMs),
    cancelSchedule = (timer) => clearTimeout(timer)
  } = {}) {
    this.#driver = driver
    this.#schedule = schedule
    this.#cancelSchedule = cancelSchedule
  }

  unlock() {
    if (this.#unlocked) {
      return
    }
    this.#unlocked = true
    this.#driver.unlock()
  }

  emit(event) {
    this.#validateEvent(event)
    if (this.#playedEventIds.has(event.id)) {
      return false
    }
    this.#playedEventIds.add(event.id)

    // Browsers only allow sound after a user gesture. Old cues are discarded
    // rather than replayed together after audio becomes available.
    if (!this.#unlocked) {
      return false
    }

    const delayMs = Math.max(0, event.delayMs ?? 0)
    if (delayMs === 0) {
      this.#play(event)
      return true
    }

    const timer = this.#schedule(() => {
      this.#scheduledEvents.delete(event.id)
      this.#play(event)
    }, delayMs)
    this.#scheduledEvents.set(event.id, {
      timer,
      groupId: event.groupId
    })
    return true
  }

  consume(events) {
    return events.map((event) => this.emit(event))
  }

  cancelGroup(groupId) {
    for (const [eventId, scheduled] of this.#scheduledEvents) {
      if (scheduled.groupId !== groupId) {
        continue
      }
      this.#cancelSchedule(scheduled.timer)
      this.#scheduledEvents.delete(eventId)
    }
    this.#driver.stopGroup(groupId)
  }

  clear() {
    for (const scheduled of this.#scheduledEvents.values()) {
      this.#cancelSchedule(scheduled.timer)
    }
    this.#scheduledEvents.clear()
    this.#playedEventIds.clear()
  }

  setMuted(muted) {
    this.#driver.setMuted(Boolean(muted))
  }

  setVolume(volume) {
    const normalized = Math.max(0, Math.min(1, Number(volume)))
    this.#driver.setVolume(normalized)
  }

  #play(event) {
    this.#driver.play(event.cue, {
      source: event.source,
      variant: event.variant ?? "normal",
      priority: event.priority ?? AudioPriority.NORMAL,
      groupId: event.groupId,
      index: event.index ?? 0,
      total: event.total ?? 1
    })
  }

  #validateEvent(event) {
    if (!event?.id) {
      throw new Error("音效事件必须拥有唯一ID")
    }
    if (!validCues.has(event.cue)) {
      throw new Error(`未知音效类型：${event.cue}`)
    }
  }
}

function actualOutcomeRate(step) {
  return step.side === "front" ? step.rate : 1 - step.rate
}

const damageEffectTypes = new Set([
  "damage",
  "conditionalDamage",
  "multiDamage",
  "damageAndHeal",
  "selfCostDamage",
  "damageAndLuck",
  "luckDamage"
])

const shieldEffectTypes = new Set([
  "shield",
  "shieldWithExistingBonus",
  "reflectionShield",
  "counter",
  "shieldAndLuck"
])

const healEffectTypes = new Set(["heal", "damageAndHeal"])

function createEffectAudioEvents(step, groupId, stepIndex) {
  const events = []
  const baseId = `${groupId}:step_${step.sequence ?? stepIndex}`
  const isPlayerEffect = step.type === "PLAYER_EFFECT"

  if (
    (isPlayerEffect && damageEffectTypes.has(step.effect?.type)) ||
    (step.type === "ENEMY_EFFECT" &&
      step.effect?.type === "damagePlayer") ||
    step.type === "COUNTER_TRIGGERED" ||
    (step.type === "RELIC_TRIGGERED" && step.damage > 0)
  ) {
    events.push({
      id: `${baseId}:hit`,
      cue: SoundCue.DAMAGE_HIT,
      source: "battle",
      priority: AudioPriority.NORMAL,
      groupId,
      delayMs: 170
    })
  }

  if (
    (isPlayerEffect && shieldEffectTypes.has(step.effect?.type)) ||
    (step.type === "ENEMY_EFFECT" &&
      step.effect?.type === "shieldSelf")
  ) {
    events.push({
      id: `${baseId}:shield`,
      cue: SoundCue.SHIELD_GAIN,
      source: "battle",
      priority: AudioPriority.NORMAL,
      groupId,
      delayMs: 70
    })
  }

  if (isPlayerEffect && healEffectTypes.has(step.effect?.type)) {
    events.push({
      id: `${baseId}:heal`,
      cue: SoundCue.HEAL,
      source: "battle",
      priority: AudioPriority.NORMAL,
      groupId,
      delayMs: 90
    })
  }

  return events
}

function createBattleAudioEvents(snapshot) {
  const animation = snapshot.animation
  const step = animation?.activeStep
  if (!animation || !step) {
    return []
  }

  const nodeId =
    snapshot.chapterState.currentNodeId ??
    snapshot.chapterState.completedNodeIds.at(-1) ??
    "battle"
  const turn =
    animation.beforeState?.turn ??
    snapshot.battleState?.turn ??
    0
  const groupId = `${nodeId}:turn_${turn}`
  const events = []

  if (step.type === "COIN_TOSSED") {
    const result = animation.results.find(
      ({ coinUid }) => coinUid === step.coinUid
    )
    const index = result?.order ?? 0
    const total = animation.results.length
    const baseId = `${groupId}:${step.coinUid}`
    const revealDelay = Math.min(
      340,
      Math.max(220, Math.round(step.duration * 0.58))
    )
    events.push(
      {
        id: `${baseId}:toss`,
        cue: SoundCue.COIN_TOSS,
        source: "battle",
        priority: AudioPriority.NORMAL,
        groupId,
        index,
        total,
        delayMs: index * 55
      },
      {
        id: `${baseId}:result`,
        cue:
          step.side === "front"
            ? SoundCue.RESULT_FRONT
            : SoundCue.RESULT_BACK,
        source: "battle",
        variant:
          actualOutcomeRate(step) <= 0.1 ? "extreme" : "normal",
        priority: AudioPriority.NORMAL,
        groupId,
        index,
        total,
        delayMs: revealDelay + index * 55
      }
    )
  }

  events.push(
    ...createEffectAudioEvents(
      step,
      groupId,
      animation.activeStepIndex ?? 0
    )
  )

  if (step.special) {
    const specialDelay =
      step.type === "COIN_TOSSED"
        ? Math.min(
            440,
            Math.max(300, Math.round(step.duration * 0.68))
          )
        : 80
    events.push({
      id: `${groupId}:special:${animation.theme}`,
      cue: SoundCue.SPECIAL_RESULT,
      source: "battle",
      variant: animation.theme,
      priority: AudioPriority.CRITICAL,
      groupId,
      delayMs: specialDelay
    })
  }

  return events
}

function createAcquisitionAudioEvents(previous, current) {
  if (!previous) {
    return []
  }
  const restarted =
    previous.screen === "SUMMARY" && current.screen === "MAP"
  if (restarted) {
    return []
  }

  const nodeId =
    current.chapterState.currentNodeId ??
    current.chapterState.completedNodeIds.at(-1) ??
    "run"
  const previousCoinIds = new Set(
    previous.player.coins.map(({ uid }) => uid)
  )
  const previousRelicIds = new Set(previous.player.relicIds)
  const newCoins = current.player.coins.filter(
    ({ uid }) => !previousCoinIds.has(uid)
  )
  const newRelics = current.player.relicIds.filter(
    (id) => !previousRelicIds.has(id)
  )

  return [
    ...newCoins.map((coin, index) => ({
      id: `${nodeId}:coin_acquired:${coin.uid}`,
      cue: SoundCue.COIN_ACQUIRED,
      source:
        current.screen === "SHOP" ? "shop" : "reward",
      priority: AudioPriority.HIGH,
      groupId: `${nodeId}:acquisition`,
      index,
      total: newCoins.length,
      delayMs: index * 70
    })),
    ...newRelics.map((relicId, index) => ({
      id: `${nodeId}:relic_acquired:${relicId}`,
      cue: SoundCue.RELIC_ACQUIRED,
      source:
        current.screen === "SHOP"
          ? "shop"
          : current.screen === "EVENT"
            ? "event"
            : "reward",
      priority: AudioPriority.HIGH,
      groupId: `${nodeId}:acquisition`,
      index,
      total: newRelics.length,
      delayMs: index * 90
    }))
  ]
}

export function createAudioEvents(previousSnapshot, currentSnapshot) {
  return [
    ...createBattleAudioEvents(currentSnapshot),
    ...createAcquisitionAudioEvents(
      previousSnapshot,
      currentSnapshot
    )
  ]
}

export function isRunRestart(previousSnapshot, currentSnapshot) {
  return (
    previousSnapshot?.screen === "SUMMARY" &&
    currentSnapshot.screen === "MAP"
  )
}
