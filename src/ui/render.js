import {
  formatEffect,
  formatLuck,
  formatRate,
  hydrateCoin,
  presentBattle,
  presentMap,
  presentRelics
} from "./presenters.js"
import { Screen } from "./gameSession.js"

const nodeMeta = {
  NORMAL_BATTLE: { icon: "♠", label: "普通战斗" },
  ELITE_BATTLE: { icon: "◆", label: "精英战斗" },
  BOSS_BATTLE: { icon: "♛", label: "Boss战" },
  EVENT: { icon: "✦", label: "事件" },
  SHOP: { icon: "♣", label: "商店" }
}

const damageEffectTypes = new Set([
  "damage",
  "conditionalDamage",
  "multiDamage",
  "damageAndHeal",
  "selfCostDamage",
  "damageAndLuck",
  "luckDamage"
])

const shieldEffectTypes = new Set([
  "shield",
  "shieldWithExistingBonus",
  "reflectionShield",
  "counter",
  "shieldAndLuck"
])

const healEffectTypes = new Set(["heal", "damageAndHeal"])

const importantStepTypes = new Set([
  "PLAYER_EFFECT",
  "ENEMY_EFFECT",
  "RELIC_TRIGGERED",
  "COUNTER_TRIGGERED",
  "BATTLE_RESULT"
])

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

export function renderTutorial(tutorial) {
  const hint = tutorial?.activeHint
  if (!hint) {
    return ""
  }
  return `
    <aside class="tutorial-hint anchor-${hint.anchor}" role="status"
      aria-label="首次提示" data-hint-id="${escapeHtml(hint.id)}">
      <span class="tutorial-mark">?</span>
      <div>
        <small>首次提示</small>
        <strong>${escapeHtml(hint.title)}</strong>
        <p>${escapeHtml(hint.message)}</p>
        ${
          hint.detail
            ? `<em>${escapeHtml(hint.detail)}</em>`
            : ""
        }
      </div>
      <button type="button" data-action="dismiss-tutorial"
        aria-label="关闭提示">知道了</button>
    </aside>
  `
}

function playerHeader(player, relicDefinitions, options = {}) {
  const relicList = presentRelics(player.relicIds, relicDefinitions)
  return `
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark">◉</span>
        <div>
          <span class="eyebrow">命运赌场 · 概率审查中</span>
          <strong>命运硬币</strong>
        </div>
      </div>
      <div class="run-stats" aria-label="玩家状态">
        <span><b>${player.hp}</b>/${player.maxHp} HP</span>
        <span>幸运 <b>${formatLuck(player.luck)}</b></span>
        <span>筹码 <b>${player.chips}</b></span>
        <span>硬币 <b>${player.coins.length}</b></span>
        <span>遗物 <b>${relicList.length}</b></span>
        <button class="build-button" data-action="open-build"
          ${options.disabled ? "disabled" : ""}>
          查看构筑 <b>${player.coins.length}</b> / <b>${relicList.length}</b>
        </button>
        <button class="build-button resource-button"
          data-action="open-resources">资源</button>
      </div>
    </header>
  `
}

function pageShell(snapshot, content, options = {}) {
  const headerPlayer =
    snapshot.screen === Screen.BATTLE && snapshot.battleState
      ? {
          ...snapshot.player,
          hp:
            snapshot.animation?.activeStep.displayState.player.hp ??
            snapshot.battleState.player.hp,
          maxHp:
            snapshot.animation?.activeStep.displayState.player.maxHp ??
            snapshot.battleState.player.maxHp,
          luck:
            snapshot.animation?.activeStep.displayState.player.luck ??
            snapshot.battleState.player.luck,
          relicIds:
            snapshot.animation?.activeStep.displayState.player.relicIds ??
            snapshot.battleState.player.relicIds
        }
      : snapshot.player
  return `
    <div class="app-shell">
      ${playerHeader(headerPlayer, snapshot.configs.relics, {
        disabled: snapshot.busy
      })}
      <main class="game-stage ${options.stageClass ?? ""}">
        ${content}
      </main>
      ${
        snapshot.message
          ? `<div class="toast" role="status">${escapeHtml(snapshot.message)}</div>`
          : ""
      }
      ${snapshot.buildOpen ? buildDrawer(snapshot) : ""}
      ${
        snapshot.resourceInspector?.open
          ? resourceInspector(snapshot)
          : ""
      }
    </div>
  `
}

function healthBar(current, max, tone = "player") {
  const width = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0
  return `
    <div class="health-track" aria-label="生命 ${current}/${max}">
      <div class="health-fill ${tone}" style="width:${width}%"></div>
      <span>${current} / ${max}</span>
    </div>
  `
}

