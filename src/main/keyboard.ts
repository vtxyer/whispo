import { uIOhook, UiohookKey } from "uiohook-napi"
import {
  getWindowRendererHandlers,
  showPanelWindow,
  showPanelWindowAndStartRecording,
  stopRecordingAndHidePanelWindow,
  WINDOWS,
} from "./window"
import { systemPreferences } from "electron"
import { configStore } from "./config"
import { state } from "./state"

export function listenToKeyboardEvents() {
  try {
    let isHoldingAltKey = false
    let startRecordingTimer: NodeJS.Timeout | undefined

    // keys that are currently pressed down without releasing
    // excluding Alt
    const keysPressed = new Set<number>()

    if (process.env.IS_MAC) {
      if (!systemPreferences.isTrustedAccessibilityClient(false)) {
        return
      }
    }

    const cancelRecordingTimer = () => {
      if (startRecordingTimer) {
        clearTimeout(startRecordingTimer)
        startRecordingTimer = undefined
      }
    }

    uIOhook.on("keydown", (e) => {
      if (e.keycode === UiohookKey.Escape && state.isRecording) {
        const win = WINDOWS.get("panel")
        if (win) {
          stopRecordingAndHidePanelWindow()
        }

        return
      }

      if (configStore.get().shortcut === "ctrl-backslash") {
        if (e.keycode === UiohookKey.Backslash && UiohookKey.F2) {
          getWindowRendererHandlers("panel")?.startOrFinishRecording.send()
        }
      } else {
        if (e.keycode === UiohookKey.Alt) {
          if (keysPressed.size > 0) {
            console.log("ignore Alt because other keys are pressed")
            return
          }

          if (startRecordingTimer) {
            return
          }

          startRecordingTimer = setTimeout(() => {
            isHoldingAltKey = true
            console.log("start recording")
            showPanelWindowAndStartRecording()
          }, 800)
        } else {
          keysPressed.add(e.keycode)
          cancelRecordingTimer()

          if (isHoldingAltKey) {
            stopRecordingAndHidePanelWindow()
          }

          isHoldingAltKey = false
        }
      }
    })

    uIOhook.on("keyup", (e) => {
      if (configStore.get().shortcut === "ctrl-backslash") return

      cancelRecordingTimer()
      keysPressed.delete(e.keycode)

      if (e.keycode === UiohookKey.Alt) {
        console.log("release Alt")
        if (isHoldingAltKey) {
          getWindowRendererHandlers("panel")?.finishRecording.send()
        } else {
          stopRecordingAndHidePanelWindow()
        }

        isHoldingAltKey = false
      }
    })

    uIOhook.start()
  } catch {}
}
