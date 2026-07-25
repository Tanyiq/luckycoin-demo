function requireAmount(amount) {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error("筹码数量必须是非负整数")
  }
}

function ensureStats(player) {
  player.runStats ??= {}
  player.runStats.chipsEarned ??= 0
  player.runStats.chipsSpent ??= 0
}

export function earnChips(player, amount) {
  requireAmount(amount)
  ensureStats(player)
  player.chips ??= 0
  player.chips += amount
  player.runStats.chipsEarned += amount
  return player.chips
}

export function canSpendChips(player, amount) {
  requireAmount(amount)
  return (player.chips ?? 0) >= amount
}

export function spendChips(player, amount) {
  if (!canSpendChips(player, amount)) {
    throw new Error("筹码不足")
  }
  ensureStats(player)
  player.chips -= amount
  player.runStats.chipsSpent += amount
  return player.chips
}