function relicChips(relicList) {
  if (relicList.length === 0) {
    return `<span class="empty-note">暂无遗物</span>`
  }
  return relicList
    .map(
      (relic) => `
        <button class="relic-chip rarity-${relic.rarity.toLowerCase()}" type="button"
          title="${escapeHtml(relic.description)}">
          ${escapeHtml(relic.name)}
        </button>
      `
    )
    .join("")
}

function mapScreen(snapshot) {
  const map = presentMap(
    snapshot.chapterConfig,
    snapshot.chapterState,
    snapshot.currentNodeView
  )
  const current = map.currentView
  const nodes = map.nodes
    .map((node, index) => {
      const meta = nodeMeta[node.type]
      const enemy = node.enemyId
        ? snapshot.configs.enemies[node.enemyId]
        : null
      return `
        <li class="map-step">
          <article class="map-node status-${node.status.toLowerCase()}
            ${node.isCurrent ? "is-current" : ""}">
            <div class="node-symbol">${meta.icon}</div>
            <div class="node-copy">
              <span>${meta.label}</span>
              <strong>${escapeHtml(node.title)}</strong>
              ${
                enemy
                  ? `<small>即将面对：${escapeHtml(enemy.name)}</small>`
                  : ""
              }
            </div>
            <div class="node-state">
              ${
                node.status === "COMPLETED"
                  ? "已完成"
                  : node.status === "AVAILABLE"
                    ? "可进入"
                    : node.status === "IN_PROGRESS"
                      ? "进行中"
                      : "未解锁"
              }
            </div>
          </article>
          ${index < map.nodes.length - 1 ? `<div class="map-link"></div>` : ""}
        </li>
      `
    })
    .join("")

  return pageShell(
    snapshot,
    `
      <section class="map-layout">
        <div class="map-copy">
          <span class="eyebrow">CHAPTER 0</span>
          <h1>${escapeHtml(map.chapterName)}</h1>
          <p class="lead">
            你只是刮中了五百万。概率世界认为这件事值得一次正式审查。
          </p>
          <div class="current-node-card">
            <span>当前安排</span>
            <h2>${escapeHtml(current.title)}</h2>
            ${
              current.enemy
                ? `<p>${escapeHtml(current.enemy.description)}</p>`
                : `<p>该节点不会主动攻击你。至少合同上如此。</p>`
            }
            <div class="current-stats">
              <span>HP ${current.player.hp}/${current.player.maxHp}</span>
              <span>幸运 ${formatLuck(current.player.luck)}</span>
              <span>${current.player.coinCount} 枚硬币</span>
            </div>
            <button class="primary-button" data-action="enter-node">
              进入${nodeMeta[
                snapshot.chapterConfig.nodes.find(
                  (node) => node.id === current.id
                ).type
              ].label}
              <span>→</span>
            </button>
          </div>
          ${
            snapshot.chapterState.completedNodeIds.length === 0
              ? `
                <details class="story-note">
                  <summary>查看入场经过</summary>
                  ${snapshot.narrative.chapter0Intro
                    .map((line) => `<p>${escapeHtml(line)}</p>`)
                    .join("")}
                </details>
              `
              : ""
          }
        </div>
        <ol class="chapter-path">${nodes}</ol>
      </section>
    `,
    { stageClass: "map-stage" }
  )
}

function coinCard(coin, action, value, options = {}) {
  const result = options.result
  const resultClass = result
    ? `is-revealed result-${result.side} ${options.animate ? "is-resolving" : ""}`
    : ""
  return `
    <button
      class="coin-card type-${coin.type} rarity-${coin.rarity.toLowerCase()}
        ${resultClass} ${options.selected ? "is-selected" : ""}
        ${options.muted ? "is-muted" : ""}"
      data-action="${action}"
      data-value="${escapeHtml(value)}"
      style="--result-delay:${(result?.order ?? 0) * 60}ms"
      ${coin.isUsable === false || options.disabled ? "disabled" : ""}
    >
      <div class="coin-orbit">
        <div class="coin-disc">
          <span class="token-face token-front">${escapeHtml(coin.name.slice(0, 1))}</span>
          <span class="token-face token-back">反</span>
        </div>
      </div>
      <div class="coin-title">
        <span>${escapeHtml(coin.typeName)}</span>
        <strong>${escapeHtml(coin.name)}</strong>
        <small>Lv.${coin.level}${coin.consumable ? " · 一次性" : ""}</small>
      </div>
      <div class="coin-rate">
        <span>当前正面概率</span>
        <strong>${formatRate(coin.frontRate)}</strong>
      </div>
      <div class="face-effect front">
        <b>正面</b>
        <span>${escapeHtml(formatEffect(coin.frontEffect))}</span>
      </div>
      <div class="face-effect back">
        <b>反面</b>
        <span>${escapeHtml(formatEffect(coin.backEffect))}</span>
      </div>
      ${
        coin.flavor
          ? `<p class="flavor">${escapeHtml(coin.flavor)}</p>`
          : ""
      }
      ${
        result
          ? `
            <div class="inline-result ${result.side}">
              <strong>${result.side === "front" ? "正面" : "反面"}</strong>
              <span>${escapeHtml(formatEffect(result.effect))}</span>
            </div>
          `
          : ""
      }
    </button>
  `
}

