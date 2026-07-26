import {
  bossFragmentRewards,
  MetaTalentId,
  metaTalents
} from "../data/metaProgression.js"
import { gameConfig } from "../data/gameConfig.js"

export function createMetaProgress() {
  return {
    probabilityFragments: 0,
    talentRanks: {},
    chapterVictories: {},
    highestChapter: 0,
    claimedBossKeys: []
  }
}

export function normalizeMetaProgress(value = {}) {
  const empty = createMetaProgress()
  return {
    probabilityFragments: Math.max(
      0,
      Math.floor(value.probabilityFragments ?? 0)
    ),
    talentRanks: Object.fromEntries(
      Object.entries(value.talentRanks ?? {})
        .filter(([id]) => metaTalents[id])
        .map(([id, rank]) => [
          id,
          Math.max(
            0,
            Math.min(metaTalents[id].maxRank, Math.floor(rank))
          )
        ])
    ),
    chapterVictories: Object.fromEntries(
      Object.entries(value.chapterVictories ?? {}).map(
        ([chapterId, count]) => [
          chapterId,
          Math.max(0, Math.floor(count))
        ]
      )
    ),
    highestChapter: Math.max(
      empty.highestChapter,
      Math.floor(value.highestChapter ?? 0)
    ),
    claimedBossKeys: [
      ...new Set(
        (value.claimedBossKeys ?? []).filter(
          (key) => typeof key === "string"
        )
      )
    ]
  }
}

function chapterNumber(chapterId) {
  const match = /^chapter_(\d+)$/.exec(chapterId ?? "")
  return match ? Number.parseInt(match[1], 10) : 0
}

export function getTalentRank(metaProgress, talentId) {
  return metaProgress.talentRanks[talentId] ?? 0
}

export function getTalentState(profile, talentId) {
  const talent = metaTalents[talentId]
  if (!talent) {
    throw new Error(`未知局外天赋：${talentId}`)
  }
  const meta = profile.metaProgress
  const rank = getTalentRank(meta, talentId)
  const maxed = rank >= talent.maxRank
  const nextCost = maxed ? null : talent.costs[rank]
  const missingRequirements = []

  for (const prerequisite of talent.prerequisites ?? []) {
    if (getTalentRank(meta, prerequisite) < metaTalents[prerequisite].maxRank) {
      missingRequirements.push(`需要先激活“${metaTalents[prerequisite].name}”`)
    }
  }
  if (
    talent.requirements?.tutorialCompleted &&
    !profile.tutorialCompleted
  ) {
    missingRequirements.push("需要完成章节0")
  }
  if (
    talent.requirements?.highestChapter !== undefined &&
    meta.highestChapter < talent.requirements.highestChapter
  ) {
    missingRequirements.push(
      `需要完成章节${talent.requirements.highestChapter}`
    )
  }
  for (const [chapterId, count] of Object.entries(
    talent.requirements?.chapterVictories ?? {}
  )) {
    if ((meta.chapterVictories[chapterId] ?? 0) < count) {
      missingRequirements.push(
        `需要击败章节${chapterNumber(chapterId)} Boss ${count}次`
      )
    }
  }

  return {
    ...talent,
    rank,
    maxed,
    nextCost,
    missingRequirements,
    affordable:
      !maxed &&
      missingRequirements.length === 0 &&
      meta.probabilityFragments >= nextCost
  }
}

export function purchaseTalent(profile, talentId) {
  const state = getTalentState(profile, talentId)
  if (state.maxed) {
    throw new Error("该权限已经完全激活")
  }
  if (state.missingRequirements.length > 0) {
    throw new Error(state.missingRequirements[0])
  }
  if (!state.affordable) {
    throw new Error("概率残片不足")
  }
  profile.metaProgress.probabilityFragments -= state.nextCost
  profile.metaProgress.talentRanks[talentId] = state.rank + 1
  return getTalentState(profile, talentId)
}

export function awardBossFragments(
  profile,
  { claimKey, chapterId }
) {
  const meta = profile.metaProgress
  if (meta.claimedBossKeys.includes(claimKey)) {
    return { awarded: false, amount: 0 }
  }
  const amount =
    bossFragmentRewards[chapterId] ??
    Math.max(1, chapterNumber(chapterId) + 1)
  meta.claimedBossKeys.push(claimKey)
  meta.probabilityFragments += amount
  meta.chapterVictories[chapterId] =
    (meta.chapterVictories[chapterId] ?? 0) + 1
  meta.highestChapter = Math.max(
    meta.highestChapter,
    chapterNumber(chapterId)
  )
  return {
    awarded: true,
    amount,
    balance: meta.probabilityFragments
  }
}

export function createRunRules(metaProgress) {
  const bodyRank = getTalentRank(metaProgress, MetaTalentId.FATE_BODY)
  const capitalRank = getTalentRank(
    metaProgress,
    MetaTalentId.STARTING_CAPITAL
  )
  return {
    maxHpBonus: bodyRank * 2,
    startingChips: capitalRank * 5,
    baseDrawCount:
      gameConfig.drawCount +
      (getTalentRank(metaProgress, MetaTalentId.EXPANDED_VIEW) > 0
        ? 1
        : 0),
    deepTable:
      getTalentRank(metaProgress, MetaTalentId.DEEP_TABLE) > 0,
    bossExtraBetInterval:
      getTalentRank(metaProgress, MetaTalentId.HOUSE_AUTHORITY) > 0
        ? 6
        : null,
    unlockedRelicIds:
      getTalentRank(metaProgress, MetaTalentId.GAMBLER_CUFF) > 0
        ? ["gambler_cuff"]
        : []
  }
}

export function normalizeRunRules(value = {}) {
  return {
    maxHpBonus: Math.max(0, Math.floor(value.maxHpBonus ?? 0)),
    startingChips: Math.max(0, Math.floor(value.startingChips ?? 0)),
    baseDrawCount: Math.max(
      gameConfig.drawCount,
      Math.floor(value.baseDrawCount ?? gameConfig.drawCount)
    ),
    deepTable: value.deepTable === true,
    bossExtraBetInterval: Number.isInteger(
      value.bossExtraBetInterval
    )
      ? value.bossExtraBetInterval
      : null,
    unlockedRelicIds: [...new Set(value.unlockedRelicIds ?? [])]
  }
}

export function resolveChapterRunRules(runRules, chapterId) {
  const rules = normalizeRunRules(runRules)
  const number = chapterNumber(chapterId)
  return {
    drawCount:
      rules.deepTable && number >= 2
        ? Math.max(4, rules.baseDrawCount)
        : rules.baseDrawCount,
    baseMaxCoinsPerTurn: gameConfig.maxCoinsPerTurn,
    selectionRules: {
      isBossBattle: false,
      extraBetIntervals: rules.bossExtraBetInterval
        ? [
            {
              source: "庄家权限",
              interval: rules.bossExtraBetInterval,
              bossOnly: true
            }
          ]
        : []
    }
  }
}

