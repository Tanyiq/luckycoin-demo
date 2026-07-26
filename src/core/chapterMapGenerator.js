import { NodeType } from "../data/chapters.js"
import { enemyPools } from "../data/enemyPools.js"
import { eventPools } from "../data/events.js"

function drawUnique(pool, count, random) {
  const available = [...pool]
  const result = []
  while (result.length < count && available.length > 0) {
    const index = Math.floor(random() * available.length)
    result.push(available.splice(index, 1)[0])
  }
  if (result.length !== count) {
    throw new Error("随机地图池内容不足")
  }
  return result
}

function shuffle(items, random) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [
      result[target],
      result[index]
    ]
  }
  return result
}

function battleNode({
  id,
  order,
  type,
  enemyId,
  title,
  description
}) {
  return {
    id,
    order,
    type,
    title,
    description,
    enemyId,
    rewardConfigId: enemyId,
    nextNodeIds: []
  }
}

export function createChapter1Config({ random = Math.random } = {}) {
  const normalEnemies = drawUnique(
    enemyPools.chapter1Normal,
    2,
    random
  )
  const eliteCount = random() < 0.5 ? 1 : 2
  const eventCount = 3 - eliteCount
  const eliteEnemies = drawUnique(
    enemyPools.chapter1Elite,
    eliteCount,
    random
  )
  const eventIds = drawUnique(eventPools.common, eventCount, random)
  const middleNodes = shuffle(
    [
      ...eliteEnemies.map((enemyId) => ({
        type: NodeType.ELITE_BATTLE,
        enemyId
      })),
      ...eventIds.map((eventId) => ({
        type: NodeType.EVENT,
        eventId
      }))
    ],
    random
  )

  const nodes = [
    battleNode({
      id: "chapter_1_node_1",
      order: 1,
      type: NodeType.NORMAL_BATTLE,
      title: "外围问询",
      description: "赌场先派一位基层员工确认你的好运是否会反抗。",
      enemyId: normalEnemies[0]
    }),
    battleNode({
      id: "chapter_1_node_2",
      order: 2,
      type: NodeType.NORMAL_BATTLE,
      title: "来源复核",
      description: "第二份问询与第一份完全相同，只是结论可能更贵。",
      enemyId: normalEnemies[1]
    }),
    ...middleNodes.map((node, index) => ({
      id: `chapter_1_node_${index + 3}`,
      order: index + 3,
      type: node.type,
      title:
        node.type === NodeType.ELITE_BATTLE
          ? "重点审查"
          : "概率营业窗口",
      description:
        node.type === NodeType.ELITE_BATTLE
          ? "你的中奖记录已被标红，工作人员因此获得了更多权限。"
          : "持证经营的概率业务。所有风险都会提前写在较小的字里。",
      ...(node.enemyId
        ? {
            enemyId: node.enemyId,
            rewardConfigId: node.enemyId
          }
        : { eventId: node.eventId }),
      nextNodeIds: []
    })),
    {
      id: "chapter_1_node_6",
      order: 6,
      type: NodeType.SHOP,
      title: "外围结算处",
      description: "庄家允许你在正式审计前购买一点主观上的准备。",
      shopId: "chapter_1_shop",
      nextNodeIds: []
    },
    battleNode({
      id: "chapter_1_node_7",
      order: 7,
      type: NodeType.BOSS_BATTLE,
      title: "庄家审计室",
      description: "概率庄家将在这里判断：五百万究竟属于你，还是属于统计误差。",
      enemyId: "probabilityDealer"
    })
  ]
  nodes.forEach((node, index) => {
    node.nextNodeIds =
      index < nodes.length - 1 ? [nodes[index + 1].id] : []
  })

  return {
    id: "chapter_1",
    name: "赌场外围",
    subtitle: "幸运来源复核",
    firstNodeId: nodes[0].id,
    generated: true,
    nodes
  }
}