function intentCard(intent) {
  if (!intent) {
    return `<div class="intent-card neutral">等待下一项裁定</div>`
  }
  const kind =
    intent.type === "attack"
      ? "attack"
      : intent.type === "defense"
        ? "defense"
        : "special"
  return `
    <div class="intent-card ${kind}">
      <span>下一步行为</span>
      <strong>${escapeHtml(intent.name)}</strong>
      <p>${escapeHtml(intent.description)}</p>
    </div>
  `
}

function battleScreen(snapshot) {
  const displayState =
    snapshot.animation?.activeStep.displayState ??
    snapshot.battleState
  const battle = presentBattle(
    displayState,
    snapshot.configs.relics
  )
  const revealedUids = new Set(
    snapshot.animation?.activeStep.revealedCoinUids ?? []
  )
  const allResults = snapshot.animation?.results ?? []
  const resultByUid = new Map(
    allResults
      .filter((result) => revealedUids.has(result.coinUid))
      .map((result) => [result.coinUid, result])
  )
  const resolvingUids = new Set(
    allResults.map((result) => result.coinUid)
  )
  const enemyActing = [
    "ENEMY_INTENT_START",
    "ENEMY_EFFECT"
  ].includes(snapshot.animation?.activeStep.type)
  const activeStep = snapshot.animation?.activeStep
  const playerHit =
    activeStep?.type === "ENEMY_EFFECT" &&
    activeStep.effect?.type === "damagePlayer"
  const enemyHit =
    (activeStep?.type === "PLAYER_EFFECT" &&
      damageEffectTypes.has(activeStep.effect?.type)) ||
    activeStep?.type === "COUNTER_TRIGGERED"
  const playerShield =
    activeStep?.type === "PLAYER_EFFECT" &&
    shieldEffectTypes.has(activeStep.effect?.type)
  const enemyShield =
    activeStep?.type === "ENEMY_EFFECT" &&
    activeStep.effect?.type === "shieldSelf"
  const playerHealing =
    activeStep?.type === "PLAYER_EFFECT" &&
    healEffectTypes.has(activeStep.effect?.type)
  return pageShell(
    snapshot,
    `
      <section class="battle-layout">
        <div class="battle-heading">
          <div>
            <span class="eyebrow">ROUND ${battle.turn}</span>
            <h1>概率正在处理双方申请</h1>
          </div>
          <span class="turn-pill">第 ${battle.turn} 回合</span>
        </div>

        <div class="combatants">
          <article class="combatant player-panel
            ${playerHit ? "is-hit" : ""}
            ${playerShield ? "has-shield-fx" : ""}
            ${playerHealing ? "is-healing" : ""}">
            <div class="combatant-heading">
              <div>
                <span>申请人</span>
                <h2>${escapeHtml(battle.player.name)}</h2>
              </div>
              <div class="luck-orb ${battle.player.luck < 0 ? "negative" : ""}">
                <small>幸运</small>
                <strong>${battle.player.luckText}</strong>
              </div>
            </div>
            ${healthBar(battle.player.hp, battle.player.maxHp, "player")}
            <div class="resource-row">
              <span>护盾 <b>${battle.player.shield}</b></span>
              <span>反击准备 <b>${battle.player.counterCharges}</b></span>
            </div>
            <div class="relic-row">
              ${relicChips(battle.player.relics)}
            </div>
          </article>

          <div class="versus">VS</div>

          <article class="combatant enemy-panel
            ${enemyActing ? "is-acting" : ""}
            ${enemyHit ? "is-hit" : ""}
            ${enemyShield ? "has-shield-fx" : ""}">
            <div class="combatant-heading">
              <div>
                <span>概率工作人员</span>
                <h2>${escapeHtml(battle.enemy.name)}</h2>
              </div>
              <div class="enemy-seal">赔率<br />有效</div>
            </div>
            ${healthBar(battle.enemy.hp, battle.enemy.maxHp, "enemy")}
            <div class="resource-row">
              <span>护盾 <b>${battle.enemy.shield}</b></span>
              <span>攻击修正 <b>+${battle.enemy.attackBonus ?? 0}</b></span>
            </div>
            ${intentCard(battle.enemy.intent)}
          </article>
          ${battleEffectAnimation(activeStep)}
        </div>

        <section class="coin-tray">
          <div class="section-heading">
            <div>
              <span class="eyebrow">本回合抽取结果</span>
              <h2>请选择最多 ${snapshot.battleState.maxCoinsPerTurn} 枚</h2>
            </div>
            <p>概率已经包含当前幸运修正。</p>
          </div>
          <div class="coin-grid">
            ${battle.coins
              .map((coin) =>
                coinCard(coin, "play-coin", coin.uid, {
                  disabled: snapshot.busy,
                  result: resultByUid.get(coin.uid),
                  animate:
                    snapshot.animation?.activeStep.type ===
                      "COIN_TOSSED" &&
                    snapshot.animation.activeStep.coinUid ===
                      coin.uid,
                  selected: resolvingUids.has(coin.uid),
                  muted:
                    snapshot.busy && !resolvingUids.has(coin.uid)
                })
              )
              .join("")}
          </div>
          ${
            snapshot.animation
              ? actionTrack(snapshot.animation)
              : ""
          }
        </section>

        <details class="battle-log">
          <summary>完整战斗记录 <span>${snapshot.battleState.logs.length} 条</span></summary>
          <div>
            ${battle.logs
              .map((log) => `<p>${escapeHtml(log)}</p>`)
              .join("")}
          </div>
        </details>
      </section>
      ${
        snapshot.animation?.activeStep.special
          ? specialEffectLayer(snapshot.animation)
          : ""
      }
    `,
    { stageClass: "battle-stage" }
  )
}

