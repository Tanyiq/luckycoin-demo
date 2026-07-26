import { recordRelicDiscovery } from "./discoverySystem.js"
import { RelicSystem, RelicTrigger } from "./relicSystem.js"

function drawUnique(items, count, random) {
  const pool = [...items]
  const selected = []
  while (selected.length < count && pool.length > 0) {
    const index = Math.floor(random() * pool.length)
    selected.push(pool.splice(index, 1)[0])
  }
  return selected
}

export class RelicRewardSystem {
  #player
  #definitions
  #random

  constructor({ player, relicDefinitions, random = Math.random }) {
    this.#player = player
    this.#definitions = relicDefinitions
    this.#random = random
  }

  getAvailableRelicIds({ excludeSpecial = false } = {}) {
    return Object.keys(this.#definitions).filter(
      (id) =>
        !this.#player.relicIds.includes(id) &&
        !this.#player.bannedRelicIds.includes(id) &&
        (!this.#definitions[id].metaLocked ||
          (this.#player.metaUnlockedRelicIds ?? []).includes(id)) &&
        (!excludeSpecial ||
          this.#definitions[id].rarity !== "SPECIAL")
    )
  }

  drawCandidates(count = 3, options = {}) {
    return drawUnique(
      this.getAvailableRelicIds(options),
      count,
      this.#random
    )
  }

  acquire(relicId) {
    if (!this.getAvailableRelicIds().includes(relicId)) {
      throw new Error("该遗物不能获得")
    }
    this.#player.relicIds.push(relicId)
    recordRelicDiscovery(this.#player, relicId)
    const acquired = new RelicSystem({
      relicDefinitions: this.#definitions,
      relicIds: [relicId],
      bannedRelicIds: this.#player.bannedRelicIds,
      random: this.#random
    }).trigger(RelicTrigger.RELIC_ACQUIRED, {
      player: this.#player
    })
    return {
      relicId,
      name: this.#definitions[relicId].name,
      logs: acquired.logs
    }
  }

  acquireRandom(options = {}) {
    const [relicId] = this.drawCandidates(1, options)
    if (!relicId) {
      throw new Error("没有可获得的遗物")
    }
    return this.acquire(relicId)
  }
}
