import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import { SlashMenuView } from './SlashMenu'

export const slashCommands = [
  {
    title: '文本',
    description: '普通段落文本',
    icon: '¶',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run()
    },
  },
  {
    title: '标题 1',
    description: '大标题',
    icon: 'H1',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run()
    },
  },
  {
    title: '标题 2',
    description: '中等标题',
    icon: 'H2',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run()
    },
  },
  {
    title: '标题 3',
    description: '小标题',
    icon: 'H3',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run()
    },
  },
  {
    title: '无序列表',
    description: '项目符号列表',
    icon: '•',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    title: '有序列表',
    description: '编号列表',
    icon: '1.',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
  },
  {
    title: '任务列表',
    description: '可勾选的任务清单',
    icon: '☑',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run()
    },
  },
  {
    title: '引用块',
    description: '引用或重要内容',
    icon: '"',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run()
    },
  },
  {
    title: '代码块',
    description: '代码或等宽文本',
    icon: '</>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
    },
  },
  {
    title: '分割线',
    description: '水平分隔线',
    icon: '—',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
    },
  },
]

/**
 * Smart position function: places the menu at cursor, but flips above if
 * it would overflow the viewport bottom, and clamps horizontally.
 *
 * Fix: use container.offsetHeight (actual rendered height) rather than the
 * hardcoded MENU_MAX_HEIGHT fallback so the flip threshold is always exact.
 * On first call the element may not be in the DOM yet, so we fall back to
 * the CSS max-height (340 px) only in that case.
 */
function getSmartPosition(rect, container) {
  const MENU_WIDTH     = 260
  const MENU_MAX_HEIGHT = 340  // mirrors CSS max-height — fallback only
  const GAP            = 8
  const VIEWPORT_MARGIN = 8

  const viewportW = window.innerWidth
  const viewportH = window.innerHeight

  // Actual rendered height if available, otherwise conservative fallback
  const menuH = (container && container.offsetHeight > 0)
    ? container.offsetHeight
    : MENU_MAX_HEIGHT

  // ── Horizontal: start at cursor left, then clamp ──────────────────────────
  let left = rect.left
  if (left + MENU_WIDTH > viewportW - VIEWPORT_MARGIN) {
    left = viewportW - MENU_WIDTH - VIEWPORT_MARGIN
  }
  left = Math.max(VIEWPORT_MARGIN, left)

  // ── Vertical: prefer below cursor; flip above when space is insufficient ──
  const spaceBelow = viewportH - rect.bottom - GAP
  const spaceAbove = rect.top   - GAP

  let top
  if (spaceBelow >= menuH || spaceBelow >= spaceAbove) {
    // Enough room below (or more than above) → show below
    top = rect.bottom + GAP
    // Hard-clamp: if menu would still overflow the bottom, pull it up
    if (top + menuH > viewportH - VIEWPORT_MARGIN) {
      top = viewportH - menuH - VIEWPORT_MARGIN
    }
  } else {
    // Flip above — anchor bottom of menu to cursor top
    top = rect.top - GAP - menuH
    top = Math.max(VIEWPORT_MARGIN, top)
  }

  return { left: Math.round(left), top: Math.round(top) }
}

export const SlashExtension = Extension.create({
  name: 'slashCommand',
  addOptions() {
    return {
      suggestion: {
        char: '/',
        // Allow "/" anywhere (not just at line start)
        allowedPrefixes: null,
        command: ({ editor, range, props }) => {
          props.command({ editor, range })
        },
        items: ({ query }) => {
          return slashCommands
            .filter(
              item =>
                item.title.toLowerCase().includes(query.toLowerCase()) ||
                item.description.toLowerCase().includes(query.toLowerCase()),
            )
            .slice(0, 10)
        },
        render: () => {
          let component
          let container

          return {
            onStart: props => {
              container = document.createElement('div')
              container.style.cssText = `
                position: fixed;
                z-index: 9999;
                pointer-events: auto;
              `
              document.body.appendChild(container)

              component = new ReactRenderer(SlashMenuView, {
                props,
                editor: props.editor,
              })
              container.appendChild(component.element)

              if (props.clientRect) {
                const rect = props.clientRect()
                if (rect) {
                  // Re-run after one frame so container.offsetHeight is available
                  requestAnimationFrame(() => {
                    const { left, top } = getSmartPosition(rect, container)
                    container.style.left = `${left}px`
                    container.style.top  = `${top}px`
                  })
                }
              }
            },
            onUpdate(props) {
              component.updateProps(props)
              if (props.clientRect) {
                const rect = props.clientRect()
                if (rect) {
                  const { left, top } = getSmartPosition(rect, container)
                  container.style.left = `${left}px`
                  container.style.top = `${top}px`
                }
              }
            },
            onKeyDown(props) {
              if (props.event.key === 'Escape') {
                if (container) {
                  container.remove()
                  component.destroy()
                }
                return true
              }
              return component.ref?.onKeyDown(props) ?? false
            },
            onExit() {
              if (container) {
                container.remove()
              }
              if (component) {
                component.destroy()
              }
            },
          }
        },
      },
    }
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})