function actionTrack(animation) {
  let feedbackIndex = -1
  for (let index = 0; index <= animation.activeStepIndex; index += 1) {
    if (importantStepTypes.has(animation.steps[index].type)) {
      feedbackIndex = index
    }
  }
  if (feedbackIndex === -1) {
    return ""
  }
  const step = animation.steps[feedbackIndex]
  const previousStep =
    animation.steps[feedbackIndex - 1] ??
    animation.steps[0]
  const before = previousStep.displayState
  const after = step.displayState
  const deltas = [
    after.enemy.hp !== before.enemy.hp
      ? `<span class="damage">敌人 ${after.enemy.hp - before.enemy.hp} HP</span>`
      : "",
    after.player.hp !== before.player.hp
      ? `<span class="${after.player.hp < before.player.hp ? "damage" : "heal"}">玩家 ${after.player.hp - before.player.hp > 0 ? "+" : ""}${after.player.hp - before.player.hp} HP</span>`
      : "",
    after.player.shield !== before.player.shield
      ? `<span class="shield">护盾 ${after.player.shield - before.player.shield > 0 ? "+" : ""}${after.player.shield - before.player.shield}</span>`
      : "",
    after.enemy.shield !== before.enemy.shield
      ? `<span class="shield">敌方护盾 ${after.enemy.shield - before.enemy.shield > 0 ? "+" : ""}${after.enemy.shield - before.enemy.shield}</span>`
      : "",
    after.player.luck !== before.player.luck
      ? `<span class="luck">幸运 ${after.player.luck - before.player.luck > 0 ? "+" : ""}${after.player.luck - before.player.luck}</span>`
      : ""
  ].filter(Boolean)
  return `
    <div class="action-track ${
      feedbackIndex === animation.activeStepIndex ? "is-current" : "is-lingering"
    }" role="status">
      <div class="action-current type-${step.type.toLowerCase()}">
        <div>
          <small>关键变化</small>
          <strong>${escapeHtml(step.title)}</strong>
        </div>
        <div class="action-deltas">${deltas.join("")}</div>
        <div class="action-messages">
          ${step.messages
          .slice(0, 3)
          .map((message) => `<span>${escapeHtml(message)}</span>`)
          .join("")}
        </div>
      </div>
    </div>
  `
}

function battleEffectAnimation(step) {
  if (!step) {
    return ""
  }
  if (
    step.type === "PLAYER_EFFECT" &&
    step.effect?.type === "damageAndHeal"
  ) {
    return `
      <div class="battle-fx projectile-fx to-enemy" aria-hidden="true">
        <i></i>
      </div>
      <div class="battle-fx heal-fx on-player" aria-hidden="true">
        <i></i><i></i><i></i>
      </div>
    `
  }
  if (
    step.type === "PLAYER_EFFECT" &&
    damageEffectTypes.has(step.effect?.type)
  ) {
    return `
      <div class="battle-fx projectile-fx to-enemy" aria-hidden="true">
        <i></i>
      </div>
    `
  }
  if (
    step.type === "ENEMY_EFFECT" &&
    step.effect?.type === "damagePlayer"
  ) {
    return `
      <div class="battle-fx projectile-fx to-player" aria-hidden="true">
        <i></i>
      </div>
    `
  }
  if (step.type === "COUNTER_TRIGGERED") {
    return `
      <div class="battle-fx counter-fx" aria-hidden="true">
        <i></i><span>反</span>
      </div>
    `
  }
  if (
    step.type === "PLAYER_EFFECT" &&
    shieldEffectTypes.has(step.effect?.type)
  ) {
    return `<div class="battle-fx shield-fx on-player" aria-hidden="true"></div>`
  }
  if (
    step.type === "ENEMY_EFFECT" &&
    step.effect?.type === "shieldSelf"
  ) {
    return `<div class="battle-fx shield-fx on-enemy" aria-hidden="true"></div>`
  }
  if (
    step.type === "PLAYER_EFFECT" &&
    healEffectTypes.has(step.effect?.type)
  ) {
    return `
      <div class="battle-fx heal-fx on-player" aria-hidden="true">
        <i></i><i></i><i></i>
      </div>
    `
  }
  if (
    step.type === "PLAYER_EFFECT" ||
    step.type === "RELIC_TRIGGERED" ||
    step.type === "ENEMY_EFFECT"
  ) {
    return `<div class="battle-fx status-fx" aria-hidden="true"></div>`
  }
  return ""
}

