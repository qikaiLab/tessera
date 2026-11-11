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
// With `utf16` the program writes its answers as UTF-16 LE (FileWriteUTF16LE, after a byte order mark)
// and the script is saved with a byte order mark, so that non-ASCII text survives both ways.
function runProgram(makensis, work, name, header, body, { utf16 = false } = {}) {
  const exe = path.join(work, `${name}.exe`)
  const script = [
    // electron-builder builds Unicode installers; the file rules depend on that (FileWriteUTF16LE).
    'Unicode true',
    `Name "${name}"`,
    `OutFile "${exe}"`,
    'RequestExecutionLevel user',
    'SilentInstall silent',
    ...header,
    'Section',
    `  FileOpen $0 "$EXEDIR\\${name}.txt" w`,
    ...(utf16 ? ['  FileWriteWord $0 65279'] : []),
    ...body,
    '  FileClose $0',
    'SectionEnd',
    ''
  ].join('\n')
  const scriptFile = path.join(work, `${name}.nsi`)
  fs.writeFileSync(scriptFile, utf16 ? `﻿${script}` : script)
  execFileSync(makensis, ['/V2', scriptFile], { stdio: 'inherit' })
  execFileSync(exe, [], { stdio: 'inherit' })
  const raw = fs.readFileSync(path.join(work, `${name}.txt`))
  const text = utf16 ? raw.subarray(2).toString('utf16le') : raw.toString('utf8')
  return text.split(/\r?\n/).filter(line => line !== '')
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

// ── datapath.txt: written by the installer and the app, read by the uninstaller ──
// Folder names with characters outside the ANSI code page must survive both ways.
const writeCases = [
  win('D:', 'Journal'),
  win('D:', '日记'),
  win('C:', 'Users', '张三', 'MotoTrace', 'data'),
  win('E:', '日記', 'データ'),
  win('D:', 'My Data (2026)'),
  win('D:', 'notes📓')
]
const utf16File = text => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')])
// Files the uninstaller may meet: [name, bytes (null = no file), expected first line]
const readCases = [
  ['ascii-utf8', Buffer.from(win('D:', 'Journal'), 'utf8'), win('D:', 'Journal')],
  ['ascii-utf8-crlf', Buffer.from(`${win('D:', 'Journal')}\r\n`, 'utf8'), win('D:', 'Journal')],
  ['utf16', utf16File(win('D:', '日记')), win('D:', '日记')],
  ['utf16-crlf', utf16File(`${win('D:', '日记')}\r\n`), win('D:', '日记')],
  ['utf16-ascii', utf16File(win('D:', 'Journal')), win('D:', 'Journal')],
  ['empty', Buffer.alloc(0), ''],
  ['missing', null, '']
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
    [
      // The data file writer is referenced once too, so the program compiles without warnings.
      '  Push "$EXEDIR\\unused-write.txt"',
      '  Push "x"',
      '  Call WriteDataPathFile'
    ].concat(installCases.flatMap(([program, data]) => [
      `  StrCpy $INSTDIR ${literal(program)}`,
      `  StrCpy $StateDataDir ${literal(data)}`,
      '  Call CheckInstallPaths',
      '  FileWrite $0 "$INSTDIR|$PathsError$\\r$\\n"'
    ])))
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
    [
      // The file reader is referenced once too (nothing to read: the file does not exist).
      '  Push "$EXEDIR\\unused-read.txt"',
      '  Call ReadDataPathFile',
      '  Pop $1'
    ].concat(classifyCases.flatMap(([line]) => [
      `  StrCpy $UnDefaultDir ${literal(defaultDir)}`,
      `  StrCpy $UnDataDir ${literal(line)}`,
      '  Call ClassifyDataDir',
      '  FileWrite $0 "$UnDataDir|$UnDataKind$\\r$\\n"'
    ])))
  report(classifyCases, classifyResults, ([line, expectedDir, expectedKind], answer = '|') => {
    const [gotDir, gotKind] = answer.split('|')
    const ok = gotDir === expectedDir && gotKind === expectedKind
    return {
      ok,
      line: `${JSON.stringify(line)} -> "${gotDir}" [${gotKind}]${ok ? '' : `  expected "${expectedDir}" [${expectedKind}]`}`
    }
  })

  console.log('\ndatapath.txt, written and read back')
  const stripLine = line => line.replace(/[\r\n]+$/, '')
  const dataPathHeader = [
    'Var StateDataDir', 'Var UnDataDir', 'Var UnDataKind', 'Var UnDefaultDir',
    `!include "${path.join(root, 'build', 'installPathRules.nsh')}"`,
    `!include "${path.join(root, 'build', 'dataPathRules.nsh')}"`,
    '!insertmacro DataPathRules ""'
  ]
  // The other rules are called once as well, so the program compiles without "unused function" warnings.
  const touchOtherRules = [
    '  StrCpy $INSTDIR "D:\\Apps\\MotoTrace"',
    '  StrCpy $StateDataDir "E:\\Journal"',
    '  Call CheckInstallPaths',
    '  StrCpy $UnDefaultDir "C:\\x"',
    '  StrCpy $UnDataDir "C:\\x"',
    '  Call ClassifyDataDir'
  ]
  const writeResults = runProgram(makensis, work, 'datapath-write', dataPathHeader, [
    ...touchOtherRules,
    ...writeCases.flatMap((text, index) => [
      `  Push "$EXEDIR\\written-${index}.txt"`,
      `  Push ${literal(text)}`,
      '  Call WriteDataPathFile',
      `  Push "$EXEDIR\\written-${index}.txt"`,
      '  Call ReadDataPathFile',
      '  Pop $1',
      '  FileWriteUTF16LE $0 "<<$1>>$\\r$\\n"'
    ])
  ], { utf16: true })
  const writeAnswers = [...writeResults.join('\n').matchAll(/<<([\s\S]*?)>>/g)].map(match => stripLine(match[1]))
  report(writeCases, writeAnswers, (text, got = '') => {
    const file = path.join(work, `written-${writeCases.indexOf(text)}.txt`)
    const bytes = fs.existsSync(file) ? fs.readFileSync(file) : Buffer.alloc(0)
    const onDisk = bytes.equals(utf16File(text))
    return {
      ok: onDisk && got === text,
      line: `write ${JSON.stringify(text)} -> file ${onDisk ? 'UTF-16 LE with mark' : `WRONG BYTES ${bytes.toString('hex')}`}, read back ${JSON.stringify(got)}`
    }
  })

  for (const [name, bytes] of readCases) {
    if (bytes) fs.writeFileSync(path.join(work, `read-${name}.txt`), bytes)
  }
  const readResults = runProgram(makensis, work, 'datapath-read', dataPathHeader, [
    ...touchOtherRules,
    '  Push "$EXEDIR\\unused.txt"',
    '  Push "x"',
    '  Call WriteDataPathFile',
    ...readCases.flatMap(([name]) => [
      `  Push "$EXEDIR\\read-${name}.txt"`,
      '  Call ReadDataPathFile',
      '  Pop $1',
      '  FileWriteUTF16LE $0 "<<$1>>$\\r$\\n"'
    ])
  ], { utf16: true })
  // Each answer sits between << and >>, because a line read from a file keeps its own line break.
  const readAnswers = [...readResults.join('\n').matchAll(/<<([\s\S]*?)>>/g)].map(match => stripLine(match[1]))
  report(readCases, readAnswers, ([name, , expected], got = '') => {
    const ok = got === expected
    return { ok, line: `read ${name} -> ${JSON.stringify(got)}${ok ? '' : `  expected ${JSON.stringify(expected)}`}` }
  })

  const total = installCases.length + classifyCases.length + writeCases.length + readCases.length
  console.log(failed === 0 ? `\nAll ${total} cases pass.` : `\n${failed} problem(s).`)
  process.exitCode = failed === 0 ? 0 : 1
} finally {
  fs.rmSync(work, { recursive: true, force: true })
}
