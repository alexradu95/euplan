'use client'
import React, { useEffect, useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

import { Toolbar } from './Toolbar'
import { SlashCommand } from '../editor/slash-command'
import { EditorBubbleMenu } from './BubbleMenu'
import LoadingSpinner from './LoadingSpinner'

interface TiptapEditorProps {
  documentId: string
  initialContent?: string
  onContentChange?: (content: string) => void
}

// The main editor component
const TiptapEditor: React.FC<TiptapEditorProps> = ({ 
  documentId, 
  initialContent = '', 
  onContentChange 
}) => {
  const [isLoading, setIsLoading] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      SlashCommand,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'prose prose-lg focus:outline-none max-w-none',
      },
    },
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const content = editor.getHTML()
      onContentChange?.(content)
    },
  })

  // Update editor content when initialContent changes (e.g., document switch)
  useEffect(() => {
    if (editor && initialContent && editor.getHTML() !== initialContent) {
      editor.commands.setContent(initialContent, { emitUpdate: false })
    }
  }, [editor, initialContent])

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