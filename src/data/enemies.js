export const enemies = Object.freeze({
  trainingDummy: Object.freeze({
    id: "training_dummy",
    name: "新手服务专员",
    description:
      "负责教新人如何投掷硬币，以及如何在失败后保持礼貌。",
    intro: "欢迎参加新手培训。受伤属于教学内容。",
    defeatText: "教学完成。根据规定，这算作我的工作成果。",
    maxHp: 35,
    initialHp: 35,
    initialShield: 0,
    attack: 8,
    behaviors: Object.freeze([
      Object.freeze({
        id: "dummy_attack",
        name: "木桩攻击",
        type: "attack",
        description: "造成8点伤害",
        weight: 1,
        cooldown: 0,
        firstTurnAllowed: true,
        preventImmediateRepeat: false,
        effects: Object.freeze([
          Object.freeze({ type: "damagePlayer", valueFrom: "attack" })
        ])
      })
    ]),
    intentRule: Object.freeze({
      type: "fixed",
      fallbackBehaviorId: "dummy_attack"
    })
  }),

  fireThief: Object.freeze({
    id: "fire_thief",
    name: "好运扒手",
    description:
      "他不偷钱，只偷别人即将发生的好事。赌场暂未将好运列为财产。",
    intro: "放心，我不会拿走你已经拥有的东西。",
    defeatText: "他留下了一张字迹潦草的概率免责声明。",
    maxHp: 72,
    initialHp: 72,
    initialShield: 0,
    attack: 7,
    behaviors: Object.freeze([
      Object.freeze({
        id: "fire_slash",
        name: "火刃攻击",
        type: "attack",
        description: "造成7点伤害",
        weight: 55,
        cooldown: 0,
        firstTurnAllowed: true,
        preventImmediateRepeat: false,
        effects: Object.freeze([
          Object.freeze({ type: "damagePlayer", valueFrom: "attack" })
        ])
      }),
      Object.freeze({
        id: "ember_guard",
        name: "余烬护身",
        type: "defense",
        description: "获得10点护盾",
        weight: 25,
        cooldown: 1,
        firstTurnAllowed: true,
        preventImmediateRepeat: true,
        effects: Object.freeze([
          Object.freeze({ type: "shieldSelf", value: 10 })
        ])
      }),
      Object.freeze({
        id: "blazing_strike",
        name: "烈火重击",
        type: "attack",
        description: "造成12点伤害",
        weight: 20,
        cooldown: 2,
        firstTurnAllowed: false,
        preventImmediateRepeat: true,
        effects: Object.freeze([
          Object.freeze({ type: "damagePlayer", value: 12 })
        ])
      }),
      Object.freeze({
        id: "steal_luck",
        name: "顺手牵运",
        type: "special",
        description: "幸运降低1",
        weight: 1,
        cooldown: 0,
        firstTurnAllowed: false,
        preventImmediateRepeat: false,
        effects: Object.freeze([
          Object.freeze({ type: "changePlayerLuck", value: -1 })
        ])
      })
    ]),
    intentRule: Object.freeze({
      type: "sequence",
      sequence: Object.freeze([
        "fire_slash",
        "steal_luck",
        "ember_guard",
        "blazing_strike"
      ]),
      fallbackBehaviorId: "fire_slash"
    })
  }),

  armorBeast: Object.freeze({
    id: "armor_beast",
    name: "欠款保全员",
    description:
      "赌场保安，负责制止赖账、作弊以及胜率过高。",
    intro: "检测到客人的财务状况仍然允许继续受伤。",
    defeatText: "保全失败。损失将由下一位客人承担。",
    maxHp: 95,
    initialHp: 95,
    initialShield: 0,
    attack: 8,
    maxAttackBonus: 4,
    behaviors: Object.freeze([
      Object.freeze({
        id: "bite",
        name: "撕咬",
        type: "attack",
        description: "造成8点伤害",
        weight: 45,
        cooldown: 0,
        firstTurnAllowed: true,
        preventImmediateRepeat: false,
        effects: Object.freeze([
          Object.freeze({ type: "damagePlayer", valueFrom: "attack" })
        ])
      }),
      Object.freeze({
        id: "charge",
        name: "猛撞",
        type: "attack",
        description: "造成14点伤害",
        weight: 20,
        cooldown: 2,
        firstTurnAllowed: false,
        preventImmediateRepeat: true,
        effects: Object.freeze([
          Object.freeze({
            type: "damagePlayer",
            valueFrom: "attack",
            bonus: 6
          })
        ])
      }),
      Object.freeze({
        id: "harden_shell",
        name: "硬化甲壳",
        type: "defense",
        description: "获得12点护盾",
        weight: 20,
        cooldown: 2,
        firstTurnAllowed: true,
        preventImmediateRepeat: true,
        effects: Object.freeze([
          Object.freeze({ type: "shieldSelf", value: 12 })
        ])
      }),
      Object.freeze({
        id: "sharpen_claws",
        name: "磨砺利爪",
        type: "buff",
        description: "后续攻击增加2点伤害",
        weight: 15,
        cooldown: 3,
        firstTurnAllowed: false,
        preventImmediateRepeat: true,
        effects: Object.freeze([
          Object.freeze({ type: "increaseAttack", value: 2 })
        ])
      })
    ]),
    intentRule: Object.freeze({
      type: "weighted_random",
      firstBehaviorId: "bite",
      fallbackBehaviorId: "bite"
    })
  }),

  fateDevourer: Object.freeze({
    id: "fate_devourer",
    name: "首席赔率官",
    description:
      "赌场最高负责人，负责让所有过于顺利的概率恢复健康。",
    intro: "你没有违反规则。规则只是还没来得及适应你。",
    defeatText: "恭喜。你的胜利已经被登记为个别案例。",
    maxHp: 130,
    initialHp: 130,
    initialShield: 0,
    attack: 13,
    behaviors: Object.freeze([
      Object.freeze({
        id: "devour_attack",
        name: "庄家裁定",
        type: "attack",
        description: "造成13点伤害",
        weight: 1,
        cooldown: 0,
        firstTurnAllowed: true,
        preventImmediateRepeat: false,
        effects: Object.freeze([
          Object.freeze({ type: "damagePlayer", valueFrom: "attack" })
        ])
      }),
      Object.freeze({
        id: "devour_luck",
        name: "赔率校准",
        type: "special",
        description: "幸运降低2",
        weight: 1,
        cooldown: 0,
        firstTurnAllowed: false,
        preventImmediateRepeat: false,
        effects: Object.freeze([
          Object.freeze({ type: "changePlayerLuck", value: -2 })
        ])
      })
    ]),
    intentRule: Object.freeze({
      type: "sequence",
      sequence: Object.freeze([
        "devour_attack",
        "devour_attack",
        "devour_luck"
      ]),
      fallbackBehaviorId: "devour_attack"
    })
  })
})
