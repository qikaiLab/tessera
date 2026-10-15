import JSZip from 'jszip'

// Backups and exports are ZIP files of the data directory's JSON files, passed between the
// main and renderer processes as base64.

export async function zipFilesToBase64(files) {
  const zip = new JSZip()
  files.forEach(file => zip.file(file.path, file.content))
  return zip.generateAsync({ type: 'base64' })
}

// The JSON files an import should restore: everything except the app's own backup folder.
export async function readArchiveJsonEntries(base64Data) {
  const zip = await JSZip.loadAsync(base64Data, { base64: true })
  const entries = []
  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir || !path.endsWith('.json') || path.startsWith('backups/')) continue
    entries.push({ path, text: await file.async('string') })
  }
  return entries
}
