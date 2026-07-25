export const experienceThresholds = Object.freeze([0, 30, 80])

export const coinPools = Object.freeze({
  chapter1Basic: Object.freeze(["fire", "defense", "luck"]),
  chapter1Full: Object.freeze(["fire", "defense", "luck", "counter"]),
  expanded: Object.freeze([
    "fire",
    "defense",
    "luck",
    "counter",
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
  ])
})

export const battleRewards = Object.freeze({
  trainingDummy: Object.freeze({
    battleId: "training_dummy",
    exp: 10,
    chips: 15,
    mode: "none"
  }),
  fireThief: Object.freeze({
    battleId: "fire_thief",
    exp: 20,
    chips: 25,
    mode: "fixed",
    fixedReward: Object.freeze({
      type: "addCoin",
      coinId: "counter"
    })
  }),
  armorBeast: Object.freeze({
    battleId: "armor_beast",
    exp: 50,
    chips: 50,
    mode: "choice",
    coinPoolId: "expanded"
  }),
  fateDevourer: Object.freeze({
    battleId: "fate_devourer",
    exp: 0,
    chips: 60,
    mode: "none"
  })
})
