import { useCallback, useState } from 'react'
import { interpretSectionsFile } from './sectionsFile'

const SECTIONS_PATH = 'sections.json'

const writeSections = (sections) => window.api.fs.writeFile(SECTIONS_PATH, JSON.stringify(sections, null, 2))

// The data sections (see sectionsFile.js for what happens when the file is missing or broken).
export function useSections({ showToast }) {
  const [sections, setSections] = useState([])

  const loadSections = useCallback(async () => {
    const outcome = interpretSectionsFile(await window.api.fs.readFile(SECTIONS_PATH))
    if (outcome.parseError) console.error('Failed to parse sections.json:', outcome.parseError)
    if (outcome.writeDefaults) await writeSections(outcome.sections)
    setSections(outcome.sections)
    if (outcome.notice) showToast(outcome.notice.message, 'error', outcome.notice.duration)
    return outcome.sections
  }, [showToast])

  const saveSections = useCallback(async (next) => {
    setSections(next)
    await writeSections(next)
  }, [])

  return { sections, setSections, loadSections, saveSections }
}
