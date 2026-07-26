function uniqueIds(ids = []) {
  return [...new Set(ids)]
}

export function createDiscoveryRecord({
  coinIds = [],
  relicIds = []
} = {}) {
  return {
    coinIds: uniqueIds(coinIds),
    relicIds: uniqueIds(relicIds)
  }
}

export function mergeDiscoveryRecords(...records) {
  return createDiscoveryRecord({
    coinIds: records.flatMap((record) => record?.coinIds ?? []),
    relicIds: records.flatMap((record) => record?.relicIds ?? [])
  })
}

export function recordCoinDiscovery(player, coinId) {
  player.discovery ??= createDiscoveryRecord()
  if (player.discovery.coinIds.includes(coinId)) {
    return false
  }
  player.discovery.coinIds.push(coinId)
  return true
}

export function recordRelicDiscovery(player, relicId) {
  player.discovery ??= createDiscoveryRecord()
  if (player.discovery.relicIds.includes(relicId)) {
    return false
  }
  player.discovery.relicIds.push(relicId)
  return true
}

export function cloneDiscoveryRecord(record) {
  return createDiscoveryRecord(record)
}
