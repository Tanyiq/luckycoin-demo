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

  oddsOperator: Object.freeze({
    id: "odds_operator",
    name: "赔率操盘手",
    description:
      "赌场基层庄家，负责让每一次意外最终都能写进预计范围。",
    intro: "请稍候，系统正在计算你什么时候最适合受伤。",
    defeatText: "本次赔率波动已被登记为操作失误。",
    maxHp: 84,
    initialHp: 84,
    initialShield: 0,
    attack: 10,
    intentState: Object.freeze({
      oddsRaised: false
    }),
    behaviors: Object.freeze([
      Object.freeze({
        id: "adjust_odds",
        name: "调整赔率",
        type: "buff",
        description: "提高下一次庄家收割的威胁",
        weight: 1,
        cooldown: 2,
        firstTurnAllowed: true,
        preventImmediateRepeat: true,
        requiresInactiveState: "oddsRaised",
        effects: Object.freeze([
          Object.freeze({
            type: "setEnemyState",
            field: "oddsRaised",
            value: true,
            description: "下一次庄家收割强化",
            message: "赔率上调，下一次庄家收割将被强化"
          })
        ])
      }),
      Object.freeze({
        id: "house_harvest",
        name: "庄家收割",
        type: "attack",
        description: "根据当前赔率发动攻击",
        weight: 1,
        cooldown: 1,
        firstTurnAllowed: true,
        preventImmediateRepeat: true,
        effects: Object.freeze([
          Object.freeze({
            type: "conditionalDamagePlayer",
            stateField: "oddsRaised",
            defaultValue: 10,
            activeValue: 16
          }),
          Object.freeze({
            type: "setEnemyState",
            field: "oddsRaised",
            value: false,
            description: "收割后赔率恢复",
            message: "庄家完成收割，赔率恢复"
          })
        ])
      }),
      Object.freeze({
        id: "recalculate",
        name: "重新计算",
        type: "defense",
        description: "获得护盾并重置赔率",
        weight: 1,
        cooldown: 1,
        firstTurnAllowed: true,
        preventImmediateRepeat: true,
        effects: Object.freeze([
          Object.freeze({ type: "shieldSelf", value: 11 }),
          Object.freeze({
            type: "setEnemyState",
            field: "oddsRaised",
            value: false,
            description: "重置赔率",
            message: "赔率重新归入安全区间"
          })
        ])
      })
    ]),
    intentRule: Object.freeze({
      type: "weighted_random",
      firstBehaviorId: "adjust_odds",
      indicators: Object.freeze([
        Object.freeze({
          field: "oddsRaised",
          label: "赔率状态",
          trueLabel: "已上调",
          falseLabel: "正常"
        })
      ]),
      fallbackBehaviorId: "adjust_odds"
    })
  }),

  luckThief: Object.freeze({
    id: "luck_thief",
    name: "幸运窃取者",
    description:
      "专门处理来源不明的好运，并坚持暂存不等于盗窃。",
    intro: "我只是替你保管。保管期限由我决定。",
    defeatText: "赃运散落一地，但拒绝提供失主证明。",
    maxHp: 78,
    initialHp: 78,
    initialShield: 0,
    attack: 8,
    intentState: Object.freeze({
      stolenLuck: 0
    }),
    behaviors: Object.freeze([
      Object.freeze({
        id: "temporary_luck_theft",
        name: "临时窃运",
        type: "special",
        description: "降低玩家幸运并暂存在敌人身上",
        weight: 1,
        cooldown: 2,
        firstTurnAllowed: true,
        preventImmediateRepeat: true,
        effects: Object.freeze([
          Object.freeze({
            type: "stealPlayerLuck",
            value: 2,
            stateField: "stolenLuck"
          })
        ])
      }),
      Object.freeze({
        id: "borrowed_luck_attack",
        name: "借运攻击",
        type: "attack",
        description: "消耗暂存幸运强化攻击",
        weight: 1,
        cooldown: 1,
        firstTurnAllowed: true,
        preventImmediateRepeat: true,
        requiresPositiveState: "stolenLuck",
        effects: Object.freeze([
          Object.freeze({
            type: "spendStolenLuckAttack",
            stateField: "stolenLuck",
            baseValue: 8,
            valuePerPoint: 3,
            consume: 1
          })
        ])
      }),
      Object.freeze({
        id: "return_probability",
        name: "概率返还",
        type: "defense",
        description: "返还剩余幸运并获得护盾",
        weight: 1,
        cooldown: 2,
        firstTurnAllowed: true,
        preventImmediateRepeat: true,
        requiresPositiveState: "stolenLuck",
        effects: Object.freeze([
          Object.freeze({
            type: "returnStolenLuck",
            stateField: "stolenLuck"
          }),
          Object.freeze({ type: "shieldSelf", value: 9 })
        ])
      })
    ]),
    intentRule: Object.freeze({
      type: "weighted_random",
      firstBehaviorId: "temporary_luck_theft",
      indicators: Object.freeze([
        Object.freeze({
          field: "stolenLuck",
          label: "暂存幸运",
          suffix: "点"
        })
      ]),
      fallbackBehaviorId: "temporary_luck_theft"
    })
  }),

  probabilityGambler: Object.freeze({
    id: "probability_gambler",
    name: "概率赌徒",
    description:
      "赌场里真正相信下一次一定能赢的人。下一次对此尚未表态。",
    intro: "你押你自己，我也押我自己。总得有一个人判断失误。",
    defeatText: "他要求再来一次，并声称上一局不具统计意义。",
    maxHp: 82,
    initialHp: 82,
    initialShield: 0,
    attack: 9,
    intentState: Object.freeze({
      gambleOutcome: "neutral",
      winStreak: 0
    }),
    behaviors: Object.freeze([
      Object.freeze({
        id: "toss_bet_coin",
        name: "投掷赌币",
        type: "special",
        description: "成功攻击玩家，失败则自身受伤",
        weight: 1,
        cooldown: 0,
        firstTurnAllowed: true,
        preventImmediateRepeat: false,
        effects: Object.freeze([
          Object.freeze({
            type: "enemyCoinToss",
            frontRate: 0.55,
            successDamage: 11,
            failureSelfDamage: 7,
            outcomeField: "gambleOutcome",
            streakField: "winStreak"
          })
        ])
      }),
      Object.freeze({
        id: "press_the_bet",
        name: "乘胜加注",
        type: "special",
        description: "连胜后进行更高风险的投掷",
        weight: 1,
        cooldown: 0,
        firstTurnAllowed: false,
        preventImmediateRepeat: false,
        effects: Object.freeze([
          Object.freeze({
            type: "enemyCoinToss",
            frontRate: 0.45,
            successDamage: 14,
            successDamagePerStreak: 3,
            failureSelfDamage: 10,
            failureDamagePerStreak: 2,
            outcomeField: "gambleOutcome",
            streakField: "winStreak"
          })
        ])
      }),
      Object.freeze({
        id: "settle_losses",
        name: "认赔清算",
        type: "defense",
        description: "结束连胜并获得护盾",
        weight: 1,
        cooldown: 0,
        firstTurnAllowed: false,
        preventImmediateRepeat: false,
        effects: Object.freeze([
          Object.freeze({ type: "shieldSelf", value: 10 }),
          Object.freeze({
            type: "setEnemyState",
            field: "gambleOutcome",
            value: "neutral",
            description: "清除连胜状态",
            message: "概率赌徒结束本轮下注"
          }),
          Object.freeze({
            type: "setEnemyState",
            field: "winStreak",
            value: 0,
            description: "连胜归零",
            message: "连胜记录归零"
          })
        ])
      })
    ]),
    intentRule: Object.freeze({
      type: "state_machine",
      indicators: Object.freeze([
        Object.freeze({
          field: "winStreak",
          label: "当前连胜",
          suffix: "次"
        })
      ]),
      stateField: "gambleOutcome",
      defaultState: "neutral",
      transitions: Object.freeze({
        neutral: "toss_bet_coin",
        win: "press_the_bet",
        loss: "settle_losses"
      }),
      fallbackBehaviorId: "toss_bet_coin"
    })
  }),

  ruleTamperer: Object.freeze({
    id: "rule_tamperer",
    name: "规则篡改者",
    description:
      "赌场的作弊荷官。她不改变结果，只负责解释为什么结果依然符合规则。",
    intro: "请放心，临时修改条款同样属于条款允许的范围。",
    defeatText: "她收起规则手册，声称这次只是排版事故。",
    maxHp: 115,
    initialHp: 115,
    initialShield: 0,
    attack: 12,
    intentState: Object.freeze({
      probabilityConvergenceActive: false,
      probabilityConvergenceFactor: 0.5,
      rerollReviewActive: false,
      lastPlayerSide: "back"
    }),
    behaviors: Object.freeze([
      Object.freeze({
        id: "rewrite_rules",
        name: "条款改写",
        type: "special",
        description: "下一回合的硬币概率向50%收拢",
        weight: 1,
        cooldown: 2,
        firstTurnAllowed: true,
        preventImmediateRepeat: true,
        effects: Object.freeze([
          Object.freeze({
            type: "activateProbabilityConvergence",
            factor: 0.5
          })
        ])
      }),
      Object.freeze({
        id: "second_review",
        name: "二次复核",
        type: "special",
        description: "下一回合首次投出正面时强制重投",
        weight: 1,
        cooldown: 2,
        firstTurnAllowed: true,
        preventImmediateRepeat: true,
        effects: Object.freeze([
          Object.freeze({ type: "enableRerollReview" })
        ])
      }),
      Object.freeze({
        id: "result_commission",
        name: "结果抽成",
        type: "special",
        description: "根据玩家本回合最终投掷结果获得优势",
        weight: 1,
        cooldown: 1,
        firstTurnAllowed: true,
        preventImmediateRepeat: true,
        effects: Object.freeze([
          Object.freeze({
            type: "resultTax",
            frontShield: 10,
            backDamage: 15
          })
        ])
      })
    ]),
    intentRule: Object.freeze({
      type: "weighted_random",
      firstBehaviorId: "rewrite_rules",
      indicators: Object.freeze([
        Object.freeze({
          field: "probabilityConvergenceActive",
          label: "概率条款",
          trueLabel: "已改写",
          falseLabel: "正常"
        }),
        Object.freeze({
          field: "rerollReviewActive",
          label: "复核权限",
          trueLabel: "已生效",
          falseLabel: "未生效"
        })
      ]),
      fallbackBehaviorId: "rewrite_rules"
    })
  }),

  casinoCreditor: Object.freeze({
    id: "casino_creditor",
    name: "赌场债主",
    description:
      "把生命、筹码和侥幸统一登记为可催收资产。账目从不出错，客户偶尔会。",
    intro: "没有筹码也可以谈。我们接受其他形式的流动资产。",
    defeatText: "债主撕掉账单，并将损失登记为客户失联。",
    maxHp: 135,
    initialHp: 135,
    initialShield: 0,
    attack: 10,
    intentState: Object.freeze({
      debt: 0
    }),
    behaviors: Object.freeze([
      Object.freeze({
        id: "high_interest_advance",
        name: "高息垫款",
        type: "special",
        description: "玩家选择接受筹码与债务，或拒绝交易",
        weight: 1,
        cooldown: 2,
        firstTurnAllowed: true,
        preventImmediateRepeat: true,
        requiresZeroState: "debt",
        effects: Object.freeze([
          Object.freeze({
            type: "offerLoan",
            chips: 15,
            debt: 2,
            rejectShield: 10
          })
        ])
      }),
      Object.freeze({
        id: "grace_period",
        name: "宽限期",
        type: "defense",
        description: "获得护盾，同时债务继续增长",
        weight: 1,
        cooldown: 1,
        firstTurnAllowed: true,
        preventImmediateRepeat: true,
        effects: Object.freeze([
          Object.freeze({ type: "shieldSelf", value: 12 }),
          Object.freeze({ type: "increaseDebt", value: 1 })
        ])
      }),
      Object.freeze({
        id: "debt_collection",
        name: "到期催收",
        type: "special",
        description: "玩家选择支付筹码或生命清偿债务",
        weight: 1,
        cooldown: 2,
        firstTurnAllowed: true,
        preventImmediateRepeat: true,
        requiresPositiveState: "debt",
        effects: Object.freeze([
          Object.freeze({
            type: "collectDebt",
            chipPerDebt: 8,
            hpPerDebt: 6
          })
        ])
      })
    ]),
    intentRule: Object.freeze({
      type: "weighted_random",
      firstBehaviorId: "high_interest_advance",
      indicators: Object.freeze([
        Object.freeze({
          field: "debt",
          label: "当前债务",
          suffix: "层"
        })
      ]),
      fallbackBehaviorId: "high_interest_advance"
    })
  }),

  probabilityDealer: Object.freeze({
    id: "probability_dealer",
    name: "概率庄家",
    description:
      "赌场外围的正式负责人。它认为五百万不是奖金，只是一笔尚未完成归因的概率事故。",
    intro: "你当然可以证明奖金属于你。赌场也当然可以修改证明标准。",
    defeatText: "庄家批准了你的奖金，并将审批原因填写为“系统暂时无法解释”。",
    maxHp: 165,
    initialHp: 165,
    initialShield: 0,
    attack: 12,
    intentState: Object.freeze({
      houseMechanicActive: false,
      houseSide: "back",
      houseEdge: 0,
      maxHouseEdge: 4,
      probabilityConvergenceActive: false,
      probabilityConvergenceFactor: 0.5
    }),
    behaviors: Object.freeze([
      Object.freeze({
        id: "announce_line",
        name: "宣布盘口",
        type: "special",
        description: "切换庄家面并获得护盾",
        weight: 1,
        cooldown: 2,
        firstTurnAllowed: true,
        preventImmediateRepeat: true,
        effects: Object.freeze([
          Object.freeze({ type: "toggleHouseSide" }),
          Object.freeze({ type: "shieldSelf", value: 9 })
        ])
      }),
      Object.freeze({
        id: "risk_hedge",
        name: "风险对冲",
        type: "special",
        description: "让下一回合的硬币概率向50%收拢",
        weight: 1,
        cooldown: 2,
        firstTurnAllowed: true,
        preventImmediateRepeat: true,
        effects: Object.freeze([
          Object.freeze({
            type: "activateProbabilityConvergence",
            factor: 0.5
          })
        ])
      }),
      Object.freeze({
        id: "standard_payout",
        name: "常规赔付",
        type: "attack",
        description: "进行一次可预测的常规攻击",
        weight: 1,
        cooldown: 1,
        firstTurnAllowed: true,
        preventImmediateRepeat: true,
        effects: Object.freeze([
          Object.freeze({ type: "damagePlayer", valueFrom: "attack" })
        ])
      }),
      Object.freeze({
        id: "profit_settlement",
        name: "盈利结算",
        type: "attack",
        description: "根据庄家优势发动攻击，然后清空优势",
        weight: 1,
        cooldown: 2,
        firstTurnAllowed: true,
        preventImmediateRepeat: true,
        requiresActiveState: "houseMechanicActive",
        effects: Object.freeze([
          Object.freeze({
            type: "settleHouseEdge",
            baseDamage: 9,
            damagePerEdge: 4,
            maxEdge: 4
          })
        ])
      })
    ]),
    intentRule: Object.freeze({
      type: "weighted_random",
      firstBehaviorId: "announce_line",
      indicators: Object.freeze([
        Object.freeze({
          field: "houseSide",
          label: "庄家面",
          values: Object.freeze({
            front: "正面",
            back: "反面"
          })
        }),
        Object.freeze({
          field: "houseEdge",
          label: "庄家优势",
          suffix: "层"
        }),
        Object.freeze({
          field: "probabilityConvergenceActive",
          label: "对冲条款",
          trueLabel: "已生效",
          falseLabel: "未生效"
        })
      ]),
      fallbackBehaviorId: "announce_line"
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
