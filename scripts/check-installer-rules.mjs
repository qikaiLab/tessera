// Compiles the pure-string rules of the installer (build/installPathRules.nsh for the install wizard,
// build/dataPathRules.nsh for the uninstaller) into throwaway programs with NSIS (the copy
// electron-builder downloaded) and runs them on tables of cases. Nothing is installed and no registry
// or user folder is touched: the programs only call the rules and write their answers to a temp file.
//
//   node scripts/check-installer-rules.mjs
//
// Not part of `npm run check` (it needs the NSIS that electron-builder caches, which a fresh
// machine only has after the first `npm run dist`). Run it whenever one of those files changes.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const B = '\\'
const win = (...parts) => parts.join(B)

function findMakensis() {
  if (process.env.MAKENSIS && fs.existsSync(process.env.MAKENSIS)) return process.env.MAKENSIS
  const cache = path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'nsis')
  if (!fs.existsSync(cache)) return null
  for (const entry of fs.readdirSync(cache)) {
    const candidate = path.join(cache, entry, 'makensis.exe')
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

// A JS string as an NSIS string literal (line breaks as $\r and $\n).
const literal = value => `"${value.replace(/\r/g, '$\\r').replace(/\n/g, '$\\n')}"`

// Compiles and runs one check program; `body` fills the Section, `result` is what it wrote.
function runProgram(makensis, work, name, header, body) {
  const exe = path.join(work, `${name}.exe`)
  const script = [
    `Name "${name}"`,
    `OutFile "${exe}"`,
    'RequestExecutionLevel user',
    'SilentInstall silent',
    ...header,
    'Section',
    `  FileOpen $0 "$EXEDIR\\${name}.txt" w`,
    ...body,
    '  FileClose $0',
    'SectionEnd',
    ''
  ].join('\n')
  const scriptFile = path.join(work, `${name}.nsi`)
  fs.writeFileSync(scriptFile, script)
  execFileSync(makensis, ['/V2', scriptFile], { stdio: 'inherit' })
  execFileSync(exe, [], { stdio: 'inherit' })
  return fs.readFileSync(path.join(work, `${name}.txt`), 'utf8').split(/\r?\n/).filter(line => line !== '')
}

let failed = 0
function report(cases, results, describe) {
  cases.forEach((testCase, index) => {
    const { ok, line } = describe(testCase, results[index])
    if (!ok) failed += 1
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${line}`)
  })
  if (results.length !== cases.length) {
    failed += 1
    console.log(`FAIL expected ${cases.length} answers, got ${results.length}`)
  }
}

// ── The install wizard: program folder and data folder ───────────────────────
// [program folder typed, data folder typed, expected program folder, expected error]
const installCases = [
  [win('D:', 'Apps'), win('C:', 'Users', 'me', 'MotoTrace', 'data'), win('D:', 'Apps', 'MotoTrace'), ''],
  [win('D:', 'Apps', 'MotoTrace'), win('C:', 'Users', 'me', 'MotoTrace', 'data'), win('D:', 'Apps', 'MotoTrace'), ''],
  [win('D:', 'Apps', 'MotoTrace', ''), win('E:', 'Journal'), win('D:', 'Apps', 'MotoTrace'), ''],
  [win('d:', 'apps', 'mototrace'), win('E:', 'Journal'), win('d:', 'apps', 'mototrace'), ''],
  [win('C:', 'Users', 'me', 'AppData', 'Local', 'Programs', 'MotoTrace'), win('C:', 'Users', 'me', 'MotoTrace', 'data'), win('C:', 'Users', 'me', 'AppData', 'Local', 'Programs', 'MotoTrace'), ''],
  // Not a usable program folder.
  [win('D:', ''), win('E:', 'Journal'), 'D:', 'root'],
  ['D:', win('E:', 'Journal'), 'D:', 'root'],
  ['', win('E:', 'Journal'), '', 'root'],
  // The data folder would live inside the folder that is emptied on upgrade and uninstall.
  [win('C:', 'Users', 'me', 'MotoTrace'), win('C:', 'Users', 'me', 'MotoTrace', 'data'), win('C:', 'Users', 'me', 'MotoTrace'), 'datainside'],
  [win('D:', 'Apps', 'MotoTrace'), win('D:', 'Apps', 'MotoTrace', ''), win('D:', 'Apps', 'MotoTrace'), 'datainside'],
  [win('D:', 'Apps', 'MotoTrace'), win('D:', 'Apps', 'MotoTrace'), win('D:', 'Apps', 'MotoTrace'), 'datainside'],
  [win('D:', 'Apps'), win('D:', 'Apps', 'MotoTrace', 'data'), win('D:', 'Apps', 'MotoTrace'), 'datainside'],
  [win('C:', 'Users', 'me', 'MotoTrace'), win('c:', 'users', 'me', 'mototrace', 'DATA'), win('C:', 'Users', 'me', 'MotoTrace'), 'datainside'],
  // Different folders that merely share a prefix or sit around the program folder are fine.
  [win('D:', 'Apps', 'MotoTrace'), win('D:', 'Apps', 'MotoTrace2', 'data'), win('D:', 'Apps', 'MotoTrace'), ''],
  [win('D:', 'Apps', 'MotoTrace'), win('D:', 'Apps'), win('D:', 'Apps', 'MotoTrace'), ''],
  [win('D:', 'Apps'), win('D:', 'Apps', 'data'), win('D:', 'Apps', 'MotoTrace'), ''],
  [win('D:', 'Apps', 'MotoTrace'), '', win('D:', 'Apps', 'MotoTrace'), '']
]

// ── The uninstaller: which folder datapath.txt names and whether it may be emptied ──
const home = win('C:', 'Users', 'me')
const defaultDir = win(home, 'MotoTrace', 'data')
// [first line of datapath.txt, expected folder, expected kind]
const classifyCases = [
  ['', defaultDir, 'default'],
  ['\r\n', defaultDir, 'default'],
  [defaultDir, defaultDir, 'default'],
  [`${defaultDir}\r\n`, defaultDir, 'default'],
  [`${defaultDir}${B}`, defaultDir, 'default'],
  // Windows paths ignore case: the same folder in another spelling is still the default one.
  [win('c:', 'users', 'ME', 'mototrace', 'DATA'), defaultDir, 'default'],
  [win('D:', 'Journal'), win('D:', 'Journal'), 'custom'],
  [`${win('D:', 'Journal')}\r\n`, win('D:', 'Journal'), 'custom'],
  [win('D:', 'Journal', ''), win('D:', 'Journal'), 'custom'],
  [`${win('D:', 'Journal')}  `, win('D:', 'Journal'), 'custom'],
  [win(home, 'Documents'), win(home, 'Documents'), 'custom'],
  [win(home, 'MotoTrace'), win(home, 'MotoTrace'), 'custom'],
  [`${defaultDir}2`, `${defaultDir}2`, 'custom'],
  [win(defaultDir, 'sub'), win(defaultDir, 'sub'), 'custom']
]

const makensis = findMakensis()
if (!makensis) {
  console.error('makensis.exe not found. Run `npm run dist` once (electron-builder downloads NSIS), or set MAKENSIS.')
  process.exit(2)
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'mototrace-nsis-'))
try {
  console.log('Install wizard folders')
  const installResults = runProgram(makensis, work, 'install-rules',
    ['Var StateDataDir', `!include "${path.join(root, 'build', 'installPathRules.nsh')}"`],
    installCases.flatMap(([program, data]) => [
      `  StrCpy $INSTDIR ${literal(program)}`,
      `  StrCpy $StateDataDir ${literal(data)}`,
      '  Call CheckInstallPaths',
      '  FileWrite $0 "$INSTDIR|$PathsError$\\r$\\n"'
    ]))
  report(installCases, installResults, ([program, data, expectedProgram, expectedError], answer = '|') => {
    const [gotProgram, gotError] = answer.split('|')
    const ok = gotProgram === expectedProgram && gotError === expectedError
    return {
      ok,
      line: `program="${program}" data="${data}" -> "${gotProgram}" [${gotError}]${ok ? '' : `  expected "${expectedProgram}" [${expectedError}]`}`
    }
  })

  console.log('\nUninstaller data folder')
  const classifyResults = runProgram(makensis, work, 'classify-rules',
    ['Var UnDataDir', 'Var UnDataKind', 'Var UnDefaultDir', `!include "${path.join(root, 'build', 'dataPathRules.nsh')}"`, '!insertmacro DataPathRules ""'],
    classifyCases.flatMap(([line]) => [
      `  StrCpy $UnDefaultDir ${literal(defaultDir)}`,
      `  StrCpy $UnDataDir ${literal(line)}`,
      '  Call ClassifyDataDir',
      '  FileWrite $0 "$UnDataDir|$UnDataKind$\\r$\\n"'
    ]))
  report(classifyCases, classifyResults, ([line, expectedDir, expectedKind], answer = '|') => {
    const [gotDir, gotKind] = answer.split('|')
    const ok = gotDir === expectedDir && gotKind === expectedKind
    return {
      ok,
      line: `${JSON.stringify(line)} -> "${gotDir}" [${gotKind}]${ok ? '' : `  expected "${expectedDir}" [${expectedKind}]`}`
    }
  })

  const total = installCases.length + classifyCases.length
  console.log(failed === 0 ? `\nAll ${total} cases pass.` : `\n${failed} problem(s).`)
  process.exitCode = failed === 0 ? 0 : 1
} finally {
  fs.rmSync(work, { recursive: true, force: true })
}
