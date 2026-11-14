import fs from 'node:fs'
import path from 'node:path'

// File-system helpers for the data directory. They know the layout (a day is <year>/<month>/
// <day>.json, backups live in backups/) but nothing about Electron, so they can be tested alone.

const fsp = fs.promises
const MAX_BACKUPS = 30

export async function ensureDir(dir) {
  try {
    await fsp.mkdir(dir, { recursive: true })
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
  }
}

export function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// The entries of a directory; a directory that does not exist yet is simply empty.
export async function readDirOrEmpty(dir) {
  try {
    return await fsp.readdir(dir)
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

async function readDirQuietly(dir, what) {
  try {
    return await fsp.readdir(dir)
  } catch (error) {
    console.error(`Failed to read ${what} ${dir}:`, error)
    return []
  }
}

// A name made of digits is not yet a day: "2025/13/01.json" and "2025/02/30.json" exist as files
// but on no calendar, and a date nothing can format would take the timeline page down with it.
function isCalendarDay(year, month, day) {
  const date = new Date(0)
  date.setUTCFullYear(Number(year), Number(month) - 1, Number(day))
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day)
}

// Every day that has a file, as yyyy-MM-dd (whether or not the file has anything in it). Files
// whose names are not a real calendar day are left alone and not listed.
export async function scanDayDates(dataDir) {
  const dates = []
  const years = (await readDirQuietly(dataDir, 'data dir')).filter(name => /^\d{4}$/.test(name))
  for (const year of years) {
    const yearPath = path.join(dataDir, year)
    const months = (await readDirQuietly(yearPath, 'year dir')).filter(name => /^\d{2}$/.test(name))
    for (const month of months) {
      const monthPath = path.join(yearPath, month)
      const days = (await readDirQuietly(monthPath, 'month dir')).filter(name => /^\d{2}\.json$/.test(name))
      for (const dayFile of days) {
        const day = dayFile.replace('.json', '')
        if (isCalendarDay(year, month, day)) dates.push(`${year}-${month}-${day}`)
      }
    }
  }
  return dates
}

// Temporary files a crash left behind (a write is a .tmp file replaced atomically). The backups
// folder is not scanned: it holds ZIP files and the automatic history, whose own leftovers are
// swept by the history store and can never be "recovered" as data.
export async function findTemporaryFiles(dataDir) {
  const found = []
  async function scan(dir) {
    let entries
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true })
    } catch (error) {
      console.error(`Failed to scan for tmp files in ${dir}:`, error)
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (dir === dataDir && entry.name.toLowerCase() === 'backups') continue
        await scan(full)
      } else if (entry.name.endsWith('.tmp')) found.push(full)
    }
  }
  await scan(dataDir)
  return found
}

// Every JSON file of the data directory (relative path + content), except the backups folder.
// A folder or file that cannot be read fails the whole call: a backup that silently leaves part
// of the data out would look complete and be useless when it is needed.
export async function collectJsonFiles(dataDir) {
  const files = []
  async function collect(dir, base = '') {
    const entries = await fsp.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      const relative = base ? `${base}/${entry.name}` : entry.name
      if (entry.isDirectory() && entry.name !== 'backups') {
        await collect(full, relative)
      } else if (entry.name.endsWith('.json') && !base.startsWith('backups')) {
        files.push({ path: relative, content: await fsp.readFile(full, 'utf8') })
      }
    }
  }
  await collect(dataDir)
  return files
}

export function backupFileName(date = new Date()) {
  return `backup-${date.toISOString().replace(/[:.]/g, '-').slice(0, 19)}.zip`
}

// Writes a backup (base64 ZIP) and keeps only the newest `keep` backups of its folder.
export async function writeBackupZip(backupPath, base64Data, keep = MAX_BACKUPS) {
  await fsp.writeFile(backupPath, Buffer.from(base64Data, 'base64'))
  const folder = path.dirname(backupPath)
  const backups = (await fsp.readdir(folder))
    .filter(name => name.startsWith('backup-') && name.endsWith('.zip'))
    .sort()
  for (const name of backups.slice(0, Math.max(0, backups.length - keep))) {
    await fsp.unlink(path.join(folder, name))
  }
}

// The ZIP backups of a folder, newest first.
export async function listBackups(backupDir) {
  const names = (await readDirOrEmpty(backupDir)).filter(name => name.endsWith('.zip')).sort().reverse()
  const backups = []
  for (const name of names) {
    const filePath = path.join(backupDir, name)
    const stat = await fsp.stat(filePath)
    backups.push({ name, path: filePath, size: stat.size, date: stat.mtime.toISOString() })
  }
  return backups
}
