export const shopPriceTables = Object.freeze({
  chapter0: Object.freeze({
    coins: Object.freeze({
      COMMON: 35,
      RARE: 60
    }),
    relics: Object.freeze({
      COMMON: 75,
      UNCOMMON: 90,
      RARE: 110
    }),
    upgrade: 50,
    recyclePayout: 15
  })
})

export const shops = Object.freeze({
  chapter0Basic: Object.freeze({
    id: "chapter_0_basic_shop",
    coinCount: 3,
    relicCount: 2,
    coinIds: Object.freeze([
      "aftershock",
      "chain",
      "recovery",
      "blood_drink",
      "meteor",
      "blood_pact",
      "iron_wall",
      "reflection",
      "lucky_bullet",
      "doom"
    ]),
    coinRarityWeights: Object.freeze({
      COMMON: 70,
      RARE: 30
    }),
    relicRarityWeights: Object.freeze({
      COMMON: 50,
      UNCOMMON: 35,
      RARE: 15
    }),
    priceTableId: "chapter0"
  })
})
