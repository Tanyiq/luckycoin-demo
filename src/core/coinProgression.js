export function isCoinUpgradeable(coin, coinConfigs) {
  return Boolean(coinConfigs[coin.coinId]?.levels?.[coin.level + 1])
}

export function getUpgradeableCoins(player, coinConfigs) {
  return player.coins
    .filter((coin) => isCoinUpgradeable(coin, coinConfigs))
    .map((coin) => ({ ...coin }))
}

export function upgradeCoin(player, coinConfigs, coinUid) {
  const coin = player.coins.find(({ uid }) => uid === coinUid)
  if (!coin || !isCoinUpgradeable(coin, coinConfigs)) {
    throw new Error("该硬币不能强化")
  }
  const previousLevel = coin.level
  coin.level += 1
  return {
    coinId: coin.coinId,
    coinUid,
    previousLevel,
    newLevel: coin.level
  }
}
