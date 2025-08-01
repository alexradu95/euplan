'use client'

import React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'

import { Toolbar } from './Toolbar'
import { SlashCommand } from '../editor/slash-command' // <-- IMPORT our new extension

// The main editor component is now clean and simple
const TiptapEditor = () => {
  const editor = useEditor({
    extensions: [
      SlashCommand,
    ],
    content: '<p>Hello World! 🌎️ Type / for commands...</p>',
    editorProps: {
      attributes: {
        class: 'prose prose-lg focus:outline-none max-w-none',
      },
    },
    immediatelyRender: false,
  })

  return (
    <div className="border border-gray-300 rounded-lg p-4">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}

export default TiptapEditor
