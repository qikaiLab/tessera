// The colour the window shows before the page has painted, so a light interface never opens with a
// dark flash (and the other way round). It follows the same rules as the renderer: linen is always
// light, jade always dark, the others follow the saved theme, and a first launch (no appearance
// setting saved, guide never closed) starts light.
export const LIGHT_WINDOW_BACKGROUND = '#f5f5f5'
export const DARK_WINDOW_BACKGROUND = '#0f0f0f'

export function resolveWindowBackground(config = {}) {
  const fresh = !config.onboardingDone
    && config.interfaceStyle === undefined
    && config.theme === undefined
    && config.themeAccent === undefined
  if (fresh) return LIGHT_WINDOW_BACKGROUND
  if (config.interfaceStyle === 'linen-study') return LIGHT_WINDOW_BACKGROUND
  if (config.interfaceStyle === 'jade-archive') return DARK_WINDOW_BACKGROUND
  return config.theme === 'light' ? LIGHT_WINDOW_BACKGROUND : DARK_WINDOW_BACKGROUND
}
