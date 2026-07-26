const typeNames = {
  attack: "攻击",
  defense: "防御",
  utility: "概率",
  recovery: "回复",
  risk: "风险",
  counter: "反击"
}

const rarityNames = {
  STARTER: "初始",
  COMMON: "普通",
  UNCOMMON: "罕见",
  RARE: "稀有",
  SPECIAL: "特殊"
}

export function formatLuck(value) {
  return `${value >= 0 ? "+" : ""}${value}`
}

export function formatRate(rate) {
  return `${Math.round(rate * 100)}%`
}

export function formatEffect(effect) {
  const formats = {
    damage: () => `造成 ${effect.value} 点伤害`,
    shield: () => `获得 ${effect.value} 点护盾`,
    changeLuck: () => `幸运${formatLuck(effect.value)}`,
    counter: () =>
      `获得 ${effect.shield} 护盾；受到攻击时反伤 ${effect.damage}`,
    conditionalDamage: () =>
      `造成 ${effect.value} 伤害；敌人有护盾时额外 ${effect.bonus}`,
    multiDamage: () =>
      `造成 ${effect.damagePerHit}×${effect.hits} 段伤害`,
    heal: () => `恢复 ${effect.value} 点生命`,
    damageAndHeal: () =>
      `造成 ${effect.damage} 伤害并恢复 ${effect.heal} 生命`,
    selfCostDamage: () =>
      `失去 ${effect.cost} 生命，造成 ${effect.damage} 伤害`,
    damageAndLuck: () =>
      `造成 ${effect.damage} 伤害，幸运${formatLuck(effect.luck)}`,
    luckDamage: () =>
      `造成 ${effect.baseDamage}×幸运倍率伤害`,
    shieldAndLuck: () =>
      `获得 ${effect.shield} 护盾，幸运${formatLuck(effect.luck)}`,
    shieldWithExistingBonus: () =>
      `获得 ${effect.shield} 护盾；已有护盾时额外 ${effect.bonus}`,
    reflectionShield: () =>
      `获得 ${effect.shield} 护盾；本回合按消耗护盾等额反伤`
  }
  return formats[effect.type]?.() ?? effect.type
}

export function hydrateCoin(instance, coinConfigs) {
  const config = coinConfigs[instance.coinId ?? instance.id]
  const level = instance.level ?? 1
  const levelConfig = config.levels?.[level]
  return {
    uid: instance.uid,
    id: config.id,
    name: config.name,
    type: config.type,
    typeName: typeNames[config.type] ?? config.type,
    rarity: config.rarity ?? "STARTER",
    rarityName: rarityNames[config.rarity ?? "STARTER"],
    level,
    consumable: config.consumable ?? false,
    flavor: config.flavor ?? "",
    frontRate: instance.finalFrontRate ?? config.frontRate,
    frontEffect:
      instance.frontEffect ??
      levelConfig?.frontEffect ??
      config.frontEffect,
    backEffect:
      instance.backEffect ??
      levelConfig?.backEffect ??
      config.backEffect,
    isUsable: instance.isUsable !== false
  }
}

export function presentRelics(relicIds, relicDefinitions) {
  return relicIds.map((id) => ({
    id,
    name: relicDefinitions[id]?.name ?? id,
    description: relicDefinitions[id]?.description ?? "",
    flavor: relicDefinitions[id]?.flavor ?? "",
    rarity: relicDefinitions[id]?.rarity ?? "COMMON",
    rarityName:
      rarityNames[relicDefinitions[id]?.rarity ?? "COMMON"]
  }))
}

export function presentMap(chapterConfig, chapterState, currentView) {
  return {
    chapterName: chapterConfig.name,
    currentNodeId: chapterState.currentNodeId,
    nodes: chapterConfig.nodes.map((node) => ({
      ...node,
      status: chapterState.nodeStates[node.id].status,
      isCurrent: node.id === chapterState.currentNodeId
    })),
    currentView
  }
}

export function presentBattle(state, relicDefinitions) {
  return {
    status: state.status,
    turn: state.turn,
    player: {
      ...state.player,
      luckText: formatLuck(state.player.luck),
      relics: presentRelics(state.player.relicIds, relicDefinitions)
    },
    enemy: {
      ...state.enemy,
      intent: state.enemy.currentIntent
        ? {
            ...state.enemy.currentIntent,
            description:
              state.enemy.currentIntent.description ??
              state.enemy.currentIntent.name
          }
        : null
    },
    coins: state.drawnCoins.map((coin) => ({
      ...hydrateCoin(
        { ...coin, coinId: coin.id },
        Object.fromEntries([[coin.id, coin]])
      ),
      frontRate: coin.finalFrontRate,
      frontEffect: coin.displayFrontEffect ?? coin.frontEffect,
      backEffect: coin.displayBackEffect ?? coin.backEffect
    })),
    logs: state.logs.slice(-8)
  }
}
