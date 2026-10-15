export const DEFAULT_SECTIONS = Object.freeze([
  { id: 'diary', name: '日记', type: 'text', unit: '', resident: true, order: 0 },
  { id: 'running', name: '今日跑步[m]', type: 'number', unit: 'm', resident: false, order: 1 }
])

/**
 * What to run on after reading sections.json (`result` is the file-read result).
 *
 * Only a missing file means "first run" and gets the defaults written. A file that exists but
 * cannot be read or understood is never overwritten: the app runs on the defaults in memory,
 * tells the user, and the file stays on disk (and in the automatic history) until they edit
 * their sections.
 *
 * Returns { sections, writeDefaults, notice, parseError } where `notice` is a toast to show.
 */
export function interpretSectionsFile(result) {
  const defaults = DEFAULT_SECTIONS.map(section => ({ ...section }))
  if (result.ok) {
    try {
      const parsed = JSON.parse(result.data)
      if (!Array.isArray(parsed)) throw new Error('sections.json is not a list')
      return { sections: parsed, writeDefaults: false }
    } catch (parseError) {
      return {
        sections: defaults,
        writeDefaults: false,
        parseError,
        notice: {
          message: '版块配置文件无法读取，已临时使用默认版块。原文件未被改动，可在「设置 → 数据与备份 → 查看自动历史」中找回。',
          duration: 8000
        }
      }
    }
  }
  if (!/ENOENT/.test(result.error || '')) {
    return {
      sections: defaults,
      writeDefaults: false,
      notice: { message: '读取版块配置失败，已临时使用默认版块，未改动原文件。', duration: 6000 }
    }
  }
  return { sections: defaults, writeDefaults: true }
}
