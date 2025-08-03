'use client'

import React, { memo, useMemo } from 'react'
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

// Individual toolbar button component to minimize re-renders
const ToolbarButton = memo<{
  icon: React.ComponentType<{ className?: string }>
  isActive: boolean
  isDisabled: boolean
  onClick: () => void
  'aria-label': string
}>(({ icon: Icon, isActive, isDisabled, onClick, 'aria-label': ariaLabel }) => (
  <button
    onClick={onClick}
    disabled={isDisabled}
    aria-label={ariaLabel}
    className={isActive ? 'bg-gray-200 p-2 rounded-lg' : 'p-2 rounded-lg hover:bg-gray-100'}
  >
    <Icon className="h-4 w-4" />
  </button>
))

ToolbarButton.displayName = 'ToolbarButton'

export const Toolbar = memo<Props>(({ editor }) => {
  if (!editor) {
    return null
  }

  // Memoize button states to reduce re-calculation on every render
  const buttonStates = useMemo(() => ({
    bold: {
      isActive: editor.isActive('bold'),
      isDisabled: !editor.can().chain().focus().toggleBold().run()
    },
    italic: {
      isActive: editor.isActive('italic'),
      isDisabled: !editor.can().chain().focus().toggleItalic().run()
    },
    strike: {
      isActive: editor.isActive('strike'),
      isDisabled: !editor.can().chain().focus().toggleStrike().run()
    },
    heading: {
      isActive: editor.isActive('heading', { level: 2 }),
      isDisabled: false
    },
    bulletList: {
      isActive: editor.isActive('bulletList'),
      isDisabled: false
    },
    orderedList: {
      isActive: editor.isActive('orderedList'),
      isDisabled: false
    }
  }), [editor])

  // Memoize click handlers to prevent function recreation
  const handlers = useMemo(() => ({
    bold: () => editor.chain().focus().toggleBold().run(),
    italic: () => editor.chain().focus().toggleItalic().run(),
    strike: () => editor.chain().focus().toggleStrike().run(),
    heading: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    bulletList: () => editor.chain().focus().toggleBulletList().run(),
    orderedList: () => editor.chain().focus().toggleOrderedList().run()
  }), [editor])

  return (
    <div className="border border-gray-300 rounded-lg p-2 flex items-center gap-1 mb-4">
      <ToolbarButton
        icon={Bold}
        isActive={buttonStates.bold.isActive}
        isDisabled={buttonStates.bold.isDisabled}
        onClick={handlers.bold}
        aria-label="Toggle bold"
      />
      
      <ToolbarButton
        icon={Italic}
        isActive={buttonStates.italic.isActive}
        isDisabled={buttonStates.italic.isDisabled}
        onClick={handlers.italic}
        aria-label="Toggle italic"
      />
      
      <ToolbarButton
        icon={Strikethrough}
        isActive={buttonStates.strike.isActive}
        isDisabled={buttonStates.strike.isDisabled}
        onClick={handlers.strike}
        aria-label="Toggle strikethrough"
      />
      
      <ToolbarButton
        icon={Heading2}
        isActive={buttonStates.heading.isActive}
        isDisabled={buttonStates.heading.isDisabled}
        onClick={handlers.heading}
        aria-label="Toggle heading"
      />
      
      <ToolbarButton
        icon={List}
        isActive={buttonStates.bulletList.isActive}
        isDisabled={buttonStates.bulletList.isDisabled}
        onClick={handlers.bulletList}
        aria-label="Toggle bullet list"
      />
      
      <ToolbarButton
        icon={ListOrdered}
        isActive={buttonStates.orderedList.isActive}
        isDisabled={buttonStates.orderedList.isDisabled}
        onClick={handlers.orderedList}
        aria-label="Toggle ordered list"
      />
    </div>
  )
})

Toolbar.displayName = 'Toolbar'