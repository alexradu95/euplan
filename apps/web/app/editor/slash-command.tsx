import { Editor, Range } from '@tiptap/react'
import { ReactRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Suggestion, { SuggestionProps } from '@tiptap/suggestion'
import tippy, { Instance } from 'tippy.js'
import React from 'react'
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  TextQuote,
} from 'lucide-react'

import CommandList from '../components/CommandList'

// Define the type for each command item
export interface CommandItem {
  title: string
  icon: React.ReactNode
  command: ({ editor, range }: { editor: Editor; range: Range }) => void
}

// Define the command items here, so we can filter them
const commandItems: CommandItem[] = [
  { title: 'Heading 1', icon: <Heading1 size={18} />, command: ({ editor, range }) => { editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run() } },
  { title: 'Heading 2', icon: <Heading2 size={18} />, command: ({ editor, range }) => { editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run() } },
  { title: 'Heading 3', icon: <Heading3 size={18} />, command: ({ editor, range }) => { editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run() } },
  { title: 'Bullet List', icon: <List size={18} />, command: ({ editor, range }) => { editor.chain().focus().deleteRange(range).toggleBulletList().run() } },
  { title: 'Ordered List', icon: <ListOrdered size={18} />, command: ({ editor, range }) => { editor.chain().focus().deleteRange(range).toggleOrderedList().run() } },
  { title: 'Quote', icon: <TextQuote size={18} />, command: ({ editor, range }) => { editor.chain().focus().deleteRange(range).toggleBlockquote().run() } },
]

// This is the custom extension that powers the slash command.
export const SlashCommand = StarterKit.extend({
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',

        items: ({ query }) => {
          return commandItems
            .filter(item => 
              item.title.toLowerCase().startsWith(query.toLowerCase())
            )
            .slice(0, 10); // Limit to 10 results for performance
        },

        command: ({ editor, range, props }) => {
          props.command({ editor, range })
        },

        render: () => {
          let component: ReactRenderer
          let popup: Instance

          return {
            onStart: (props: SuggestionProps) => {
              component = new ReactRenderer(CommandList, {
                props,
                editor: props.editor,
              })

              const clientRect = props.clientRect?.()
              if (!clientRect) {
                return
              }

              popup = tippy(document.body, {
                getReferenceClientRect: () => clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              })
            },

            onUpdate(props: SuggestionProps) {
              component.updateProps(props)

              const clientRect = props.clientRect?.()
              if (!clientRect) {
                return
              }

              popup.setProps({
                getReferenceClientRect: () => clientRect,
              })
            },

            onKeyDown(props: { event: KeyboardEvent }) {
              if (props.event.key === 'Escape') {
                popup.hide()
                return true
              }
              const commandListRef = component.ref as any
              return commandListRef?.onKeyDown(props)
            },

            onExit() {
              popup.destroy()
              component.destroy()
            },
          }
        },
      }),
    ]
  },
})

export default SlashCommand
