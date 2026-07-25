import { findAudioResource } from "../data/resources.js"

export class HtmlAudioDriver {
  #muted = false
  #volume = 0.72
  #activeGroups = new Map()

  unlock() {
    // Loading does not play anything, but prepares configured files after the
    // browser has received its first user gesture.
    for (const cue of [
      "coin_toss",
      "result_front",
      "result_back",
      "special_result",
      "relic_acquired",
      "coin_acquired",
      "damage_hit",
      "shield_gain",
      "heal"
    ]) {
      const resource = findAudioResource(cue)
      if (resource?.path) {
        const audio = new Audio(resource.path)
        audio.preload = "auto"
        audio.load()
      }
    }
  }

  play(cue, options = {}) {
    const resource = findAudioResource(cue)
    if (!resource?.path) {
      return false
    }

    const audio = new Audio(resource.path)
    audio.preload = "auto"
    audio.muted = this.#muted
    audio.volume = this.#volume
    const groupId = options.groupId
    if (groupId) {
      if (!this.#activeGroups.has(groupId)) {
        this.#activeGroups.set(groupId, new Set())
      }
      this.#activeGroups.get(groupId).add(audio)
      const release = () => {
        const group = this.#activeGroups.get(groupId)
        group?.delete(audio)
        if (group?.size === 0) {
          this.#activeGroups.delete(groupId)
        }
      }
      audio.addEventListener("ended", release, { once: true })
      audio.addEventListener("error", release, { once: true })
    }
    audio.play().catch(() => {
      // Loading failures are reported by the resource inspector. Playback
      // remains non-blocking so an unavailable effect cannot stop the game.
    })
    return true
  }

  stopGroup(groupId) {
    const group = this.#activeGroups.get(groupId)
    if (!group) {
      return
    }
    for (const audio of group) {
      audio.pause()
      audio.currentTime = 0
    }
    this.#activeGroups.delete(groupId)
  }

  setMuted(muted) {
    this.#muted = muted
    for (const group of this.#activeGroups.values()) {
      for (const audio of group) {
        audio.muted = muted
      }
    }
  }

  setVolume(volume) {
    this.#volume = volume
    for (const group of this.#activeGroups.values()) {
      for (const audio of group) {
        audio.volume = volume
      }
    }
  }
}
