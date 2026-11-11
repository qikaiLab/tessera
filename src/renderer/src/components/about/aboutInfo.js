// Everything the "关于" dialog shows that is not computed: names, links, the group number and the
// third-party list. One place, so renaming the app or moving the repository is a one-file change.
// An empty `authorName`, `authorBio` or `email` is simply left out of the dialog until it is filled in.

export const ABOUT_INFO = Object.freeze({
  appName: 'MotoTrace',
  tagline: '完全本地的自我记录软件',
  authorName: '',
  authorBio: '',
  email: '',
  qqGroup: '1132171117',
  homepage: 'https://qikailab.github.io',
  support: 'https://ifdian.net/a/7klab',
  repository: 'https://github.com/qikaiLab/tessera',
  license: 'PolyForm Noncommercial 1.0.0',
  licenseUrl: 'https://polyformproject.org/licenses/noncommercial/1.0.0'
})

export const ABOUT_LINKS = Object.freeze([
  { id: 'homepage', label: '作者主页', url: ABOUT_INFO.homepage },
  { id: 'repository', label: 'GitHub 仓库', url: ABOUT_INFO.repository },
  { id: 'issues', label: '反馈问题', url: `${ABOUT_INFO.repository}/issues` },
  { id: 'support', label: '爱发电支持', url: ABOUT_INFO.support }
])

// The libraries bundled into the app and the licence each is distributed under.
export const THIRD_PARTY = Object.freeze([
  { name: 'Electron', license: 'MIT', url: 'https://www.electronjs.org/' },
  { name: 'React / React DOM', license: 'MIT', url: 'https://react.dev/' },
  { name: 'React Router', license: 'MIT', url: 'https://reactrouter.com/' },
  { name: 'Tiptap / ProseMirror', license: 'MIT', url: 'https://tiptap.dev/' },
  { name: 'Recharts', license: 'MIT', url: 'https://recharts.org/' },
  { name: 'dnd-kit', license: 'MIT', url: 'https://dndkit.com/' },
  { name: 'date-fns', license: 'MIT', url: 'https://date-fns.org/' },
  { name: 'Floating UI', license: 'MIT', url: 'https://floating-ui.com/' },
  { name: 'JSZip', license: 'MIT 或 GPL-3.0', url: 'https://stuk.github.io/jszip/' }
])

// "Electron 43.8.7" / "Chromium 150.0.0.0" read from the user agent, which is how the renderer
// learns them without a bridge call. Missing parts are left out.
export function readRuntimeVersions(userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent) {
  const pick = pattern => userAgent.match(pattern)?.[1] ?? null
  return {
    electron: pick(/Electron\/([\d.]+)/),
    chromium: pick(/Chrome\/([\d.]+)/)
  }
}

// The text a user pastes into a bug report.
export function buildVersionReport({ version, runtime, platform }) {
  const lines = [`${ABOUT_INFO.appName} v${version}`]
  if (runtime.electron) lines.push(`Electron ${runtime.electron}`)
  if (runtime.chromium) lines.push(`Chromium ${runtime.chromium}`)
  if (platform) lines.push(platform)
  return lines.join('\n')
}
