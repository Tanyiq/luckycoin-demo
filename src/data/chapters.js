export const NodeType = Object.freeze({
  NORMAL_BATTLE: "NORMAL_BATTLE",
  ELITE_BATTLE: "ELITE_BATTLE",
  BOSS_BATTLE: "BOSS_BATTLE",
  EVENT: "EVENT",
  SHOP: "SHOP"
})

export const chapters = Object.freeze({
  chapter0: Object.freeze({
    id: "chapter_0",
    name: "入场须知",
    firstNodeId: "chapter_0_normal_1",
    nodes: Object.freeze([
      Object.freeze({
        id: "chapter_0_normal_1",
        order: 1,
        type: NodeType.NORMAL_BATTLE,
        title: "新客培训",
        enemyId: "trainingDummy",
        rewardConfigId: "trainingDummy",
        nextNodeIds: Object.freeze(["chapter_0_normal_2"])
      }),
      Object.freeze({
        id: "chapter_0_normal_2",
        order: 2,
        type: NodeType.NORMAL_BATTLE,
        title: "失窃概率",
        enemyId: "fireThief",
        rewardConfigId: "fireThief",
        nextNodeIds: Object.freeze(["chapter_0_event_1"])
      }),
      Object.freeze({
        id: "chapter_0_event_1",
        order: 3,
        type: NodeType.EVENT,
        title: "经审计的奇迹",
        eventId: "fate_spring",
        nextNodeIds: Object.freeze(["chapter_0_elite_1"])
      }),
      Object.freeze({
        id: "chapter_0_elite_1",
        order: 4,
        type: NodeType.ELITE_BATTLE,
        title: "欠款保全区",
        enemyId: "armorBeast",
        rewardConfigId: "armorBeast",
        nextNodeIds: Object.freeze(["chapter_0_shop_1"])
      }),
      Object.freeze({
        id: "chapter_0_shop_1",
        order: 5,
        type: NodeType.SHOP,
        title: "概率结算处",
        shopId: "chapter_0_basic_shop",
        nextNodeIds: Object.freeze(["chapter_0_boss"])
      }),
      Object.freeze({
        id: "chapter_0_boss",
        order: 6,
        type: NodeType.BOSS_BATTLE,
        title: "赔率办公室",
        enemyId: "fateDevourer",
        rewardConfigId: "fateDevourer",
        nextNodeIds: Object.freeze([])
      })
    ])
  })
})
