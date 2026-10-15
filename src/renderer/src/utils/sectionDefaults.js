// How an empty number section is filled on a new day: typed in by hand (starting at 0), or
// carried over from the most recent day that has a value.
export const NUMBER_DEFAULT_MODE = Object.freeze({ MANUAL: 'manual', CARRY: 'carry' })

export function normalizeNumberDefaultMode(mode) {
  return mode === NUMBER_DEFAULT_MODE.CARRY ? NUMBER_DEFAULT_MODE.CARRY : NUMBER_DEFAULT_MODE.MANUAL
}

export function getNumberDefaultMode(section) {
  return normalizeNumberDefaultMode(section?.numberDefaultMode)
}
