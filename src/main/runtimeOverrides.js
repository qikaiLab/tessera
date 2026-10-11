import path from 'node:path'

const USER_DATA_ENV = 'MOTOTRACE_USER_DATA_DIR'
const DATA_DIR_ENV = 'MOTOTRACE_DATA_DIR'

function readDirectory(env, name) {
  const value = env[name]
  if (value === undefined || value === '') return ''
  if (typeof value !== 'string' || !path.isAbsolute(value)) {
    throw new Error(`${name} must be an absolute path`)
  }
  return path.resolve(value)
}

// Lets automated runs point the app at throwaway directories. Both variables are
// required together so an isolated run can never fall back to the real data directory.
function resolveRuntimeOverrides(env = process.env) {
  const userDataDir = readDirectory(env, USER_DATA_ENV)
  const dataDir = readDirectory(env, DATA_DIR_ENV)
  if (!userDataDir && !dataDir) return null
  if (!userDataDir || !dataDir) {
    throw new Error(`${USER_DATA_ENV} and ${DATA_DIR_ENV} must be set together`)
  }
  return { userDataDir, dataDir }
}

// The dev server URL is only injected by `electron-vite dev`; any other unpackaged
// launch (for example smoke tests against the built output) loads the built files.
function shouldUseDevServer({ isPackaged, env = process.env }) {
  return !isPackaged && Boolean(env.ELECTRON_RENDERER_URL)
}

export { resolveRuntimeOverrides, shouldUseDevServer }
