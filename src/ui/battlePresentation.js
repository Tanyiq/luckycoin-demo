import {
  coinAnimationProfiles,
  specialAnimationProfiles
} from "./animationProfiles.js"

const stepDurations = Object.freeze({
  SELECTED: 120,
  COIN_TOSSED: 520,
  PLAYER_EFFECT: 650,
  RELIC_TRIGGERED: 620,
  ENEMY_INTENT_START: 320,
  ENEMY_EFFECT: 620,
  COUNTER_TRIGGERED: 620,
  BATTLE_RESULT: 520,
  TURN_STARTED: 280
})

function actualOutcomeRate(result) {
  return result.side === "front" ? result.rate : 1 - result.rate
}

function findSelectedCoin(beforeState, coinUid) {
  return beforeState.drawnCoins.find(({ uid }) => uid === coinUid)
}

function specialCandidate(type, overrides = {}) {
  return {
    type,
    ...specialAnimationProfiles[type],
    ...overrides
  }
}

function selectHighestPriority(candidates) {
  return candidates.sort((left, right) => right.priority - left.priority)[0]
}

function displayStateAt(beforeState, event) {
  if (!event) {
    return beforeState
  }
  return {
    ...beforeState,
    player: {
      ...beforeState.player,
      ...event.player,
      relicIds: [
        ...(event.player?.relicIds ?? beforeState.player.relicIds)
      ],
      bannedRelicIds: [
        ...(event.player?.bannedRelicIds ??
          beforeState.player.bannedRelicIds)
      ]
    },
    enemy: {
      ...beforeState.enemy,
      ...event.enemy
    }
  }
}

function stepTitle(event) {
  if (event.type === "COIN_TOSSED") {
    return `${event.coinName} · ${event.side === "front" ? "正面" : "反面"}`
  }
  if (event.type === "PLAYER_EFFECT") {
    return `${event.coinName}效果结算`
  }
  if (event.type === "ENEMY_INTENT_START") {
    return `敌人行动 · ${event.intentName}`
  }
  if (event.type === "ENEMY_EFFECT") {
    return "敌人效果结算"
  }
  if (event.type === "COUNTER_TRIGGERED") {
    return event.source === "reflection" ? "反震触发" : "反击触发"
  }
  if (event.type === "RELIC_TRIGGERED") {
    return "遗物效果触发"
  }
  if (event.type === "BATTLE_RESULT") {
    return event.result === "VICTORY" ? "战斗胜利" : "战斗失败"
  }
  if (event.type === "TURN_STARTED") {
    return `进入第${event.turn}回合`
  }
  return "行动结算"
}

function fallbackEvents(beforeState, afterState, results, newLogs) {
  const events = []
  results.forEach((result) => {
    events.push({
      type: "COIN_TOSSED",
      coinUid: result.coinUid,
      coinName: result.coinName,
      side: result.side,
      rate: result.rate,
      player: beforeState.player,
      enemy: beforeState.enemy,
      messages: [
        `${result.coinName}投出${result.side === "front" ? "正面" : "反面"}`
      ]
    })
  })
  events.push({
    type: "PLAYER_EFFECT",
    coinUid: results.at(-1)?.coinUid,
    coinName: results.at(-1)?.coinName,
    player: afterState.player,
    enemy: afterState.enemy,
    messages: [...newLogs]
  })
  if (["VICTORY", "DEFEAT"].includes(afterState.status)) {
    events.push({
      type: "BATTLE_RESULT",
      result: afterState.status,
      player: afterState.player,
      enemy: afterState.enemy,
      messages: [
        afterState.status === "VICTORY" ? "战斗胜利" : "战斗失败"
      ]
    })
  }
  return events
}

