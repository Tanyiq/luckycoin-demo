export function createInitialPlayerProgress(playerConfig) {
  let sequence = 0
  const coins = playerConfig.coinLoadout.flatMap(({ coinId, count }) =>
    Array.from({ length: count }, () => ({
      uid: `${coinId}_${++sequence}`,
      coinId,
      level: 1
    }))
  )

  return {
    id: playerConfig.id,
    name: playerConfig.name,
    hp: playerConfig.initialHp,
    maxHp: playerConfig.maxHp,
    luck: playerConfig.initialLuck ?? 0,
    level: 1,
    exp: 0,
    chips: 0,
    coins,
    unlockedCoinIds: [...new Set(coins.map(({ coinId }) => coinId))],
    relicIds: [],
    bannedRelicIds: [],
    runStats: {
      upgradeCount: 0,
      removeCount: 0,
      chipsEarned: 0,
      chipsSpent: 0
    },
    nextCoinSequence: sequence + 1
  }
}

export function createBattlePlayerConfig(progress) {
  return {
    id: progress.id,
    name: progress.name,
    maxHp: progress.maxHp,
    initialHp: progress.hp,
    initialShield: 0,
    initialLuck: progress.luck,
    relicIds: [...progress.relicIds],
    bannedRelicIds: [...progress.bannedRelicIds],
    coinInstances: progress.coins.map((coin) => ({ ...coin }))
  }
}

export function startChapter(progress) {
  progress.hp = progress.maxHp
  return progress
}

export function saveBattlePlayerState(progress, battleState) {
  if (!battleState?.player) {
    throw new Error("缺少可保存的战斗玩家状态")
  }
  progress.hp = clamp(battleState.player.hp, 0, progress.maxHp)
  progress.relicIds = [
    ...(battleState.player.relicIds ?? progress.relicIds ?? [])
  ]
  progress.bannedRelicIds = [
    ...(battleState.player.bannedRelicIds ??
      progress.bannedRelicIds ??
      [])
  ]
  return progress
}
import { clamp } from "../utils/clamp.js"
