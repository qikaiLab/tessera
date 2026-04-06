import React from 'react'
import { BubbleMenu } from '@tiptap/react'

export function BubbleToolbar({ editor }) {
  if (!editor) return null

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 150, placement: 'top' }}
      shouldShow={({ editor, from, to }) => {
        // Only show when there's a real selection (not just cursor)
        return from !== to && !editor.isActive('codeBlock')
      }}
    >
      <div className="bubble-toolbar">
        <button
          className={`bubble-btn ${editor.isActive('bold') ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="加粗 (Ctrl+B)"
        >
          <b>B</b>
        </button>
        <button
          className={`bubble-btn ${editor.isActive('italic') ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="斜体 (Ctrl+I)"
        >
          <i>I</i>
        </button>
        <button
          className={`bubble-btn ${editor.isActive('underline') ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="下划线 (Ctrl+U)"
        >
          <u>U</u>
        </button>
        <button
          className={`bubble-btn ${editor.isActive('strike') ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="删除线"
        >
          <s>S</s>
        </button>
        <div className="bubble-sep" />
        <button
          className={`bubble-btn ${editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="标题 1"
        >
          H1
        </button>
        <button
          className={`bubble-btn ${editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="标题 2"
        >
          H2
        </button>
        <div className="bubble-sep" />
        <button
          className={`bubble-btn ${editor.isActive('code') ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="行内代码"
        >
          {'</>'}
        </button>
        <button
          className={`bubble-btn ${editor.isActive('blockquote') ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="引用"
        >
          "
        </button>
      </div>
    </BubbleMenu>
  )
}
