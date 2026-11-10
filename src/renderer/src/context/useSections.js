import { useCallback, useRef, useState } from 'react'
import { interpretSectionsFile } from './sectionsFile'

const SECTIONS_PATH = 'sections.json'

const writeSections = (sections) => window.api.fs.writeFile(SECTIONS_PATH, JSON.stringify(sections, null, 2))

// The data sections (see sectionsFile.js for what happens when the file is missing or broken).
export function useSections({ showToast }) {
  const [sections, setSections] = useState([])
  // What the screen last showed, to put back when a write fails.
  const sectionsRef = useRef([])

  const loadSections = useCallback(async () => {
    const outcome = interpretSectionsFile(await window.api.fs.readFile(SECTIONS_PATH))
    if (outcome.parseError) console.error('Failed to parse sections.json:', outcome.parseError)
    if (outcome.writeDefaults) {
      const written = await writeSections(outcome.sections)
      if (!written.ok) showToast('无法写入默认版块文件，当前先使用默认版块；请检查磁盘空间或文件权限', 'error', 8000)
    }
    setSections(outcome.sections)
    sectionsRef.current = outcome.sections
    if (outcome.notice) showToast(outcome.notice.message, 'error', outcome.notice.duration)
    return outcome.sections
  }, [showToast])

  // Returns true when the change reached the file. When it did not, the previous sections are
  // shown again (the screen must not claim a change that would be gone after a restart).
  const saveSections = useCallback(async (next) => {
    const previous = sectionsRef.current
    setSections(next)
    sectionsRef.current = next
    let written
    try {
      written = await writeSections(next)
    } catch (error) {
      written = { ok: false, error: error.message }
    }
    if (written.ok) return true
    if (sectionsRef.current === next) {
      setSections(previous)
      sectionsRef.current = previous
    }
    showToast(`版块设置保存失败，改动未生效：${written.error || '未知错误'}`, 'error', 8000)
    return false
  }, [showToast])

  return { sections, setSections, loadSections, saveSections }
}
