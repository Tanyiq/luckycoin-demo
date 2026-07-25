export function createRunSummary({
  chapterState,
  player,
  coinConfigs,
  relicDefinitions
}) {
  return {
    chapterId: chapterState.chapterId,
    result: chapterState.status,
    remainingHp: player.hp,
    maxHp: player.maxHp,
    luck: player.luck,
    remainingChips: player.chips ?? 0,
    chipsEarned: player.runStats.chipsEarned ?? 0,
    chipsSpent: player.runStats.chipsSpent ?? 0,
    coins: player.coins.map((coin) => ({
      uid: coin.uid,
      coinId: coin.coinId,
      name: coinConfigs[coin.coinId].name,
      level: coin.level
    })),
    relics: player.relicIds.map((relicId) => ({
      id: relicId,
      name: relicDefinitions[relicId].name
    })),
    bannedRelics: player.bannedRelicIds.map((relicId) => ({
      id: relicId,
      name: relicDefinitions[relicId].name
    })),
    upgradeCount: player.runStats.upgradeCount,
    removeCount: player.runStats.removeCount,
    completedNodeCount: chapterState.completedNodeIds.length
  }
}

export function formatRunSummary(summary) {
  const resultName =
    summary.result === "COMPLETED" ? "通关" : "失败"
  const coinLines = summary.coins.length
    ? summary.coins
        .map(
          (coin) => `  - ${coin.name} Lv.${coin.level}（${coin.uid}）`
        )
        .join("\n")
    : "  - 无"
  const relicLines = summary.relics.length
    ? summary.relics.map((relic) => `  - ${relic.name}`).join("\n")
    : "  - 无"
  const bannedLines = summary.bannedRelics.length
    ? summary.bannedRelics
        .map((relic) => `  - ${relic.name}`)
        .join("\n")
    : "  - 无"

  return [
    "",
    "===== Run Summary =====",
    `结果：${resultName}`,
    `剩余HP：${summary.remainingHp}/${summary.maxHp}`,
    `章节幸运：${summary.luck >= 0 ? "+" : ""}${summary.luck}`,
    `剩余筹码：${summary.remainingChips}`,
    `筹码收入/支出：${summary.chipsEarned}/${summary.chipsSpent}`,
    "当前硬币：",
    coinLines,
    "当前遗物：",
    relicLines,
    "禁获遗物：",
    bannedLines,
    `强化次数：${summary.upgradeCount}`,
    `删除/回收次数：${summary.removeCount}`,
    `完成节点：${summary.completedNodeCount}`,
    "======================="
  ].join("\n")
}
