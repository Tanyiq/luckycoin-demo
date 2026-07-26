import { createDiscoveryRecord } from "./discoverySystem.js"
import { createMetaProgress } from "./metaProgression.js"

export const SAVE_VERSION = 2
export const SAVE_KEY = "luckycoin.save.v1"

export function createEmptySaveData() {
  return {
    version: SAVE_VERSION,
    profile: {
      tutorialCompleted: false,
      discovery: createDiscoveryRecord(),
      metaProgress: createMetaProgress()
    },
    currentRun: null
  }
}

function clone(value) {
  return value == null
    ? value
    : JSON.parse(JSON.stringify(value))
}

export class MemorySaveRepository {
  #data

  constructor(initialData = null) {
    this.#data = clone(initialData ?? createEmptySaveData())
  }

  load() {
    return clone(this.#data)
  }

  save(data) {
    this.#data = clone(data)
    return this.load()
  }
}

export class LocalStorageSaveRepository {
  #storage
  #key

  constructor({
    storage = globalThis.localStorage,
    key = SAVE_KEY
  } = {}) {
    this.#storage = storage
    this.#key = key
  }

  load() {
    try {
      const raw = this.#storage?.getItem(this.#key)
      return raw ? JSON.parse(raw) : createEmptySaveData()
    } catch {
      return createEmptySaveData()
    }
  }

  save(data) {
    this.#storage?.setItem(this.#key, JSON.stringify(data))
    return clone(data)
  }
}
