export const MetaTalentId = Object.freeze({
  FATE_BODY: "fate_body",
  STARTING_CAPITAL: "starting_capital",
  EXPANDED_VIEW: "expanded_view",
  GAMBLER_CUFF: "gambler_cuff",
  DEEP_TABLE: "deep_table",
  HOUSE_AUTHORITY: "house_authority"
})

export const metaTalentBranches = Object.freeze([
  Object.freeze({
    id: "survival",
    name: "命运之躯",
    description: "提高容错，但不替你赢下任何一次投掷。",
    nodes: Object.freeze([MetaTalentId.FATE_BODY])
  }),
  Object.freeze({
    id: "economy",
    name: "启动资金",
    description: "让你更早参与交易，赌场对此称为培养消费习惯。",
    nodes: Object.freeze([MetaTalentId.STARTING_CAPITAL])
  }),
  Object.freeze({
    id: "collection",
    name: "赌徒收藏",
    description: "专属硬币、遗物与事件将在后续版本进入独立解锁池。",
    comingSoon: true,
    nodes: Object.freeze([])
  }),
  Object.freeze({
    id: "expansion",
    name: "命运扩张",
    description: "取得观察、追加下注和庄家级操作权限。",
    nodes: Object.freeze([
      MetaTalentId.EXPANDED_VIEW,
      MetaTalentId.GAMBLER_CUFF,
      MetaTalentId.DEEP_TABLE,
      MetaTalentId.HOUSE_AUTHORITY
    ])
  })
])

export const metaTalents = Object.freeze({
  [MetaTalentId.FATE_BODY]: Object.freeze({
    id: MetaTalentId.FATE_BODY,
    branchId: "survival",
    name: "命运之躯",
    description: "每级使新Run的初始最大生命增加2点。",
    maxRank: 10,
    costs: Object.freeze([1, 1, 1, 1, 1, 2, 2, 2, 3, 3])
  }),
  [MetaTalentId.STARTING_CAPITAL]: Object.freeze({
    id: MetaTalentId.STARTING_CAPITAL,
    branchId: "economy",
    name: "启动资金",
    description: "每级使新Run的初始筹码增加5点。",
    maxRank: 10,
    costs: Object.freeze([1, 1, 1, 1, 1, 2, 2, 2, 3, 3])
  }),
  [MetaTalentId.EXPANDED_VIEW]: Object.freeze({
    id: MetaTalentId.EXPANDED_VIEW,
    branchId: "expansion",
    name: "额外观察",
    description: "每回合展示的硬币数量由2枚增加至3枚。",
    maxRank: 1,
    costs: Object.freeze([6]),
    requirements: Object.freeze({
      tutorialCompleted: true,
      chapterVictories: Object.freeze({ chapter_1: 1 })
    })
  }),
  [MetaTalentId.GAMBLER_CUFF]: Object.freeze({
    id: MetaTalentId.GAMBLER_CUFF,
    branchId: "expansion",
    name: "赌徒袖口",
    description: "解锁遗物“赌徒袖口”，每场战斗第4、8、12……次选择可以追加下注。",
    maxRank: 1,
    costs: Object.freeze([8]),
    prerequisites: Object.freeze([MetaTalentId.EXPANDED_VIEW]),
    requirements: Object.freeze({
      chapterVictories: Object.freeze({ chapter_1: 2 })
    })
  }),
  [MetaTalentId.DEEP_TABLE]: Object.freeze({
    id: MetaTalentId.DEEP_TABLE,
    branchId: "expansion",
    name: "高额赌桌",
    description: "第二章及之后，每回合永久展示4枚硬币。",
    maxRank: 1,
    costs: Object.freeze([12]),
    prerequisites: Object.freeze([MetaTalentId.GAMBLER_CUFF]),
    requirements: Object.freeze({
      highestChapter: 2
    })
  }),
  [MetaTalentId.HOUSE_AUTHORITY]: Object.freeze({
    id: MetaTalentId.HOUSE_AUTHORITY,
    branchId: "expansion",
    name: "庄家权限",
    description: "Boss战第6、12、18……次选择可以追加下注。",
    maxRank: 1,
    costs: Object.freeze([16]),
    prerequisites: Object.freeze([MetaTalentId.DEEP_TABLE]),
    requirements: Object.freeze({
      chapterVictories: Object.freeze({ chapter_2: 1 })
    })
  })
})

export const bossFragmentRewards = Object.freeze({
  chapter_0: 1,
  chapter_1: 2,
  chapter_2: 3
})

