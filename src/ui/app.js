import { GameSession } from "./gameSession.js"
import { render, renderTutorial } from "./render.js"
import {
  AudioFeedback,
  createAudioEvents,
  isRunRestart
} from "./audioFeedback.js"
import { HtmlAudioDriver } from "./htmlAudioDriver.js"
import { HtmlMusicDriver } from "./htmlMusicDriver.js"
import { MusicController } from "./musicController.js"
import { inspectBrowserResources } from "./resourceInspector.js"

const root = document.querySelector("#app")
const tutorialRoot = document.querySelector("#tutorial-root")
const session = new GameSession()
const audioFeedback = new AudioFeedback({
  driver: new HtmlAudioDriver()
})
const musicController = new MusicController({
  driver: new HtmlMusicDriver()
})
let renderedTutorialId = null
let previousSnapshot = null

session.subscribe((snapshot) => {
  const screenChanged =
    previousSnapshot?.screen !== snapshot.screen
  if (isRunRestart(previousSnapshot, snapshot)) {
    audioFeedback.clear()
  }
  audioFeedback.consume(createAudioEvents(previousSnapshot, snapshot))
  musicController.sync(snapshot)
  previousSnapshot = snapshot
  root.innerHTML = render(snapshot)
  if (screenChanged) {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
  }
  const nextTutorialId = snapshot.tutorial.activeHint?.id ?? null
  if (nextTutorialId !== renderedTutorialId) {
    tutorialRoot.innerHTML = renderTutorial(snapshot.tutorial)
    renderedTutorialId = nextTutorialId
  }
})

const actions = {
  "enter-demo": () => {
    document.querySelector("#entry-overlay")?.remove()
  },
  "enter-node": () => session.enterCurrentNode(),
  "play-coin": (value) => session.playCoin(value),
  "continue-reward": () => session.continueReward(),
  "claim-fixed-reward": () => session.claimFixedReward(),
  "reward-type": (value) => session.chooseRewardType(value),
  "reward-new-coin": (value) => session.selectRewardCoin(value),
  "reward-upgrade": (value) => session.selectRewardUpgrade(value),
  "reward-remove": (value) => session.selectRewardRemove(value),
  "complete-reward": () => session.completeReward(),
  "event-option": (value) => session.chooseEventOption(value),
  "event-upgrade": (value) => session.selectEventUpgrade(value),
  "complete-event": () => session.completeEvent(),
  "shop-listing": (value) => session.chooseShopListing(value),
  "shop-target": (value) => session.selectShopTarget(value),
  "cancel-shop-selection": () => session.cancelShopSelection(),
  "leave-shop": () => session.leaveShop(),
  "boss-relic": (value) => session.selectBossRelic(value),
  "restart-run": () => session.startRun(),
  "open-build": () => session.openBuild(),
  "close-build": () => session.closeBuild(),
  "open-resources": async () => {
    session.openResourceInspector()
    session.updateResourceStatuses(
      await inspectBrowserResources()
    )
  },
  "close-resources": () => session.closeResourceInspector(),
  "dismiss-tutorial": () => session.dismissTutorial()
}

document.addEventListener(
  "pointerdown",
  () => {
    audioFeedback.unlock()
    musicController.unlock()
  },
  { once: true, capture: true }
)

document.addEventListener("click", async (event) => {
  audioFeedback.unlock()
  musicController.unlock()
  const target = event.target.closest("[data-action]")
  if (!target || target.disabled) {
    return
  }
  const handler = actions[target.dataset.action]
  if (!handler) {
    return
  }
  try {
    await handler(target.dataset.value)
  } catch (error) {
    session.reportError(error)
  }
})

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    session.closeBuild()
    session.closeResourceInspector()
  }
})
