import path from 'node:path'

const USER_DATA_ENV = 'MOTOTRACE_USER_DATA_DIR'
const DATA_DIR_ENV = 'MOTOTRACE_DATA_DIR'
const USE_REAL_DATA_ENV = 'MOTOTRACE_USE_REAL_DATA'
const DEV_USER_DATA_NAME = 'mototrace-dev'
const DEV_DATA_ROOT_NAME = 'MotoTrace-dev'

function readDirectory(env, name) {
  const value = env[name]
  if (value === undefined || value === '') return ''
  if (typeof value !== 'string' || !path.isAbsolute(value)) {
    throw new Error(`${name} must be an absolute path`)
  }
  return path.resolve(value)
}

// Decides where an unpackaged or automated run keeps its data so it can never touch
// the records of an installed MotoTrace:
// - explicit overrides (automated tests) must give both directories and they are fixed;
// - a plain unpackaged run (npm run dev) gets its own "mototrace-dev" userData and a
//   "MotoTrace-dev" data directory, unless MOTOTRACE_USE_REAL_DATA=1 opts out;
// - a packaged app returns null and keeps its normal locations.
function resolveRuntimeOverrides(env = process.env, { isPackaged = true, appDataDir = '', homeDir = '' } = {}) {
  const userDataDir = readDirectory(env, USER_DATA_ENV)
  const dataDir = readDirectory(env, DATA_DIR_ENV)
  if (userDataDir || dataDir) {
    if (!userDataDir || !dataDir) {
      throw new Error(`${USER_DATA_ENV} and ${DATA_DIR_ENV} must be set together`)
    }
    return { userDataDir, dataDir, fixedDataDir: true }
  }

  if (isPackaged || env[USE_REAL_DATA_ENV] === '1' || !appDataDir || !homeDir) return null
  return {
    userDataDir: path.join(appDataDir, DEV_USER_DATA_NAME),
    dataDir: path.join(homeDir, DEV_DATA_ROOT_NAME, 'data'),
    fixedDataDir: false
  }
}

// The dev server URL is only injected by `electron-vite dev`; any other unpackaged
// launch (for example smoke tests against the built output) loads the built files.
function shouldUseDevServer({ isPackaged, env = process.env }) {
  return !isPackaged && Boolean(env.ELECTRON_RENDERER_URL)
}

export { resolveRuntimeOverrides, shouldUseDevServer }
