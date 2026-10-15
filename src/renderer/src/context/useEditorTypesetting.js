import { useCallback, useState } from 'react'

// Settings are saved as typed (they are free text such as "700px" or "90%"): the editors
// interpret them, and an empty value falls back to the default.
const DEFAULTS = {
  fullscreenWidthMode: 'standard',
  fullscreenStandardWidth: '700px',
  fullscreenWideWidth: '1000px',
  editorLineHeight: '1.8',
  editorLetterSpacing: '0px'
}

// A setting held in state and saved to the app config whenever it is changed.
function useConfigSetting(key) {
  const [value, setValue] = useState(DEFAULTS[key])
  const update = useCallback((next) => {
    setValue(next)
    window.api.config.set(key, next)
  }, [key])
  return [value, update, setValue]
}

// How the editors lay text out: the fullscreen column width and the line / letter spacing.
export function useEditorTypesetting() {
  const [fullscreenWidthMode, updateFullscreenWidthMode, setWidthMode] = useConfigSetting('fullscreenWidthMode')
  const [fullscreenStandardWidth, updateFullscreenStandardWidth, setStandardWidth] = useConfigSetting('fullscreenStandardWidth')
  const [fullscreenWideWidth, updateFullscreenWideWidth, setWideWidth] = useConfigSetting('fullscreenWideWidth')
  const [editorLineHeight, updateEditorLineHeight, setLineHeight] = useConfigSetting('editorLineHeight')
  const [editorLetterSpacing, updateEditorLetterSpacing, setLetterSpacing] = useConfigSetting('editorLetterSpacing')

  // Applies the saved config on startup (nothing is written back).
  const loadTypesetting = useCallback((config) => {
    setWidthMode(config.fullscreenWidthMode || DEFAULTS.fullscreenWidthMode)
    setStandardWidth(config.fullscreenStandardWidth || DEFAULTS.fullscreenStandardWidth)
    setWideWidth(config.fullscreenWideWidth || DEFAULTS.fullscreenWideWidth)
    setLineHeight(config.editorLineHeight || DEFAULTS.editorLineHeight)
    setLetterSpacing(config.editorLetterSpacing || DEFAULTS.editorLetterSpacing)
  }, [setWidthMode, setStandardWidth, setWideWidth, setLineHeight, setLetterSpacing])

  return {
    fullscreenWidthMode, updateFullscreenWidthMode,
    fullscreenStandardWidth, updateFullscreenStandardWidth,
    fullscreenWideWidth, updateFullscreenWideWidth,
    editorLineHeight, updateEditorLineHeight,
    editorLetterSpacing, updateEditorLetterSpacing,
    loadTypesetting
  }
}