function buildTimeline(beforeState, events, results) {
  const selectedNames = results.map(({ coinName }) => coinName).join("、")
  const steps = [
    {
      type: "SELECTED",
      title: `选择${selectedNames}`,
      messages: ["选择已经确认，等待命运揭晓"],
      duration: stepDurations.SELECTED,
      displayState: beforeState,
      revealedCoinUids: []
    }
  ]
  const revealedCoinUids = []
  for (const event of events) {
    if (
      event.type === "COIN_TOSSED" &&
      !revealedCoinUids.includes(event.coinUid)
    ) {
      revealedCoinUids.push(event.coinUid)
    }
    steps.push({
      ...event,
      title: stepTitle(event),
      messages:
        event.messages?.length > 0
          ? [...event.messages]
          : event.message
            ? [event.message]
            : [],
      duration: stepDurations[event.type] ?? 380,
      displayState: displayStateAt(beforeState, event),
      revealedCoinUids: [...revealedCoinUids]
    })
  }
  return steps
}

export function createBattlePresentation({
  beforeState,
  afterState,
  nodeType,
  newLogs
}) {
  const results = afterState.playedCoins.map((result, index) => {
    const coin = findSelectedCoin(beforeState, result.coinUid)
    return {
      ...result,
      coinId: coin?.id,
      rarity: coin?.rarity ?? "STARTER",
      effect:
        result.side === "front"
          ? coin?.frontEffect
          : coin?.backEffect,
      order: index
    }
  })
  const candidates = []

  const hourglassTriggered =
    beforeState.player.relicIds.includes("fate_hourglass") &&
    afterState.player.bannedRelicIds.includes("fate_hourglass")
  if (hourglassTriggered) {
    candidates.push(
      specialCandidate("revive", {
        stepType: "RELIC_TRIGGERED",
        stepSource: "BEFORE_DEATH"
      })
    )
  }

  if (
    nodeType === "BOSS_BATTLE" &&
    afterState.status === "VICTORY"
  ) {
    candidates.push(
      specialCandidate("bossVictory", {
        stepType: "BATTLE_RESULT"
      })
    )
  }

  if (results.length >= 3) {
    candidates.push(
      specialCandidate("multiCoin", {
        stepType: "COIN_TOSSED"
      })
    )
  }

  for (const result of results) {
    const profile = coinAnimationProfiles[result.coinId]
    if (profile && (!profile.side || profile.side === result.side)) {
      candidates.push(
        specialCandidate("highImpact", {
          ...profile,
          coinId: result.coinId,
          stepType: "PLAYER_EFFECT"
        })
      )
    }
    if (actualOutcomeRate(result) <= 0.1) {
      candidates.push(
        specialCandidate("improbable", {
          stepType: "COIN_TOSSED"
        })
      )
    }
  }

  const directExecution = newLogs.some((log) =>
    log.includes("命运收割者")
  )
  if (directExecution) {
    candidates.push(
      specialCandidate("highImpact", {
        theme: "execution",
        headline: "赔率已经失去继续计算的必要",
        detail: "命运收割者提前结束了本次审核。",
        stepType: "RELIC_TRIGGERED",
        stepSource: "BEFORE_ENEMY_ACTION"
      })
    )
  }

  const events =
    afterState.resolutionEvents?.length > 0
      ? afterState.resolutionEvents
      : fallbackEvents(beforeState, afterState, results, newLogs)
  const steps = buildTimeline(beforeState, events, results)
  const special = selectHighestPriority(candidates)
  if (special) {
    const specialStep =
      steps.find(
        (step) =>
          step.type === special.stepType &&
          (!special.stepSource || step.source === special.stepSource)
      ) ?? steps.at(-1)
    specialStep.special = true
    specialStep.duration = Math.max(specialStep.duration, 960)
  }

  return {
    level: special ? "special" : "normal",
    theme: special?.theme ?? "standard",
    headline: special?.headline ?? "",
    detail: special?.detail ?? "",
    duration: steps.reduce((total, step) => total + step.duration, 0),
    beforeState,
    afterState,
    results,
    steps,
    activeStepIndex: 0,
    activeStep: steps[0],
    logs: [...newLogs],
    flags: {
      victory: afterState.status === "VICTORY",
      defeat: afterState.status === "DEFEAT",
      bossVictory:
        nodeType === "BOSS_BATTLE" &&
        afterState.status === "VICTORY",
      revived: hourglassTriggered && afterState.player.hp > 0,
      improbable: results.some(
        (result) => actualOutcomeRate(result) <= 0.1
      ),
      multiCoin: results.length > 1
    }
  }
}
