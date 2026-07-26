export const coins = Object.freeze({
  fire: Object.freeze({
    id: "fire",
    name: "假币",
    type: "attack",
    frontRate: 0.5,
    frontEffect: Object.freeze({
      type: "damage",
      value: 24
    }),
    backEffect: Object.freeze({
      type: "damage",
      value: 12
    }),
    levels: Object.freeze({
      1: Object.freeze({
        frontEffect: Object.freeze({ type: "damage", value: 24 }),
        backEffect: Object.freeze({ type: "damage", value: 12 })
      }),
      2: Object.freeze({
        frontEffect: Object.freeze({ type: "damage", value: 31 }),
        backEffect: Object.freeze({ type: "damage", value: 17 })
      })
    })
  }),
  defense: Object.freeze({
    id: "defense",
    name: "防御",
    type: "defense",
    frontRate: 0.6,
    frontEffect: Object.freeze({
      type: "shield",
      value: 20
    }),
    backEffect: Object.freeze({
      type: "shield",
      value: 12
    }),
    levels: Object.freeze({
      1: Object.freeze({
        frontEffect: Object.freeze({ type: "shield", value: 20 }),
        backEffect: Object.freeze({ type: "shield", value: 12 })
      }),
      2: Object.freeze({
        frontEffect: Object.freeze({ type: "shield", value: 26 }),
        backEffect: Object.freeze({ type: "shield", value: 16 })
      })
    })
  }),
  luck: Object.freeze({
    id: "luck",
    name: "幸运",
    flavor: "一小份经过批准的好运。有效期短得令人安心。",
    type: "utility",
    frontRate: 0.7,
    consumable: true,
    frontEffect: Object.freeze({
      type: "changeLuck",
      value: 3
    }),
    backEffect: Object.freeze({
      type: "changeLuck",
      value: 1
    }),
    levels: Object.freeze({
      1: Object.freeze({
        frontEffect: Object.freeze({ type: "changeLuck", value: 3 }),
        backEffect: Object.freeze({ type: "changeLuck", value: 1 })
      }),
      2: Object.freeze({
        frontEffect: Object.freeze({ type: "changeLuck", value: 4 }),
        backEffect: Object.freeze({ type: "changeLuck", value: 2 })
      })
    })
  }),
  counter: Object.freeze({
    id: "counter",
    name: "反击",
    type: "defense",
    frontRate: 0.45,
    frontEffect: Object.freeze({
      type: "counter",
      shield: 12,
      damage: 30
    }),
    backEffect: Object.freeze({
      type: "counter",
      shield: 7,
      damage: 7
    }),
    levels: Object.freeze({
      1: Object.freeze({
        frontEffect: Object.freeze({
          type: "counter",
          shield: 12,
          damage: 30
        }),
        backEffect: Object.freeze({
          type: "counter",
          shield: 7,
          damage: 7
        })
      }),
      2: Object.freeze({
        frontEffect: Object.freeze({
          type: "counter",
          shield: 17,
          damage: 36
        }),
        backEffect: Object.freeze({
          type: "counter",
          shield: 10,
          damage: 10
        })
      })
    })
  }),
  aftershock: Object.freeze({
    id: "aftershock",
    name: "余震",
    rarity: "COMMON",
    type: "attack",
    frontRate: 0.45,
    frontEffect: Object.freeze({
      type: "conditionalDamage",
      value: 16,
      condition: "enemyHasShield",
      bonus: 16
    }),
    backEffect: Object.freeze({
      type: "conditionalDamage",
      value: 8,
      condition: "enemyHasShield",
      bonus: 8
    }),
    levels: Object.freeze({
      1: Object.freeze({
        frontEffect: Object.freeze({
          type: "conditionalDamage",
          value: 16,
          condition: "enemyHasShield",
          bonus: 16
        }),
        backEffect: Object.freeze({
          type: "conditionalDamage",
          value: 8,
          condition: "enemyHasShield",
          bonus: 8
        })
      }),
      2: Object.freeze({
        frontEffect: Object.freeze({
          type: "conditionalDamage",
          value: 22,
          condition: "enemyHasShield",
          bonus: 22
        }),
        backEffect: Object.freeze({
          type: "conditionalDamage",
          value: 12,
          condition: "enemyHasShield",
          bonus: 12
        })
      })
    })
  }),
  chain: Object.freeze({
    id: "chain",
    name: "连环",
    rarity: "COMMON",
    type: "attack",
    frontRate: 0.55,
    frontEffect: Object.freeze({
      type: "multiDamage",
      hits: 3,
      damagePerHit: 8
    }),
    backEffect: Object.freeze({
      type: "multiDamage",
      hits: 2,
      damagePerHit: 6
    }),
    levels: Object.freeze({
      1: Object.freeze({
        frontEffect: Object.freeze({
          type: "multiDamage",
          hits: 3,
          damagePerHit: 8
        }),
        backEffect: Object.freeze({
          type: "multiDamage",
          hits: 2,
          damagePerHit: 6
        })
      }),
      2: Object.freeze({
        frontEffect: Object.freeze({
          type: "multiDamage",
          hits: 3,
          damagePerHit: 10
        }),
        backEffect: Object.freeze({
          type: "multiDamage",
          hits: 2,
          damagePerHit: 8
        })
      })
    })
  }),
  recovery: Object.freeze({
    id: "recovery",
    name: "复苏",
    flavor: "医疗部门建议您不要询问它为什么只能使用一次。",
    rarity: "COMMON",
    type: "recovery",
    frontRate: 0.6,
    consumable: true,
    frontEffect: Object.freeze({ type: "heal", value: 12 }),
    backEffect: Object.freeze({ type: "heal", value: 5 }),
    levels: Object.freeze({
      1: Object.freeze({
        frontEffect: Object.freeze({ type: "heal", value: 12 }),
        backEffect: Object.freeze({ type: "heal", value: 5 })
      }),
      2: Object.freeze({
        frontEffect: Object.freeze({ type: "heal", value: 16 }),
        backEffect: Object.freeze({ type: "heal", value: 8 })
      })
    })
  }),
  blood_drink: Object.freeze({
    id: "blood_drink",
    name: "血饮",
    rarity: "RARE",
    type: "recovery",
    frontRate: 0.5,
    frontEffect: Object.freeze({
      type: "damageAndHeal",
      damage: 18,
      heal: 6
    }),
    backEffect: Object.freeze({
      type: "damageAndHeal",
      damage: 8,
      heal: 3
    }),
    levels: Object.freeze({
      1: Object.freeze({
        frontEffect: Object.freeze({
          type: "damageAndHeal",
          damage: 18,
          heal: 6
        }),
        backEffect: Object.freeze({
          type: "damageAndHeal",
          damage: 8,
          heal: 3
        })
      }),
      2: Object.freeze({
        frontEffect: Object.freeze({
          type: "damageAndHeal",
          damage: 24,
          heal: 8
        }),
        backEffect: Object.freeze({
          type: "damageAndHeal",
          damage: 12,
          heal: 4
        })
      })
    })
  }),
  meteor: Object.freeze({
    id: "meteor",
    name: "陨星",
    flavor: "理论上，它应该击中敌人。理论上。",
    rarity: "RARE",
    type: "attack",
    frontRate: 0.25,
    frontEffect: Object.freeze({ type: "damage", value: 60 }),
    backEffect: Object.freeze({ type: "damage", value: 12 }),
    levels: Object.freeze({
      1: Object.freeze({
        frontEffect: Object.freeze({ type: "damage", value: 60 }),
        backEffect: Object.freeze({ type: "damage", value: 12 })
      }),
      2: Object.freeze({
        frontEffect: Object.freeze({ type: "damage", value: 75 }),
        backEffect: Object.freeze({ type: "damage", value: 16 })
      })
    })
  }),
  blood_pact: Object.freeze({
    id: "blood_pact",
    name: "血契",
    flavor: "用生命交换力量。赌场最喜欢目标明确的客人。",
    rarity: "RARE",
    type: "risk",
    frontRate: 0.4,
    frontEffect: Object.freeze({
      type: "selfCostDamage",
      cost: 3,
      damage: 45,
      minHp: 1
    }),
    backEffect: Object.freeze({
      type: "selfCostDamage",
      cost: 4,
      damage: 24,
      minHp: 1
    }),
    levels: Object.freeze({
      1: Object.freeze({
        frontEffect: Object.freeze({
          type: "selfCostDamage",
          cost: 3,
          damage: 45,
          minHp: 1
        }),
        backEffect: Object.freeze({
          type: "selfCostDamage",
          cost: 4,
          damage: 24,
          minHp: 1
        })
      }),
      2: Object.freeze({
        frontEffect: Object.freeze({
          type: "selfCostDamage",
          cost: 3,
          damage: 56,
          minHp: 1
        }),
        backEffect: Object.freeze({
          type: "selfCostDamage",
          cost: 4,
          damage: 30,
          minHp: 1
        })
      })
    })
  }),
  iron_wall: Object.freeze({
    id: "iron_wall",
    name: "铁壁",
    rarity: "RARE",
    type: "defense",
    frontRate: 0.55,
    frontEffect: Object.freeze({
      type: "shieldWithExistingBonus",
      shield: 30,
      bonus: 10
    }),
    backEffect: Object.freeze({
      type: "shieldWithExistingBonus",
      shield: 15,
      bonus: 10
    }),
    levels: Object.freeze({
      1: Object.freeze({
        frontEffect: Object.freeze({
          type: "shieldWithExistingBonus",
          shield: 30,
          bonus: 10
        }),
        backEffect: Object.freeze({
          type: "shieldWithExistingBonus",
          shield: 15,
          bonus: 10
        })
      }),
      2: Object.freeze({
        frontEffect: Object.freeze({
          type: "shieldWithExistingBonus",
          shield: 38,
          bonus: 15
        }),
        backEffect: Object.freeze({
          type: "shieldWithExistingBonus",
          shield: 20,
          bonus: 15
        })
      })
    })
  }),
  reflection: Object.freeze({
    id: "reflection",
    name: "反震",
    flavor: "把损失退还给对方，不等于没有发生损失。",
    rarity: "RARE",
    type: "counter",
    frontRate: 0.45,
    frontEffect: Object.freeze({
      type: "reflectionShield",
      shield: 15
    }),
    backEffect: Object.freeze({
      type: "reflectionShield",
      shield: 5
    }),
    levels: Object.freeze({
      1: Object.freeze({
        frontEffect: Object.freeze({
          type: "reflectionShield",
          shield: 15
        }),
        backEffect: Object.freeze({
          type: "reflectionShield",
          shield: 5
        })
      }),
      2: Object.freeze({
        frontEffect: Object.freeze({
          type: "reflectionShield",
          shield: 20
        }),
        backEffect: Object.freeze({
          type: "reflectionShield",
          shield: 8
        })
      })
    })
  }),
  lucky_bullet: Object.freeze({
    id: "lucky_bullet",
    name: "幸运子弹",
    rarity: "RARE",
    type: "attack",
    frontRate: 0.5,
    frontEffect: Object.freeze({
      type: "luckDamage",
      baseDamage: 10,
      minMultiplier: 2
    }),
    backEffect: Object.freeze({ type: "damage", value: 8 }),
    levels: Object.freeze({
      1: Object.freeze({
        frontEffect: Object.freeze({
          type: "luckDamage",
          baseDamage: 10,
          minMultiplier: 2
        }),
        backEffect: Object.freeze({ type: "damage", value: 8 })
      }),
      2: Object.freeze({
        frontEffect: Object.freeze({
          type: "luckDamage",
          baseDamage: 12,
          minMultiplier: 2
        }),
        backEffect: Object.freeze({ type: "damage", value: 10 })
      })
    })
  }),
  doom: Object.freeze({
    id: "doom",
    name: "厄运",
    flavor: "专为看到坏消息后第一反应是加注的人设计。",
    rarity: "RARE",
    type: "attack",
    frontRate: 0.7,
    frontEffect: Object.freeze({ type: "damage", value: 5 }),
    backEffect: Object.freeze({ type: "damage", value: 40 }),
    levels: Object.freeze({
      1: Object.freeze({
        frontEffect: Object.freeze({ type: "damage", value: 5 }),
        backEffect: Object.freeze({ type: "damage", value: 40 })
      }),
      2: Object.freeze({
        frontEffect: Object.freeze({ type: "damage", value: 8 }),
        backEffect: Object.freeze({ type: "damage", value: 52 })
      })
    })
  })
})