function specialEffectLayer(animation) {
  return `
    <div class="special-effect-layer theme-${animation.theme}" role="status">
      <div class="special-vignette"></div>
      <div class="special-content">
        <span class="special-kicker">SPECIAL RESOLUTION</span>
        <div class="special-coins">
          ${animation.results
            .map(
              (result) => `
                <div class="special-coin result-${result.side}"
                  style="--result-delay:${result.order * 60}ms">
                  <span>${result.side === "front" ? "正" : "反"}</span>
                </div>
              `
            )
            .join("")}
        </div>
        <h2>${escapeHtml(animation.headline)}</h2>
        <p>${escapeHtml(animation.detail)}</p>
      </div>
    </div>
  `
}

function rewardScreen(snapshot) {
  const state = snapshot.rewardState
  let body = ""
  if (state.status === "SHOWING_EXP") {
    body = `
      <span class="reward-emblem">+${state.expGained}</span>
      <h2>战斗收益已经入账</h2>
      <div class="reward-ledger">
        <span>经验 <b>${state.expBefore} → ${state.expAfter}</b></span>
        <span>筹码 <b>+${state.chipsGained}</b></span>
        <span>等级 <b>${state.levelBefore} → ${state.levelAfter}</b></span>
      </div>
      <button class="primary-button" data-action="continue-reward">继续</button>
    `
  } else if (state.status === "SHOWING_FIXED_REWARD") {
    body = `
      <span class="eyebrow">教学奖励</span>
      <h2>获得一枚固定硬币</h2>
      <p class="lead">赌场认为你已经具备反击能力。它对此表示遗憾。</p>
      <button class="primary-button" data-action="claim-fixed-reward">
        获得反击
      </button>
    `
  } else if (state.status === "SELECTING_REWARD_TYPE") {
    body = `
      <span class="eyebrow">构筑调整</span>
      <h2>选择一种升级方式</h2>
      <div class="choice-grid">
        ${rewardChoice("addCoin", "＋", "新增硬币", "从三枚随机硬币中选择一枚")}
        ${rewardChoice("upgradeCoin", "↑", "强化硬币", "提高一枚已有硬币的数值")}
        ${rewardChoice("removeCoin", "−", "删除硬币", "精简硬币库，至少保留三枚")}
      </div>
    `
  } else if (state.status === "SELECTING_NEW_COIN") {
    body = `
      <span class="eyebrow">新增硬币</span>
      <h2>三项概率工具，一项可以带走</h2>
      <div class="coin-grid reward-coins">
        ${state.coinCandidates
          .map((coinId) =>
            coinCard(
              hydrateCoin(
                { coinId, uid: coinId, level: 1 },
                snapshot.configs.coins
              ),
              "reward-new-coin",
              coinId
            )
          )
          .join("")}
      </div>
    `
  } else if (state.status === "SELECTING_UPGRADE_TARGET") {
    body = targetCoinList(
      "选择强化目标",
      snapshot.rewardUpgradeTargets,
      snapshot,
      "reward-upgrade"
    )
  } else if (state.status === "SELECTING_REMOVE_TARGET") {
    body = targetCoinList(
      "选择删除目标",
      state.player.coins,
      snapshot,
      "reward-remove",
      "删除后无法撤销。赌场对此不提供售后服务。"
    )
  } else {
    body = `
      <span class="reward-emblem done">✓</span>
      <h2>${escapeHtml(state.result?.message ?? "奖励领取完成")}</h2>
      <p>玩家状态已经保存，可以继续前往下一节点。</p>
      <button class="primary-button" data-action="complete-reward">
        返回章节地图
      </button>
    `
  }

  return pageShell(
    snapshot,
    `
      <section class="center-screen">
        <article class="modal-card reward-card">${body}</article>
      </section>
    `
  )
}

function rewardChoice(value, symbol, title, description) {
  return `
    <button class="choice-card" data-action="reward-type" data-value="${value}">
      <span>${symbol}</span>
      <strong>${title}</strong>
      <small>${description}</small>
    </button>
  `
}

