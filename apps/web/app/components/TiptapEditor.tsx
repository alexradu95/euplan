'use client'
import React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'

import { Toolbar } from './Toolbar'
import { SlashCommand } from '../editor/slash-command'
import { EditorBubbleMenu } from './BubbleMenu'
import { useYjs } from '../providers/YjsProvider'
import LoadingSpinner from './LoadingSpinner'

// The main editor component
const TiptapEditor = () => {
  const { doc, isLoading, currentDocumentId } = useYjs(); // Get the Y.js document from the provider

  const editor = useEditor({
    extensions: [
      StarterKit,
      SlashCommand,
      ...(doc ? [
        Collaboration.configure({
          document: doc,
        }),
      ] : [])
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-lg focus:outline-none max-w-none',
      },
    },
    immediatelyRender: false,
  }, [doc, currentDocumentId]) // Only recreate when doc or document ID changes

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