export const RelicRarity = Object.freeze({
  COMMON: "COMMON",
  UNCOMMON: "UNCOMMON",
  RARE: "RARE",
  SPECIAL: "SPECIAL"
})

export const RelicTrigger = Object.freeze({
  BATTLE_SETUP: "BATTLE_SETUP",
  BATTLE_START: "BATTLE_START",
  PROBABILITY_MODIFY: "PROBABILITY_MODIFY",
  COIN_EFFECT_MODIFY: "COIN_EFFECT_MODIFY",
  AFTER_COIN_TOSS: "AFTER_COIN_TOSS",
  AFTER_HP_DAMAGE: "AFTER_HP_DAMAGE",
  BEFORE_DEATH: "BEFORE_DEATH",
  COIN_REMOVED: "COIN_REMOVED",
  RELIC_ACQUIRED: "RELIC_ACQUIRED",
  BEFORE_ENEMY_ACTION: "BEFORE_ENEMY_ACTION",
  PLAYER_DAMAGE_MODIFY: "PLAYER_DAMAGE_MODIFY",
  PLAYER_SELECTION_START: "PLAYER_SELECTION_START"
})

export const relics = Object.freeze({
  gambler_cuff: Object.freeze({
    id: "gambler_cuff",
    name: "赌徒袖口",
    description:
      "每场战斗第4、8、12、16……次硬币选择阶段，可以追加下注并额外使用一枚硬币。",
    rarity: RelicRarity.RARE,
    metaLocked: true,
    effects: Object.freeze([
      Object.freeze({
        trigger: RelicTrigger.PLAYER_SELECTION_START,
        operation: "ADD_MAX_COINS_ON_INTERVAL",
        interval: 4,
        value: 1
      })
    ])
  }),
  fate_balance: Object.freeze({
    id: "fate_balance",
    name: "命运天平",
    description: "连续投出同一面时，下一次投掷向另一面修正10%，最多30%。",
    flavor: "庄家禁止你使用，但忘记把规定写进合同。",
    rarity: RelicRarity.RARE,
    effects: Object.freeze([
      Object.freeze({
        trigger: RelicTrigger.PROBABILITY_MODIFY,
        operation: "SHIFT_AWAY_FROM_STREAK",
        step: 0.1,
        max: 0.3
      }),
      Object.freeze({
        trigger: RelicTrigger.AFTER_COIN_TOSS,
        operation: "RECORD_TOSS_STREAK"
      })
    ])
  }),
  lucky_bracelet: Object.freeze({
    id: "lucky_bracelet",
    name: "幸运护腕",
    description: "每场战斗第一次受到生命伤害后，幸运+1。",
    rarity: RelicRarity.COMMON,
    effects: Object.freeze([
      Object.freeze({
        trigger: RelicTrigger.AFTER_HP_DAMAGE,
        operation: "FIRST_DAMAGE_ADD_LUCK",
        value: 1
      })
    ])
  }),
  broken_dice_bone: Object.freeze({
    id: "broken_dice_bone",
    name: "破碎骰骨",
    description: "幸运低于0时，反面数值效果提高20%。",
    rarity: RelicRarity.UNCOMMON,
    effects: Object.freeze([
      Object.freeze({
        trigger: RelicTrigger.COIN_EFFECT_MODIFY,
        operation: "BOOST_BACK_WHEN_UNLUCKY",
        multiplier: 1.2
      })
    ])
  }),
  fate_carving_knife: Object.freeze({
    id: "fate_carving_knife",
    name: "命运刻刀",
    description: "永久删除硬币时，最大生命+5并恢复5点生命。",
    rarity: RelicRarity.UNCOMMON,
    effects: Object.freeze([
      Object.freeze({
        trigger: RelicTrigger.COIN_REMOVED,
        operation: "ADD_MAX_HP_AND_HEAL",
        value: 5
      })
    ])
  }),
  double_sided_coin: Object.freeze({
    id: "double_sided_coin",
    name: "双面金币",
    description: "硬币较弱面增强、较强面削弱，使正反面数值差距减半。",
    rarity: RelicRarity.RARE,
    effects: Object.freeze([
      Object.freeze({
        trigger: RelicTrigger.COIN_EFFECT_MODIFY,
        operation: "BALANCE_COIN_FACES",
        ratio: 0.25
      })
    ])
  }),
  observer_eye: Object.freeze({
    id: "observer_eye",
    name: "观察者之眼",
    description: "每回合额外抽取1枚硬币。",
    flavor: "它能看到未来，所以它现在非常后悔。",
    rarity: RelicRarity.RARE,
    effects: Object.freeze([
      Object.freeze({
        trigger: RelicTrigger.BATTLE_SETUP,
        operation: "ADD_DRAW_COUNT",
        value: 1
      })
    ])
  }),
  blood_contract: Object.freeze({
    id: "blood_contract",
    name: "血色契约",
    description: "战斗开始时生命不高于50%，幸运+2。",
    rarity: RelicRarity.UNCOMMON,
    effects: Object.freeze([
      Object.freeze({
        trigger: RelicTrigger.BATTLE_START,
        operation: "LOW_HP_ADD_LUCK",
        threshold: 0.5,
        value: 2
      })
    ])
  }),
  revenge_thorns: Object.freeze({
    id: "revenge_thorns",
    name: "复仇荆棘",
    description: "每次受到生命伤害时，对敌人造成2点反击伤害。",
    rarity: RelicRarity.COMMON,
    effects: Object.freeze([
      Object.freeze({
        trigger: RelicTrigger.AFTER_HP_DAMAGE,
        operation: "COUNTER_DAMAGE",
        value: 2
      })
    ])
  }),
  fate_hourglass: Object.freeze({
    id: "fate_hourglass",
    name: "逆命沙漏",
    description: "首次受到致命伤害时进行50%命运判定，正面以1点生命复活。触发后永久失去。",
    flavor: "每位客人只能复活一次。第二次会影响财务报表。",
    rarity: RelicRarity.RARE,
    effects: Object.freeze([
      Object.freeze({
        trigger: RelicTrigger.BEFORE_DEATH,
        operation: "REVIVE_COIN_TOSS",
        baseRate: 0.5,
        hp: 1,
        consumeAndBan: true
      })
    ])
  }),
  fate_prism: Object.freeze({
    id: "fate_prism",
    name: "命运棱镜",
    description: "获得时，立即将当前幸运值变为其相反数。",
    flavor: "它不会改变命运，只是把命运翻了个面。",
    rarity: RelicRarity.SPECIAL,
    effects: Object.freeze([
      Object.freeze({
        trigger: RelicTrigger.RELIC_ACQUIRED,
        operation: "NEGATE_LUCK_ON_ACQUIRE"
      })
    ])
  }),
  fate_reaper: Object.freeze({
    id: "fate_reaper",
    name: "命运收割者",
    description: "敌人行动前，若其生命低于当前幸运值，直接将其消灭。",
    rarity: RelicRarity.RARE,
    effects: Object.freeze([
      Object.freeze({
        trigger: RelicTrigger.BEFORE_ENEMY_ACTION,
        operation: "EXECUTE_BELOW_LUCK"
      })
    ])
  }),
  dark_nourishment: Object.freeze({
    id: "dark_nourishment",
    name: "黑暗滋养",
    description: "每投出一枚反面硬币，恢复1点生命。",
    flavor: "有人从成功中成长。你选择了供应更稳定的来源。",
    rarity: RelicRarity.RARE,
    effects: Object.freeze([
      Object.freeze({
        trigger: RelicTrigger.AFTER_COIN_TOSS,
        operation: "HEAL_ON_BACK",
        value: 1
      })
    ])
  }),
  undying_heart: Object.freeze({
    id: "undying_heart",
    name: "不死心脏",
    description: "生命低于30%时，玩家造成的所有伤害提高50%。",
    flavor: "它只在你快死时努力工作，因为平时工作不符合成本效益。",
    rarity: RelicRarity.RARE,
    effects: Object.freeze([
      Object.freeze({
        trigger: RelicTrigger.PLAYER_DAMAGE_MODIFY,
        operation: "LOW_HP_DAMAGE_MULTIPLIER",
        threshold: 0.3,
        multiplier: 1.5
      })
    ])
  })
})
