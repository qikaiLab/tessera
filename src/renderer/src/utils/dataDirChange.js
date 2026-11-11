// The wording for moving the data to another folder (Settings → 数据存储). What the main process
// reports about a chosen folder (`plan.kind`, see planDataDirectoryChange) becomes either a
// confirmation the user reads before anything is scheduled, or the reason it cannot be used.

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

const UNUSABLE = {
  'not-absolute': '这个位置不是有效的文件夹路径。',
  unreadable: '无法读取这个文件夹，请检查权限，或换一个位置。',
  'not-a-folder': '所选位置不是文件夹。',
  'not-writable': '无法在这个文件夹里写入，请检查权限，或换一个位置。'
}

/**
 * @returns {{ ok: false, message: string } | { ok: true, copy: boolean, title: string, message: string, confirmText: string }}
 */
export function describeDataDirPlan(plan, { current, target }) {
  switch (plan?.kind) {
    case 'same':
      return { ok: false, message: '所选文件夹就是当前正在使用的数据目录。' }
    case 'nested':
      return { ok: false, message: '新目录不能位于当前数据目录之内，当前数据目录也不能位于新目录之内。请选择一个互不包含的文件夹。' }
    case 'unusable':
      return { ok: false, message: UNUSABLE[plan.reason] || '无法使用这个文件夹，请换一个位置。' }
    case 'foreign':
      return { ok: false, message: '所选文件夹里已有其他文件，又不是 Tessera 的数据目录。为避免弄混，请选择一个空文件夹，或新建一个文件夹。' }
    case 'empty':
    case 'resume': {
      const size = formatBytes(plan.bytes)
      return {
        ok: true,
        copy: true,
        title: '移动数据目录',
        confirmText: '下次启动时复制',
        message: [
          `将把当前数据（${plan.files} 个文件${size ? `，共 ${size}` : ''}）复制到：`,
          target,
          '',
          '复制在下次启动软件时进行，并逐个文件核对，核对无误才会改用新位置。',
          `当前目录（${current}）里的数据不会被删除或改动，作为备份保留，确认新位置一切正常后可自行清理。`,
          plan.kind === 'resume' ? '\n这个文件夹里有一次未完成的复制，将重新完整复制一遍。' : ''
        ].join('\n').trimEnd()
      }
    }
    case 'existing':
      return {
        ok: true,
        copy: false,
        title: '改用已有的数据目录',
        confirmText: '下次启动时改用',
        message: [
          `所选文件夹已有 Tessera 数据（${plan.files} 个文件）：`,
          target,
          '',
          '下次启动时将直接使用它，不会复制，也不会与当前数据合并。',
          `当前目录（${current}）里的数据不会被删除，之后可以再切换回去。`
        ].join('\n')
      }
    default:
      return { ok: false, message: '无法判断这个文件夹是否可用，请换一个位置。' }
  }
}

// What to tell the user after a start that carried out (or tried to carry out) a requested move.
export function describeDataDirNotice(notice) {
  if (!notice) return null
  if (notice.kind === 'switched') {
    return {
      type: 'success',
      message: notice.copied
        ? `数据已复制并核对完成，现在使用新的数据目录：${notice.to}。原目录的数据未改动，仍保留在 ${notice.from}。`
        : `现在使用已有的数据目录：${notice.to}。原目录的数据未改动，仍保留在 ${notice.from}。`
    }
  }
  if (notice.kind === 'relocated') {
    return { type: 'info', message: `原数据目录（${notice.from}）无法使用，本次改用你选择的文件夹：${notice.to}。` }
  }
  if (notice.kind === 'failed') {
    const why = notice.reason === 'stale'
      ? '这次更改是在另一个数据目录下提出的，已经过期。'
      : `原因：${notice.error}`
    return { type: 'error', message: `更改数据目录没有完成，仍在使用 ${notice.from}，其中的数据没有受到影响。${why}` }
  }
  return null
}
