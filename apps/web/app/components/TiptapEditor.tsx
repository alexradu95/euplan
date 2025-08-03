'use client'
import React, { useEffect } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import * as Y from 'yjs'

import { Toolbar } from './Toolbar'
import { SlashCommand } from '../editor/slash-command'
import { EditorBubbleMenu } from './BubbleMenu'
import { useYjs } from '../providers/YjsProvider'
import LoadingSpinner from './LoadingSpinner'

// The main editor component
const TiptapEditor: React.FC = () => {
  const { doc, isLoading, currentDocumentId } = useYjs(); // Get the Y.js document from the provider

  const editor = useEditor({
    extensions: [
      StarterKit,
      SlashCommand,
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-lg focus:outline-none max-w-none',
      },
    },
    immediatelyRender: false,
  }, [doc, currentDocumentId]) // Only recreate when doc or document ID changes

  // Connect the editor to Y.js document manually
  useEffect(() => {
    if (!editor || !doc) return

    // Get the Y.js text object
    const yText = doc.getText('content')
    
    // Load initial content from Y.js into editor
    const initialContent = yText.toString()
    if (initialContent && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent, { emitUpdate: false })
    }

    // Listen for Y.js changes and update editor
    const updateEditor = () => {
      const content = yText.toString()
      if (content !== editor.getHTML()) {
        editor.commands.setContent(content, { emitUpdate: false })
      }
    }

    // Listen for editor changes and update Y.js
    const updateYjs = () => {
      const content = editor.getHTML()
      if (content !== yText.toString()) {
        yText.delete(0, yText.length)
        yText.insert(0, content)
      }
    }

    // Set up event listeners
    yText.observe(updateEditor)
    editor.on('update', updateYjs)

    // Cleanup
    return () => {
      yText.unobserve(updateEditor)
      editor.off('update', updateYjs)
    }
  }, [editor, doc])

  // Show loading state
  if (isLoading || !currentDocumentId) {
    return (
      <div className="relative border border-gray-300 rounded-lg p-4 min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner className="mb-4" />
          <p className="text-gray-500">
            {isLoading ? 'Loading document...' : 'No document selected'}
          </p>
        </div>
      </div>
    );
  }

  if (!editor) {
    return (
      <div className="relative border border-gray-300 rounded-lg p-4 min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner className="mb-4" />
          <p className="text-gray-500">Initializing editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative border border-gray-300 rounded-lg p-4 min-h-[400px]" data-testid="editor-content">
      <Toolbar editor={editor} />
      <EditorBubbleMenu editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}

export default TiptapEditor