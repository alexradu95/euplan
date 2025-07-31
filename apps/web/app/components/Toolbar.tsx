'use client'

import React from 'react'
import type { Editor } from '@tiptap/react'
import {
  Bold,
  Strikethrough,
  Italic,
  List,
  ListOrdered,
  Heading2,
} from 'lucide-react'

type Props = {
  editor: Editor | null
}

export function Toolbar({ editor }: Props) {
  if (!editor) {
    return null
  }

  return (
    <div className="border border-gray-300 rounded-lg p-2 flex items-center gap-1 mb-4">
      {/* Bold Button */}
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={editor.isActive('bold') ? 'bg-gray-200 p-2 rounded-lg' : 'p-2 rounded-lg hover:bg-gray-100'}
      >
        <Bold className="h-4 w-4" />
      </button>

      {/* Italic Button */}
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={editor.isActive('italic') ? 'bg-gray-200 p-2 rounded-lg' : 'p-2 rounded-lg hover:bg-gray-100'}
      >
        <Italic className="h-4 w-4" />
      </button>

      {/* Strikethrough Button */}
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        className={editor.isActive('strike') ? 'bg-gray-200 p-2 rounded-lg' : 'p-2 rounded-lg hover:bg-gray-100'}
      >
        <Strikethrough className="h-4 w-4" />
      </button>
      
      {/* Heading Button */}
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 p-2 rounded-lg' : 'p-2 rounded-lg hover:bg-gray-100'}
      >
        <Heading2 className="h-4 w-4" />
      </button>

      {/* Bullet List Button */}
       <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={editor.isActive('bulletList') ? 'bg-gray-200 p-2 rounded-lg' : 'p-2 rounded-lg hover:bg-gray-100'}
      >
        <List className="h-4 w-4" />
      </button>

      {/* Ordered List Button */}
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={editor.isActive('orderedList') ? 'bg-gray-200 p-2 rounded-lg' : 'p-2 rounded-lg hover:bg-gray-100'}
      >
        <ListOrdered className="h-4 w-4" />
      </button>
    </div>
  )
}