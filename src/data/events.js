export const eventPools = Object.freeze({
  common: Object.freeze([
    "odds_counter",
    "luck_notary",
    "coin_refurbisher",
    "accident_claims",
    "lost_coin_auction"
  ])
})

export const events = Object.freeze({
  oddsCounter: Object.freeze({
    id: "odds_counter",
    name: "赔率兑换台",
    title: "今日汇率由昨日损失决定",
    description: Object.freeze([
      "柜员表示筹码与勇气可以自由兑换。",
      "至于兑换比例，只在交易完成后公开。"
    ]),
    options: Object.freeze([
      Object.freeze({
        id: "take_fixed",
        name: "接受固定返还",
        description: "获得18筹码",
        effects: Object.freeze([
          Object.freeze({ type: "changeChips", value: 18 })
        ])
      }),
      Object.freeze({
        id: "double_down",
        name: "押注浮动返还",
        description: "支付15筹码；55%获得60筹码，否则筹码不退",
        requirements: Object.freeze({ minChips: 15 }),
        effects: Object.freeze([
          Object.freeze({ type: "changeChips", value: -15 }),
          Object.freeze({
            type: "randomOutcome",
            frontRate: 0.55,
            frontEffects: Object.freeze([
              Object.freeze({ type: "changeChips", value: 60 })
            ]),
            backEffects: Object.freeze([])
          })
        ])
      })
    ])
  }),

  luckNotary: Object.freeze({
    id: "luck_notary",
    name: "幸运公证处",
    title: "好运需要证明，坏运只需要签字",
    description: Object.freeze([
      "公证员可以证明你的运气确实存在。",
      "证明本身不免费，出售证据倒是可以获得补贴。"
    ]),
    options: Object.freeze([
      Object.freeze({
        id: "sell_luck",
        name: "出售好运证明",
        description: "幸运-2，获得35筹码",
        requirements: Object.freeze({ luckAbove: -9 }),
        effects: Object.freeze([
          Object.freeze({ type: "changeLuck", value: -2 }),
          Object.freeze({ type: "changeChips", value: 35 })
        ])
      }),
      Object.freeze({
        id: "buy_luck_small",
        name: "购买基础好运认证",
        description: "支付50筹码，幸运+1",
        requirements: Object.freeze({
          minChips: 50,
          luckBelow: 10
        }),
        effects: Object.freeze([
          Object.freeze({ type: "changeChips", value: -50 }),
          Object.freeze({ type: "changeLuck", value: 1 })
        ])
      }),
      Object.freeze({
        id: "buy_luck_large",
        name: "购买高级好运认证",
        description: "支付120筹码，幸运+2",
        requirements: Object.freeze({
          minChips: 120,
          luckBelow: 9
        }),
        effects: Object.freeze([
          Object.freeze({ type: "changeChips", value: -120 }),
          Object.freeze({ type: "changeLuck", value: 2 })
        ])
      })
    ])
  }),

  coinRefurbisher: Object.freeze({
    id: "coin_refurbisher",
    name: "硬币翻新柜",
    title: "磨损的是表面，收费的是命运",
    description: Object.freeze([
      "柜台承诺不会改变硬币的本质。",
      "他们只会把本质擦得更昂贵一些。"
    ]),
    options: Object.freeze([
      Object.freeze({
        id: "certified_upgrade",
        name: "认证强化",
        description: "支付35筹码，选择并强化一枚硬币",
        requirements: Object.freeze({
          minChips: 35,
          hasUpgradeableCoin: true
        }),
        targetEffect: Object.freeze({
          type: "upgradeCoin",
          chipCost: 35,
          successRate: 1
        })
      }),
      Object.freeze({
        id: "uncertified_upgrade",
        name: "无证翻新",
        description: "支付15筹码，选择一枚硬币；50%强化成功",
        requirements: Object.freeze({
          minChips: 15,
          hasUpgradeableCoin: true
        }),
        targetEffect: Object.freeze({
          type: "upgradeCoin",
          chipCost: 15,
          successRate: 0.5
        })
      })
    ])
  }),

  accidentClaims: Object.freeze({
    id: "accident_claims",
    name: "事故赔付窗",
    title: "如果概率伤害了你，请先证明那不是自愿",
    description: Object.freeze([
      "窗口愿意受理你的概率事故。",
      "审核失败产生的新事故不在赔付范围内。"
    ]),
    options: Object.freeze([
      Object.freeze({
        id: "file_claim",
        name: "提交高额索赔",
        description: "50%获得60筹码，否则失去12生命",
        requirements: Object.freeze({ hpAbove: 12 }),
        effects: Object.freeze([
          Object.freeze({
            type: "randomOutcome",
            frontRate: 0.5,
            frontEffects: Object.freeze([
              Object.freeze({ type: "changeChips", value: 60 })
            ]),
            backEffects: Object.freeze([
              Object.freeze({ type: "changeHp", value: -12 })
            ])
          })
        ])
      }),
      Object.freeze({
        id: "quiet_settlement",
        name: "接受庭外和解",
        description: "获得15筹码，幸运-1",
        effects: Object.freeze([
          Object.freeze({ type: "changeChips", value: 15 }),
          Object.freeze({ type: "changeLuck", value: -1 })
        ])
      })
    ])
  }),

  lostCoinAuction: Object.freeze({
    id: "lost_coin_auction",
    name: "无主硬币拍卖",
    title: "失主已经放弃寻找，主要因为失主也失踪了",
    description: Object.freeze([
      "拍卖师保证每枚硬币都有来历。",
      "至于来历是否合法，需要额外购买报告。"
    ]),
    options: Object.freeze([
      Object.freeze({
        id: "sealed_bid",
        name: "竞拍密封藏品",
        description: "支付40筹码，获得一枚随机硬币",
        requirements: Object.freeze({ minChips: 40 }),
        effects: Object.freeze([
          Object.freeze({ type: "changeChips", value: -40 }),
          Object.freeze({
            type: "acquireRandomCoin",
            coinPoolId: "expanded"
          })
        ])
      }),
      Object.freeze({
        id: "cheap_lot",
        name: "购买无人出价的拍品",
        description: "支付20筹码，从基础硬币中随机获得一枚",
        requirements: Object.freeze({ minChips: 20 }),
        effects: Object.freeze([
          Object.freeze({ type: "changeChips", value: -20 }),
          Object.freeze({
            type: "acquireRandomCoin",
            coinPoolId: "chapter1Basic"
          })
        ])
      })
    ])
  })
})