function targetCoinList(title, targets, snapshot, action, note = "") {
  return `
    <span class="eyebrow">硬币库管理</span>
    <h2>${title}</h2>
    ${note ? `<p>${escapeHtml(note)}</p>` : ""}
    <div class="target-list">
      ${targets
        .map((instance) => {
          const coin = hydrateCoin(instance, snapshot.configs.coins)
          return `
            <button data-action="${action}" data-value="${coin.uid}">
              <span class="mini-coin">${escapeHtml(coin.name.slice(0, 1))}</span>
              <span>
                <strong>${escapeHtml(coin.name)}</strong>
                <small>Lv.${coin.level} · ${coin.typeName}</small>
              </span>
              <span class="target-arrow">→</span>
            </button>
          `
        })
        .join("")}
    </div>
  `
}

function eventScreen(snapshot) {
  const state = snapshot.eventState
  let body
  if (state.status === "SELECTING_OPTION") {
    body = `
      <span class="event-symbol">✦</span>
      <span class="eyebrow">命运泉水</span>
      <h1>经审计的奇迹</h1>
      ${snapshot.narrative.fateSpringIntro
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join("")}
      <div class="event-options">
        ${snapshot.eventOptions
          .map(
            (option) => `
              <button data-action="event-option" data-value="${option.id}"
                ${option.available ? "" : "disabled"}>
                <strong>${escapeHtml(option.name)}</strong>
                <span>${escapeHtml(option.description)}</span>
                ${option.available ? "" : "<small>当前条件不足</small>"}
              </button>
            `
          )
          .join("")}
      </div>
    `
  } else if (state.status === "SELECTING_UPGRADE_TARGET") {
    body = targetCoinList(
      "献祭20生命，强化一枚硬币",
      snapshot.eventUpgradeTargets,
      snapshot,
      "event-upgrade"
    )
  } else {
    body = `
      <span class="event-symbol">✓</span>
      <h1>手续办理完成</h1>
      <p>${eventResultText(state.result, snapshot)}</p>
      <button class="primary-button" data-action="complete-event">
        离开泉水
      </button>
    `
  }
  return pageShell(
    snapshot,
    `<section class="center-screen"><article class="modal-card event-card">${body}</article></section>`
  )
}

function eventResultText(result, snapshot) {
  if (result.optionId === "recover_hp") {
    return `恢复了 ${result.recoveredHp} 点生命。`
  }
  if (result.optionId === "sacrifice_hp_upgrade_coin") {
    return `${snapshot.configs.coins[result.coinId].name}强化至 Lv.${result.newLevel}。`
  }
  return `最大生命降低20，获得遗物“${snapshot.configs.relics[result.relicId].name}”。`
}

function shopScreen(snapshot) {
  const state = snapshot.shopState
  let body
  if (snapshot.shopSelection) {
    const isUpgrade = snapshot.shopSelection.category === "UPGRADE"
    body = `
      <button class="text-button back-button" data-action="cancel-shop-selection">← 返回商品</button>
      ${targetCoinList(
        isUpgrade ? "选择强化目标" : "选择回收目标",
        snapshot.shopTargets,
        snapshot,
        "shop-target",
        isUpgrade
          ? "强化服务仅限一次。"
          : "回收最多一枚硬币，并获得少量筹码。"
      )}
    `
  } else {
    body = `
      <div class="shop-heading">
        <div>
          <span class="eyebrow">概率结算处</span>
          <h1>本柜台接受筹码与后悔</h1>
        </div>
        <div class="chip-balance">筹码 <strong>${state.player.chips}</strong></div>
      </div>
      <div class="shop-grid">
        ${state.inventory.map((item) => shopListing(item, snapshot)).join("")}
      </div>
      <button class="secondary-button" data-action="leave-shop">保留筹码并离开</button>
    `
  }
  return pageShell(
    snapshot,
    `<section class="shop-screen">${body}</section>`,
    { stageClass: "shop-stage" }
  )
}

function shopListing(item, snapshot) {
  let title
  let detail
  let kind
  if (item.category === "COIN") {
    const coin = hydrateCoin(
      { coinId: item.contentId, level: 1 },
      snapshot.configs.coins
    )
    title = coin.name
    detail = `${coin.rarityName} · ${formatEffect(coin.frontEffect)}`
    kind = "硬币"
  } else if (item.category === "RELIC") {
    const relic = snapshot.configs.relics[item.contentId]
    title = relic.name
    detail = relic.description
    kind = "遗物"
  } else if (item.category === "UPGRADE") {
    title = "强化服务"
    detail = "选择一枚可强化的已有硬币"
    kind = "服务"
  } else {
    title = "硬币回收"
    detail = `最多回收一枚，获得 ${item.payout} 筹码`
    kind = "回收"
  }
  const price =
    item.category === "RECYCLE" ? `+${item.payout}` : `${item.price}`
  return `
    <button class="shop-item" data-action="shop-listing"
      data-value="${item.listingId}" ${item.soldOut ? "disabled" : ""}>
      <span class="shop-kind">${kind}</span>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(detail)}</p>
      <span class="shop-price">${price} <small>筹码</small></span>
      ${item.soldOut ? `<span class="sold-stamp">已办理</span>` : ""}
    </button>
  `
}

