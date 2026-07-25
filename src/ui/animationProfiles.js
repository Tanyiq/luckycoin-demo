export const coinAnimationProfiles = Object.freeze({
  meteor: Object.freeze({
    side: "front",
    theme: "meteor",
    headline: "陨星已获准进入室内",
    detail: "理论终于决定接受现场检验。"
  }),
  blood_pact: Object.freeze({
    side: "front",
    theme: "blood-pact",
    headline: "交易已经生效",
    detail: "赌场对以生命结算的客户一向非常信任。"
  })
})

export const specialAnimationProfiles = Object.freeze({
  revive: Object.freeze({
    priority: 100,
    theme: "revive",
    headline: "死亡申请复核中",
    detail: "逆命沙漏正在检查财务报表。"
  }),
  bossVictory: Object.freeze({
    priority: 90,
    theme: "boss-victory",
    headline: "赔率审查终止",
    detail: "首席赔率官将本次结果登记为个别案例。"
  }),
  combo: Object.freeze({
    priority: 80,
    theme: "combo",
    headline: "组合结果成立",
    detail: "多项概率在同一份表格上达成一致。"
  }),
  multiCoin: Object.freeze({
    priority: 70,
    theme: "multi",
    headline: "批量投掷结算",
    detail: "命运同意一次处理多份申请。"
  }),
  highImpact: Object.freeze({
    priority: 60
  }),
  improbable: Object.freeze({
    priority: 50,
    theme: "improbable",
    headline: "小概率事件已经发生",
    detail: "统计学家要求暂时离开现场。"
  })
})
