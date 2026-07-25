import { findAudioResource } from "../data/resources.js"

export class HtmlMusicDriver {
  #audio = null
  #cue = null
  #muted = false
  #volume = 0.3

  unlock() {}

  play(cue, { loop = true } = {}) {
    if (this.#cue === cue && this.#audio) {
      return true
    }
    const resource = findAudioResource(cue)
    if (!resource?.path) {
      return false
    }

    this.stop()
    const audio = new Audio(resource.path)
    audio.preload = "auto"
    audio.loop = loop
    audio.muted = this.#muted
    audio.volume = this.#volume
    this.#audio = audio
    this.#cue = cue
    audio.play().catch(() => {
      // A later user gesture can call play again through the controller.
    })
    return true
  }

  stop() {
    if (this.#audio) {
      this.#audio.pause()
      this.#audio.currentTime = 0
    }
    this.#audio = null
    this.#cue = null
  }

  setMuted(muted) {
    this.#muted = muted
    if (this.#audio) {
      this.#audio.muted = muted
    }
  }

  setVolume(volume) {
    this.#volume = volume
    if (this.#audio) {
      this.#audio.volume = volume
    }
  }
}