function relicRewardScreen(snapshot) {
  return pageShell(
    snapshot,
    `
      <section class="center-screen">
        <article class="modal-card relic-reward-card">
          <span class="eyebrow">Boss奖励</span>
          <h1>选择一件遗物</h1>
          <p>首席赔率官同意你带走一件证物。</p>
          <div class="relic-choice-grid">
            ${snapshot.relicCandidates
              .map((id) => {
                const relic = snapshot.configs.relics[id]
                return `
                  <button data-action="boss-relic" data-value="${id}">
                    <span class="relic-glyph">◆</span>
                    <small>${escapeHtml(relic.rarity)}</small>
                    <strong>${escapeHtml(relic.name)}</strong>
                    <p>${escapeHtml(relic.description)}</p>
                    ${
                      relic.flavor
                        ? `<em>${escapeHtml(relic.flavor)}</em>`
                        : ""
                    }
                  </button>
                `
              })
              .join("")}
          </div>
        </article>
      </section>
    `
  )
}

function summaryScreen(snapshot) {
  const summary = snapshot.summary
  const won = summary.result === "COMPLETED"
  return pageShell(
    snapshot,
    `
      <section class="center-screen">
        <article class="modal-card summary-card">
          <span class="summary-seal">${won ? "批准" : "驳回"}</span>
          <span class="eyebrow">RUN SUMMARY</span>
          <h1>${won ? "概率审查通过" : "本次申诉失败"}</h1>
          <p>${won ? escapeHtml(snapshot.narrative.chapter0Victory) : "你可以重新排队。概率不会记仇，它只保留记录。"}</p>
          <div class="summary-grid">
            <div><span>剩余HP</span><strong>${summary.remainingHp}/${summary.maxHp}</strong></div>
            <div><span>幸运</span><strong>${formatLuck(summary.luck)}</strong></div>
            <div><span>筹码</span><strong>${summary.remainingChips}</strong></div>
            <div><span>完成节点</span><strong>${summary.completedNodeCount}</strong></div>
            <div><span>强化次数</span><strong>${summary.upgradeCount}</strong></div>
            <div><span>删除/回收</span><strong>${summary.removeCount}</strong></div>
          </div>
          <div class="summary-lists">
            <div>
              <h2>硬币库</h2>
              <p>${summary.coins.map((coin) => `${escapeHtml(coin.name)} Lv.${coin.level}`).join(" · ")}</p>
            </div>
            <div>
              <h2>遗物</h2>
              <p>${summary.relics.length ? summary.relics.map((relic) => escapeHtml(relic.name)).join(" · ") : "无"}</p>
            </div>
          </div>
          <button class="primary-button" data-action="restart-run">重新接受审查</button>
        </article>
      </section>
    `
  )
}

