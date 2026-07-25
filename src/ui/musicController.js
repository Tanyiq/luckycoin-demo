import { findAudioResource } from "../data/resources.js"

export const MusicCue = Object.freeze({
  INTERVAL: "music_interval",
  BATTLE: "music_battle",
  SPRING: "music_spring",
  SHOP: "music_shop",
  BOSS: "music_boss"
})

export function selectMusicCue(snapshot) {
  if (snapshot.screen === "BATTLE") {
    const currentNode = snapshot.chapterConfig.nodes.find(
      ({ id }) => id === snapshot.chapterState.currentNodeId
    )
    return currentNode?.type === "BOSS_BATTLE"
      ? MusicCue.BOSS
      : MusicCue.BATTLE
  }
  if (snapshot.screen === "EVENT") {
    return MusicCue.SPRING
  }
  if (snapshot.screen === "SHOP") {
    return MusicCue.SHOP
  }
  return MusicCue.INTERVAL
}

export class MusicController {
  #driver
  #unlocked = false
  #desiredCue = null
  #playingCue = null
  #playingTrack = null

  constructor({ driver }) {
    this.#driver = driver
  }

  sync(snapshot) {
    this.#desiredCue = selectMusicCue(snapshot)
    this.#playDesired()
  }

  unlock() {
    if (this.#unlocked) {
      return
    }
    this.#unlocked = true
    this.#driver.unlock()
    this.#playDesired()
  }

  setMuted(muted) {
    this.#driver.setMuted(Boolean(muted))
  }

  setVolume(volume) {
    const normalized = Math.max(0, Math.min(1, Number(volume)))
    this.#driver.setVolume(normalized)
  }

  stop() {
    this.#playingCue = null
    this.#playingTrack = null
    this.#driver.stop()
  }

  #playDesired() {
    if (!this.#unlocked || !this.#desiredCue) {
      return
    }
    const desiredTrack =
      findAudioResource(this.#desiredCue)?.path ?? this.#desiredCue
    if (this.#playingTrack === desiredTrack) {
      this.#playingCue = this.#desiredCue
      return
    }
    this.#driver.play(this.#desiredCue, { loop: true })
    this.#playingCue = this.#desiredCue
    this.#playingTrack = desiredTrack
  }
}
