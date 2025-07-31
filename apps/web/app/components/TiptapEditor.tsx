'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import React from 'react'

const TiptapEditor = () => {
  const editor = useEditor({
    extensions: [
      StarterKit,
    ],
    content: '<p>Hello World! 🌎️ Start typing here...</p>',
    // We disable the editor on the server to prevent SSR issues.
    immediatelyRender: false, 
  })

  return (
    <div className="border border-gray-300 rounded-lg p-4">
      <EditorContent className="tiptap" editor={editor} />
    </div>
  )
}

export default TiptapEditor