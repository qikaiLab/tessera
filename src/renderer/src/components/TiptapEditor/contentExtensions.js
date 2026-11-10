import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { TableKit } from '@tiptap/extension-table'
import { isLocalFileHref } from '../../utils/localFileLinks'

// Links do not grow when typing at their end.
const ExternalLink = Link.extend({ inclusive: false })

/**
 * The extensions that define what a document can contain (its schema). They carry no editing
 * behaviour or UI, so the Markdown parser and the unit tests can use them without an editor.
 */
export function buildContentExtensions() {
  return [
    StarterKit.configure({
      // Link and Underline come with the StarterKit; the versions below replace them, so they must
      // not be registered twice (a second link plugin also opened links on its own).
      link: false,
      underline: false,
      bulletList: { keepMarks: true, keepAttributes: false },
      orderedList: { keepMarks: true, keepAttributes: false },
      hardBreak: { keepMarks: true }
    }),
    Underline,
    ExternalLink.configure({
      autolink: true,
      linkOnPaste: true,
      openOnClick: false,
      protocols: ['http', 'https', 'mailto', 'tel'],
      // Links to a file or folder on this computer are stored as file:/// URLs.
      isAllowedUri: (url, { defaultValidate }) => defaultValidate(url) || isLocalFileHref(url),
      HTMLAttributes: { rel: 'noopener noreferrer', target: null }
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    // Resizable so a wide table gets drag handles and scrolls inside its own wrapper.
    TableKit.configure({ table: { resizable: true, cellMinWidth: 72 } })
  ]
}
