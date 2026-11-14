// How big the main window may be on this screen.
//
// Window sizes and the work area (the screen minus the taskbar) are both in device-independent
// pixels, so a 1920x1080 display at 150% scaling offers only 1280x720, and a 1366x768 laptop at
// 125% offers about 1093x614 before the taskbar. A fixed 1280x800 window (900x600 at the smallest)
// would then hang off the screen, with its bottom edge, the status line and the lower buttons out of
// reach. The window is therefore capped to the work area.

export const PREFERRED_WINDOW = Object.freeze({ width: 1280, height: 800, minWidth: 900, minHeight: 600 })

// Below this the layout is no longer usable; a screen smaller than this gets a window that overflows
// it rather than one too small to work in.
export const SMALLEST_USABLE_WINDOW = Object.freeze({ width: 640, height: 440 })

const positive = value => (Number.isFinite(value) && value > 0 ? Math.floor(value) : null)

// The window size and smallest size for a work area ({ width, height }). Without a usable work area
// (null, NaN, zero) the preferred size is returned unchanged.
export function fitWindowToWorkArea(workArea, preferred = PREFERRED_WINDOW) {
  const availableWidth = positive(workArea?.width)
  const availableHeight = positive(workArea?.height)
  const fit = (wanted, available, floor) => (available === null ? wanted : Math.max(Math.min(wanted, available), Math.min(wanted, floor)))
  return {
    width: fit(preferred.width, availableWidth, SMALLEST_USABLE_WINDOW.width),
    height: fit(preferred.height, availableHeight, SMALLEST_USABLE_WINDOW.height),
    minWidth: fit(preferred.minWidth, availableWidth, SMALLEST_USABLE_WINDOW.width),
    minHeight: fit(preferred.minHeight, availableHeight, SMALLEST_USABLE_WINDOW.height)
  }
}

// Automated runs can pretend the screen is smaller: TESSERA_E2E_WORK_AREA=1093x574.
export function parseWorkAreaOverride(env = process.env) {
  const match = /^(\d{3,5})x(\d{3,5})$/.exec(env.TESSERA_E2E_WORK_AREA ?? '')
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null
}
