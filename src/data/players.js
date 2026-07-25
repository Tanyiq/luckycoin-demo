export const players = Object.freeze({
  tutorialPlayer: Object.freeze({
    id: "tutorial_player",
    name: "玩家",
    maxHp: 100,
    initialHp: 100,
    initialShield: 0,
    initialLuck: 0,
    coinLoadout: Object.freeze([
      Object.freeze({ coinId: "fire", count: 3 }),
      Object.freeze({ coinId: "defense", count: 2 }),
      Object.freeze({ coinId: "luck", count: 1 })
    ])
  })
})
