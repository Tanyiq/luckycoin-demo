import {
  getUpgradeableCoins,
  upgradeCoin
} from "./coinProgression.js"
import {
  canSpendChips,
  earnChips,
  spendChips
} from "./chipSystem.js"
import { RelicRewardSystem } from "./relicRewardSystem.js"
import { RelicSystem, RelicTrigger } from "./relicSystem.js"

export const ShopStatus = Object.freeze({
  BROWSING: "BROWSING",
  COMPLETED: "COMPLETED"
})

export const ShopCategory = Object.freeze({
  COIN: "COIN",
  RELIC: "RELIC",
  UPGRADE: "UPGRADE",
  RECYCLE: "RECYCLE"
})

function weightedPick(items, getWeight, random) {
  const total = items.reduce(
    (sum, item) => sum + Math.max(0, getWeight(item)),
    0
  )
  if (items.length === 0 || total <= 0) {
    return null
  }
  let roll = random() * total
  for (const item of items) {
    roll -= Math.max(0, getWeight(item))
    if (roll < 0) {
      return item
    }
  }
  return items.at(-1)
}

function drawWeightedUnique(items, count, getWeight, random) {
  const pool = [...items]
  const selected = []
  while (selected.length < count && pool.length > 0) {
    const item = weightedPick(pool, getWeight, random)
    if (!item) {
      break
    }
    selected.push(item)
    pool.splice(pool.indexOf(item), 1)
  }
  return selected
}

function clonePlayer(player) {
  return {
    ...player,
    coins: player.coins.map((coin) => ({ ...coin })),
    unlockedCoinIds: [...player.unlockedCoinIds],
    relicIds: [...player.relicIds],
    bannedRelicIds: [...player.bannedRelicIds],
    runStats: { ...player.runStats }
  }
}

export class ShopSystem {
  #player
  #coinConfigs
  #relicDefinitions
  #priceTable
  #relicRewards
  #relicSystem
  #state

