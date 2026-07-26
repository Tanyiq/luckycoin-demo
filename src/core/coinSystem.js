function hydrateCoin(instance, config) {
  const level = instance.level ?? 1
  const levelConfig = config.levels?.[level]
  if (config.levels && !levelConfig) {
    throw new Error(`${config.name}没有等级${level}配置`)
  }
  return {
    uid: instance.uid,
    id: config.id,
    name: config.name,
    type: config.type,
    rarity: config.rarity ?? "STARTER",
    frontRate: config.frontRate,
    luckMode: config.luckMode ?? "normal",
    frontEffect: { ...(levelConfig?.frontEffect ?? config.frontEffect) },
    backEffect: { ...(levelConfig?.backEffect ?? config.backEffect) },
    consumable: config.consumable ?? false,
    level
  }
}

function createCoinInstances(loadout, coinConfigs) {
  let sequence = 0
  return loadout.flatMap(({ coinId, count }) => {
    const config = coinConfigs[coinId]
    if (!config) {
      throw new Error(`找不到硬币配置：${coinId}`)
    }
    if (!Number.isInteger(count) || count < 1) {
      throw new Error(`硬币数量必须是正整数：${coinId}`)
    }

    return Array.from({ length: count }, () =>
      hydrateCoin(
        { uid: `${coinId}_${++sequence}`, coinId, level: 1 },
        config
      )
    )
  })
}

function hydrateCoinInstances(instances, coinConfigs) {
  return instances.map((instance) => {
    const config = coinConfigs[instance.coinId]
    if (!config) {
      throw new Error(`找不到硬币配置：${instance.coinId}`)
    }
    return hydrateCoin(instance, config)
  })
}

function sampleWithoutReplacement(items, count, random) {
  const pool = [...items]
  const result = []
  const takeCount = Math.min(count, pool.length)

  for (let index = 0; index < takeCount; index += 1) {
    const selectedIndex = Math.floor(random() * pool.length)
    result.push(pool.splice(selectedIndex, 1)[0])
  }

  return result
}

export class CoinSystem {
  #coins
  #drawCount
  #random

  constructor({
    loadout,
    coinInstances,
    coinConfigs,
    drawCount,
    random = Math.random
  }) {
    if (!Number.isInteger(drawCount) || drawCount < 1) {
      throw new Error("每回合抽取数量必须是正整数")
    }
    this.#coins = coinInstances
      ? hydrateCoinInstances(coinInstances, coinConfigs)
      : createCoinInstances(loadout, coinConfigs)
    this.#drawCount = drawCount
    this.#random = random
  }

  drawCandidates({ isEligible = () => true } = {}) {
    return sampleWithoutReplacement(
      this.#coins.filter(isEligible),
      this.#drawCount,
      this.#random
    )
  }

  toss(coin, finalFrontRate = coin.frontRate) {
    const roll = this.#random()
    const isFront = roll < finalFrontRate
    return {
      side: isFront ? "front" : "back",
      rate: finalFrontRate,
      roll,
      effect: { ...(isFront ? coin.frontEffect : coin.backEffect) }
    }
  }

  consume(coinUid) {
    const index = this.#coins.findIndex(({ uid }) => uid === coinUid)
    if (index === -1) {
      throw new Error("找不到要移除的硬币")
    }
    this.#coins.splice(index, 1)
  }

  getCoins() {
    return this.#coins.map((coin) => ({
      ...coin,
      frontEffect: { ...coin.frontEffect },
      backEffect: { ...coin.backEffect }
    }))
  }
}
