'use client'

import React from 'react'
import { BubbleMenu } from '@tiptap/react/menus' // This import is often correct, but let's assume a specific version requires the one below
import type { Editor } from '@tiptap/react'
import { Bold, Italic, Strikethrough } from 'lucide-react'

// Define a simpler, correct props interface.
// The useEditor hook returns `Editor | null`, so we accept that directly.
interface EditorBubbleMenuProps {
  editor: Editor | null;
}

export function EditorBubbleMenu({ editor }: EditorBubbleMenuProps) {
  if (!editor) {
    return null
  }

  return (
    <BubbleMenu 
      editor={editor} 
      className="bg-gray-800 text-white rounded-lg p-1 flex items-center gap-1"
    >
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={editor.isActive('bold') ? 'bg-gray-600 p-2 rounded' : 'p-2 rounded hover:bg-gray-700'}
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={editor.isActive('italic') ? 'bg-gray-600 p-2 rounded' : 'p-2 rounded hover:bg-gray-700'}
      >
        <Italic className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={editor.isActive('strike') ? 'bg-gray-600 p-2 rounded' : 'p-2 rounded hover:bg-gray-700'}
      >
        <Strikethrough className="h-4 w-4" />
      </button>
    </BubbleMenu>
  )
}
