import fs from 'node:fs'
import path from 'node:path'

// The contract tests assert on source text. They read a feature as a whole (a file or a folder)
// so that splitting a big file into smaller ones does not break them.
export function readSource(...files) {
  return files.map(file => fs.readFileSync(path.resolve(file), 'utf8')).join('\n')
}

export function readTree(directory, extensions) {
  const root = path.resolve(directory)
  const files = []
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (extensions.includes(path.extname(entry.name))) files.push(full)
    }
  }
  walk(root)
  return files.map(file => fs.readFileSync(file, 'utf8')).join('\n')
}

// A stylesheet with its local @import lines replaced by the files they import, in order, the
// way the bundler reads it (the entry stylesheet only lists the files it is made of).
export function readStylesheet(file) {
  const full = path.resolve(file)
  const localImport = /^@import\s+'(\.[^']+)';[ \t]*\r?\n?/gm
  return fs.readFileSync(full, 'utf8').replace(localImport, (_, relative) => (
    readStylesheet(path.join(path.dirname(full), relative))
  ))
}