  constructor({
    player,
    shopConfig,
    priceTable,
    coinConfigs,
    relicDefinitions,
    random = Math.random
  }) {
    this.#player = player
    this.#coinConfigs = coinConfigs
    this.#relicDefinitions = relicDefinitions
    this.#priceTable = priceTable
    this.#relicRewards = new RelicRewardSystem({
      player,
      relicDefinitions,
      random
    })
    this.#relicSystem = new RelicSystem({
      relicDefinitions,
      relicIds: player.relicIds,
      bannedRelicIds: player.bannedRelicIds,
      random
    })
    this.#state = {
      shopId: shopConfig.id,
      status: ShopStatus.BROWSING,
      inventory: this.#createInventory(shopConfig, random),
      transactions: []
    }
  }

  getState() {
    return {
      ...this.#state,
      inventory: this.#state.inventory.map((listing) => ({
        ...listing
      })),
      transactions: this.#state.transactions.map((transaction) => ({
        ...transaction
      })),
      player: clonePlayer(this.#player)
    }
  }

  getUpgradeableCoins() {
    return getUpgradeableCoins(this.#player, this.#coinConfigs)
  }

  getRecyclableCoins() {
    if (this.#player.coins.length <= 3) {
      return []
    }
    return this.#player.coins.map((coin) => ({ ...coin }))
  }

  buyCoin(listingId) {
    const listing = this.#requireListing(
      listingId,
      ShopCategory.COIN
    )
    this.#requireAffordable(listing.price)
    const coin = {
      uid: `${listing.contentId}_${this.#player.nextCoinSequence++}`,
      coinId: listing.contentId,
      level: 1
    }
    spendChips(this.#player, listing.price)
    this.#player.coins.push(coin)
    if (!this.#player.unlockedCoinIds.includes(coin.coinId)) {
      this.#player.unlockedCoinIds.push(coin.coinId)
    }
    return this.#completeListing(listing, {
      category: listing.category,
      coinId: coin.coinId,
      coinUid: coin.uid,
      price: listing.price
    })
  }

  buyRelic(listingId) {
    const listing = this.#requireListing(
      listingId,
      ShopCategory.RELIC
    )
    this.#requireAffordable(listing.price)
    const acquired = this.#relicRewards.acquire(listing.contentId)
    spendChips(this.#player, listing.price)
    return this.#completeListing(listing, {
      category: listing.category,
      relicId: acquired.relicId,
      price: listing.price,
      logs: acquired.logs
    })
  }

  upgrade(listingId, coinUid) {
    const listing = this.#requireListing(
      listingId,
      ShopCategory.UPGRADE
    )
    this.#requireAffordable(listing.price)
    const upgraded = upgradeCoin(
      this.#player,
      this.#coinConfigs,
      coinUid
    )
    spendChips(this.#player, listing.price)
    this.#player.runStats.upgradeCount += 1
    return this.#completeListing(listing, {
      category: listing.category,
      price: listing.price,
      ...upgraded
    })
  }

  recycle(listingId, coinUid) {
    const listing = this.#requireListing(
      listingId,
      ShopCategory.RECYCLE
    )
    if (this.#player.coins.length <= 3) {
      throw new Error("硬币库至少保留3枚硬币")
    }
    const index = this.#player.coins.findIndex(
      ({ uid }) => uid === coinUid
    )
    if (index === -1) {
      throw new Error("找不到要回收的硬币")
    }
    const [coin] = this.#player.coins.splice(index, 1)
    this.#player.runStats.removeCount += 1
    const relicResult = this.#relicSystem.trigger(
      RelicTrigger.COIN_REMOVED,
      { player: this.#player }
    )
    earnChips(this.#player, listing.payout)
    return this.#completeListing(listing, {
      category: listing.category,
      coinId: coin.coinId,
      coinUid,
      payout: listing.payout,
      logs: relicResult.logs
    })
  }

  leave() {
    if (this.#state.status !== ShopStatus.BROWSING) {
      throw new Error("商店已经离开")
    }
    this.#state.status = ShopStatus.COMPLETED
    return this.getState()
  }

  #createInventory(config, random) {
    const validCoins = config.coinIds.filter(
      (coinId) => this.#coinConfigs[coinId]
    )
    const commonCoins = validCoins.filter(
      (coinId) => this.#coinConfigs[coinId].rarity === "COMMON"
    )
    const firstCoin = weightedPick(
      commonCoins,
      () => 1,
      random
    )
    const remainingCoins = validCoins.filter(
      (coinId) => coinId !== firstCoin
    )
    const selectedCoins = [
      ...(firstCoin ? [firstCoin] : []),
      ...drawWeightedUnique(
        remainingCoins,
        config.coinCount - (firstCoin ? 1 : 0),
        (coinId) =>
          config.coinRarityWeights[
            this.#coinConfigs[coinId].rarity
          ] ?? 0,
        random
      )
    ]

    const availableRelics =
      this.#relicRewards.getAvailableRelicIds({
        excludeSpecial: true
      })
    const affordableRelics = availableRelics.filter(
      (relicId) =>
        this.#relicDefinitions[relicId].rarity !== "RARE"
    )
    const firstRelic = weightedPick(
      affordableRelics,
      (relicId) =>
        config.relicRarityWeights[
          this.#relicDefinitions[relicId].rarity
        ] ?? 0,
      random
    )
    const remainingRelics = availableRelics.filter(
      (relicId) => relicId !== firstRelic
    )
    const selectedRelics = [
      ...(firstRelic ? [firstRelic] : []),
      ...drawWeightedUnique(
        remainingRelics,
        config.relicCount - (firstRelic ? 1 : 0),
        (relicId) =>
          config.relicRarityWeights[
            this.#relicDefinitions[relicId].rarity
          ] ?? 0,
        random
      )
    ]

    return [
      ...selectedCoins.map((coinId, index) => ({
        listingId: `coin_${index + 1}`,
        category: ShopCategory.COIN,
        contentId: coinId,
        price:
          this.#priceTable.coins[
            this.#coinConfigs[coinId].rarity
          ],
        soldOut: false
      })),
      ...selectedRelics.map((relicId, index) => ({
        listingId: `relic_${index + 1}`,
        category: ShopCategory.RELIC,
        contentId: relicId,
        price:
          this.#priceTable.relics[
            this.#relicDefinitions[relicId].rarity
          ],
        soldOut: false
      })),
      {
        listingId: "upgrade_service",
        category: ShopCategory.UPGRADE,
        contentId: null,
        price: this.#priceTable.upgrade,
        soldOut: false
      },
      {
        listingId: "recycle_service",
        category: ShopCategory.RECYCLE,
        contentId: null,
        price: 0,
        payout: this.#priceTable.recyclePayout,
        soldOut: false
      }
    ]
  }

  #requireListing(listingId, category) {
    if (this.#state.status !== ShopStatus.BROWSING) {
      throw new Error("当前不在商店交易状态")
    }
    const listing = this.#state.inventory.find(
      ({ listingId: id }) => id === listingId
    )
    if (!listing || listing.category !== category) {
      throw new Error("找不到该商品")
    }
    if (listing.soldOut) {
      throw new Error("该商品已经售罄")
    }
    return listing
  }

  #requireAffordable(price) {
    if (!canSpendChips(this.#player, price)) {
      throw new Error("筹码不足")
    }
  }

  #completeListing(listing, transaction) {
    listing.soldOut = true
    this.#state.transactions.push(transaction)
    return {
      transaction: { ...transaction },
      state: this.getState()
    }
  }
}
