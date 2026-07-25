export const ResourceType = Object.freeze({
  AUDIO: "audio"
})

export const ResourceStatus = Object.freeze({
  UNCHECKED: "unchecked",
  AVAILABLE: "available",
  MISSING_FILE: "missing_file",
  MISSING_CONFIG: "missing_config",
  LOAD_ERROR: "load_error"
})

export const resourceManifest = Object.freeze([
  Object.freeze({
    id: "audio.coin_toss",
    type: ResourceType.AUDIO,
    cue: "coin_toss",
    name: "硬币投掷",
    path: "./assets/audio/coin_flip.wav",
    required: true
  }),
  Object.freeze({
    id: "audio.result_front",
    type: ResourceType.AUDIO,
    cue: "result_front",
    name: "正面揭晓",
    path: "./assets/audio/coin_posi.mp3",
    required: true
  }),
  Object.freeze({
    id: "audio.result_back",
    type: ResourceType.AUDIO,
    cue: "result_back",
    name: "反面揭晓",
    path: "./assets/audio/coin_nega.wav",
    required: true
  }),
  Object.freeze({
    id: "audio.special_result",
    type: ResourceType.AUDIO,
    cue: "special_result",
    name: "特殊结果",
    path: "./assets/audio/special_event.wav",
    required: true
  }),
  Object.freeze({
    id: "audio.relic_acquired",
    type: ResourceType.AUDIO,
    cue: "relic_acquired",
    name: "获得遗物",
    path: "./assets/audio/levelup.wav",
    required: true
  }),
  Object.freeze({
    id: "audio.coin_acquired",
    type: ResourceType.AUDIO,
    cue: "coin_acquired",
    name: "获得新硬币",
    path: "./assets/audio/coin_get.mp3",
    required: true
  }),
  Object.freeze({
    id: "audio.damage_hit",
    type: ResourceType.AUDIO,
    cue: "damage_hit",
    name: "攻击命中",
    path: "./assets/audio/hit.wav",
    required: false
  }),
  Object.freeze({
    id: "audio.shield_gain",
    type: ResourceType.AUDIO,
    cue: "shield_gain",
    name: "获得护盾",
    path: "./assets/audio/shield_gain.wav",
    required: false
  }),
  Object.freeze({
    id: "audio.heal",
    type: ResourceType.AUDIO,
    cue: "heal",
    name: "生命恢复",
    path: "./assets/audio/heal.wav",
    required: false
  }),
  Object.freeze({
    id: "audio.music_interval",
    type: ResourceType.AUDIO,
    channel: "music",
    cue: "music_interval",
    name: "地图与间隔音乐",
    path: "./assets/audio/background.mp3",
    required: true
  }),
  Object.freeze({
    id: "audio.music_battle",
    type: ResourceType.AUDIO,
    channel: "music",
    cue: "music_battle",
    name: "普通战斗音乐",
    path: "./assets/audio/background.mp3",
    required: true
  }),
  Object.freeze({
    id: "audio.music_spring",
    type: ResourceType.AUDIO,
    channel: "music",
    cue: "music_spring",
    name: "命运泉水音乐",
    path: "./assets/audio/sad_dark_background.wav",
    required: true
  }),
  Object.freeze({
    id: "audio.music_shop",
    type: ResourceType.AUDIO,
    channel: "music",
    cue: "music_shop",
    name: "商店音乐",
    path: "./assets/audio/peaceful_background.wav",
    required: true
  }),
  Object.freeze({
    id: "audio.music_boss",
    type: ResourceType.AUDIO,
    channel: "music",
    cue: "music_boss",
    name: "章节0 Boss音乐",
    path: "./assets/audio/energy_background.wav",
    required: true
  })
])

export function findAudioResource(cue) {
  return resourceManifest.find(
    (resource) =>
      resource.type === ResourceType.AUDIO &&
      resource.cue === cue
  )
}
