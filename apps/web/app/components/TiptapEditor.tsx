'use client'

import React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'

import { Toolbar } from './Toolbar'
import { SlashCommand } from '../editor/slash-command'
import { EditorBubbleMenu } from './BubbleMenu'
import { useYjs } from '../providers/YjsProvider'

// The main editor component
const TiptapEditor = () => {
  const { doc } = useYjs(); // Get the Y.js document from the provider

  const editor = useEditor({
    extensions: [
      // Always include StarterKit for basic schema
      StarterKit,
      // Conditionally add collaboration features when doc is ready
      ...(doc ? [
        Collaboration.configure({
          document: doc,
        }),
        SlashCommand,
      ] : [])
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-lg focus:outline-none max-w-none',
      },
    },
    immediatelyRender: false,
  }, [doc]);

  if (!editor) {
    return (
      <div className="relative border border-gray-300 rounded-lg p-4 min-h-[200px] flex items-center justify-center">
        <p className="text-gray-500">Initializing editor...</p>
      </div>
    );
  }

  return (
    <div className="relative border border-gray-300 rounded-lg p-4">
      <Toolbar editor={editor} />
      <EditorBubbleMenu editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}

export default TiptapEditor