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

export const SlashExtension = Extension.create({
  name: 'slashCommand',
  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }) => {
          props.command({ editor, range })
        },
        items: ({ query }) => {
          return slashCommands.filter(item =>
            item.title.toLowerCase().includes(query.toLowerCase()) ||
            item.description.toLowerCase().includes(query.toLowerCase())
          ).slice(0, 10)
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
                  container.style.left = `${rect.left}px`
                  container.style.top = `${rect.bottom + 6}px`
                }
              }
            },
            onUpdate(props) {
              component.updateProps(props)
              if (props.clientRect) {
                const rect = props.clientRect()
                if (rect) {
                  container.style.left = `${rect.left}px`
                  container.style.top = `${rect.bottom + 6}px`
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