function buildDrawer(snapshot) {
  const player = snapshot.buildPlayer
  const groupedCoins = new Map()
  for (const instance of player.coins) {
    const key = `${instance.coinId}:${instance.level}`
    const group = groupedCoins.get(key) ?? {
      instance,
      count: 0
    }
    group.count += 1
    groupedCoins.set(key, group)
  }
  const ownedRelics = presentRelics(
    player.relicIds,
    snapshot.configs.relics
  )
  return `
    <div class="build-overlay">
      <button class="drawer-backdrop" data-action="close-build"
        aria-label="关闭构筑查看"></button>
      <aside class="build-drawer" role="dialog" aria-modal="true"
        aria-label="当前构筑">
        <header class="build-drawer-heading">
          <div>
            <span class="eyebrow">PLAYER BUILD</span>
            <h1>当前构筑</h1>
          </div>
          <button class="drawer-close" data-action="close-build"
            aria-label="关闭">×</button>
        </header>

        <section class="build-status">
          <h2>当前状态</h2>
          <div class="build-status-grid">
            <div><span>HP</span><strong>${player.hp}/${player.maxHp}</strong></div>
            <div><span>最大HP</span><strong>${player.maxHp}</strong></div>
            <div><span>${player.inBattle ? "本场幸运" : "幸运"}</span><strong>${formatLuck(player.luck)}</strong></div>
            <div><span>筹码</span><strong>${player.chips}</strong></div>
          </div>
          ${
            player.inBattle
              ? `<p class="battle-luck-note">章节基础幸运 ${formatLuck(player.chapterLuck)}；本场变化在战斗结束后清除。</p>`
              : ""
          }
        </section>

        <section class="build-section">
          <div class="build-section-heading">
            <div>
              <span class="eyebrow">COIN LIBRARY</span>
              <h2>硬币库</h2>
            </div>
            <span>${player.coins.length} 枚</span>
          </div>
          <div class="build-coin-list">
            ${[...groupedCoins.values()]
              .map(({ instance, count }) => {
                const coin = hydrateCoin(
                  instance,
                  snapshot.configs.coins
                )
                return `
                  <article class="build-coin-item type-${coin.type}">
                    <div class="build-coin-title">
                      <span class="mini-coin">${escapeHtml(coin.name.slice(0, 1))}</span>
                      <div>
                        <strong>${escapeHtml(coin.name)}${count > 1 ? ` ×${count}` : ""}</strong>
                        <small>Lv.${coin.level} · ${coin.typeName} · ${coin.rarityName}</small>
                      </div>
                      <b><small>基础概率</small>${formatRate(coin.frontRate)}</b>
                    </div>
                    <div class="build-face front">
                      <span>正面</span>
                      <p>${escapeHtml(formatEffect(coin.frontEffect))}</p>
                    </div>
                    <div class="build-face back">
                      <span>反面</span>
                      <p>${escapeHtml(formatEffect(coin.backEffect))}</p>
                    </div>
                    ${coin.consumable ? `<em>一次性：使用后本场移除</em>` : ""}
                  </article>
                `
              })
              .join("")}
          </div>
        </section>

        <section class="build-section">
          <div class="build-section-heading">
            <div>
              <span class="eyebrow">RELICS</span>
              <h2>当前遗物</h2>
            </div>
            <span>${ownedRelics.length} 件</span>
          </div>
          <div class="build-relic-list">
            ${
              ownedRelics.length
                ? ownedRelics
                    .map(
                      (relic) => `
                        <article class="build-relic-item rarity-${relic.rarity.toLowerCase()}">
                          <div>
                            <span class="relic-glyph">◆</span>
                            <div>
                              <strong>${escapeHtml(relic.name)}</strong>
                              <small>${escapeHtml(relic.rarityName)}</small>
                            </div>
                          </div>
                          <p>${escapeHtml(relic.description)}</p>
                          ${
                            relic.flavor
                              ? `<em>${escapeHtml(relic.flavor)}</em>`
                              : ""
                          }
                        </article>
                      `
                    )
                    .join("")
                : `<p class="empty-build">当前没有遗物。赌场建议你继续消费。</p>`
            }
          </div>
        </section>
      </aside>
    </div>
  `
}

function resourceInspector(snapshot) {
  const resources = snapshot.resourceInspector.resources
  const available = resources.filter(
    ({ status }) => status === "available"
  ).length
  const missingRequired = resources.filter(
    ({ status, required }) =>
      required &&
      !["available", "unchecked"].includes(status)
  ).length
  const statusLabels = {
    unchecked: "待检查",
    available: "可用",
    missing_file: "文件缺失",
    missing_config: "未配置",
    load_error: "加载失败"
  }
  return `
    <div class="build-overlay resource-overlay">
      <button class="drawer-backdrop" data-action="close-resources"
        aria-label="关闭资源检查器"></button>
      <aside class="build-drawer resource-drawer" aria-label="资源检查器">
        <div class="build-drawer-heading">
          <div>
            <span class="eyebrow">RESOURCE INSPECTOR</span>
            <h1>资源检查器</h1>
          </div>
          <button class="drawer-close" data-action="close-resources"
            aria-label="关闭资源检查器">×</button>
        </div>
        <div class="resource-summary">
          <span><b>${available}</b> / ${resources.length} 可用</span>
          <span class="${missingRequired > 0 ? "has-missing" : ""}">
            必需缺失 <b>${missingRequired}</b>
          </span>
        </div>
        <p class="resource-note">
          检查结果来自当前资源清单和实际加载路径。未配置表示清单中尚未指定文件。
        </p>
        <div class="resource-list">
          ${resources
            .map(
              (resource) => `
                <article class="resource-item status-${resource.status}">
                  <div>
                    <small>${escapeHtml(resource.type)} · ${resource.required ? "必需" : "可选"}</small>
                    <strong>${escapeHtml(resource.name)}</strong>
                    <code>${escapeHtml(resource.cue ?? resource.id)}</code>
                  </div>
                  <div class="resource-path">
                    <span>${escapeHtml(resource.path ?? "尚未配置文件")}</span>
                    <b>${statusLabels[resource.status] ?? resource.status}</b>
                  </div>
                </article>
              `
            )
            .join("")}
        </div>
      </aside>
    </div>
  `
}

export function render(snapshot) {
  const screens = {
    [Screen.MAP]: mapScreen,
    [Screen.BATTLE]: battleScreen,
    [Screen.REWARD]: rewardScreen,
    [Screen.EVENT]: eventScreen,
    [Screen.SHOP]: shopScreen,
    [Screen.RELIC_REWARD]: relicRewardScreen,
    [Screen.SUMMARY]: summaryScreen
  }
  return screens[snapshot.screen](snapshot)
}
