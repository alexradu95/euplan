# Phase 3: UI Simplification
**Timeline:** Day 2 Afternoon (3 hours)
**Goal:** Remove collaboration UI elements and simplify components

## Step 3.1: Simplify Document Header (45 minutes)

### 3.1.1 Update DocumentHeader Component
**File:** `apps/web/components/DocumentHeader.tsx`

**Remove these elements:**
- Connection status indicators ("Connected", "Disconnected", "Connecting...")
- Real-time sync status
- Connected users count/avatars
- WebSocket error messages
- Collaboration-specific buttons

**Update to show only:**
- Document title (editable)
- Save status (Saving... / Saved / Error)
- Last saved timestamp
- User menu/logout
- Document navigation

```typescript
'use client'

import { useState } from 'react'
import { useYjs } from '@/providers/YjsProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, Loader, AlertCircle, Save } from 'lucide-react'

export default function DocumentHeader() {
  const { saveStatus, lastSaved, manualSave } = useYjs()
  const [isEditingTitle, setIsEditingTitle] = useState(false)

  const formatRelativeTime = (date: Date) => {
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) return 'just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <header className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Document Title */}
        <div className="flex items-center space-x-4">
          {isEditingTitle ? (
            <Input
              defaultValue="Document Title"
              className="text-lg font-semibold"
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditingTitle(false)
                }
              }}
              autoFocus
            />
          ) : (
            <h1
              className="text-lg font-semibold cursor-pointer hover:text-blue-600"
              onClick={() => setIsEditingTitle(true)}
            >
              Document Title
            </h1>
          )}
        </div>

        {/* Save Status and Actions */}
        <div className="flex items-center space-x-4">
          {/* Save Status Indicator */}
          <div className="flex items-center space-x-2">
            {saveStatus === 'saving' && (
              <div className="flex items-center space-x-1 text-blue-600">
                <Loader className="h-4 w-4 animate-spin" />
                <span className="text-sm">Saving...</span>
              </div>
            )}
            
            {saveStatus === 'saved' && lastSaved && (
              <div className="flex items-center space-x-1 text-green-600">
                <Check className="h-4 w-4" />
                <span className="text-sm">
                  Saved {formatRelativeTime(lastSaved)}
                </span>
              </div>
            )}
            
            {saveStatus === 'error' && (
              <div className="flex items-center space-x-1 text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Save failed</span>
              </div>
            )}
            
            {saveStatus === 'idle' && (
              <span className="text-sm text-gray-500">Ready</span>
            )}
          </div>

          {/* Manual Save Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => manualSave()}
            disabled={saveStatus === 'saving'}
          >
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>

          {/* User Menu - Keep existing implementation */}
          {/* Your existing user menu component */}
        </div>
      </div>
    </header>
  )
}
```

### 3.1.2 Remove Collaboration Status Components
Delete these files if they exist:
```bash
# Remove collaboration-specific components
rm apps/web/components/ConnectionStatus.tsx
rm apps/web/components/ConnectedUsers.tsx
rm apps/web/components/UserPresence.tsx
rm apps/web/components/CollaborationIndicator.tsx
```

## Step 3.2: Simplify Tiptap Editor (60 minutes)

### 3.2.1 Update TiptapEditor Component
**File:** `apps/web/components/TiptapEditor.tsx`

**Remove these extensions:**
- Collaboration extension
- CollaborationCursor extension
- Any awareness/presence extensions

**Keep these extensions:**
- All formatting extensions (Bold, Italic, etc.)
- History extension (for undo/redo)
- Any other non-collaboration extensions

```typescript
'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { useEffect } from 'react'
import { useYjs } from '@/providers/YjsProvider'

// Core extensions (keep these)
import StarterKit from '@tiptap/starter-kit'
import { History } from '@tiptap/extension-history'
import { Collaboration } from '@tiptap/extension-collaboration'

// Remove these collaboration extensions:
// import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor'

export default function TiptapEditor() {
  const { doc } = useYjs()

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable the default history since we're using Y.js
        history: false,
      }),
      // Keep Y.js collaboration for undo/redo, but without cursors
      Collaboration.configure({
        document: doc,
      }),
      // Keep History extension for enhanced undo/redo
      History,
      // Remove: CollaborationCursor extension
      // Keep: Any other formatting extensions you have
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[500px] px-6 py-4',
      },
    },
  })

  // Update editor when document changes
  useEffect(() => {
    if (editor && doc) {
      editor.commands.setContent('') // Will be populated by Y.js
    }
  }, [editor, doc])

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading editor...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <EditorContent editor={editor} />
    </div>
  )
}
```

### 3.2.2 Remove Collaboration Toolbar Items
**File:** `apps/web/components/Toolbar.tsx`

**Remove:**
- User presence indicators
- Collaboration-specific buttons
- Real-time sync controls

**Keep:**
- All formatting buttons (Bold, Italic, Headings, etc.)
- Undo/Redo buttons
- Document management buttons

## Step 3.3: Simplify Main Layout (30 minutes)

### 3.3.1 Update Editor Page Layout
**File:** `apps/web/app/editor/[documentId]/page.tsx`

**Remove:**
- Collaboration setup logic
- WebSocket connection initialization  
- User presence components
- Real-time status displays

**Keep:**
- Document loading logic
- Editor initialization
- Basic layout structure

### 3.3.2 Update Root Layout (if needed)
**File:** `apps/web/app/layout.tsx`

**Remove:**
- WebSocket provider wrappers
- Collaboration context providers

**Keep:**
- YjsProvider (our simplified version)
- Authentication providers
- Basic app layout

## Step 3.4: Remove Collaboration Pages/Components (30 minutes)

### 3.4.1 Delete Collaboration-Specific Pages
```bash
# Remove sharing/collaboration pages
rm -rf apps/web/app/share/
rm -rf apps/web/app/collaborate/
```

### 3.4.2 Delete Unused Components
```bash
# Remove collaboration UI components
rm apps/web/components/ShareDialog.tsx
rm apps/web/components/InviteUsers.tsx
rm apps/web/components/PermissionSettings.tsx
rm apps/web/components/UserAvatar.tsx  # If only used for collaboration
```

### 3.4.3 Clean Up Component Imports
Search and remove imports for deleted components:
```bash
# Find files that import deleted components
grep -r "ShareDialog\|InviteUsers\|PermissionSettings" apps/web/
```

## Step 3.5: Update Loading States (45 minutes)

### 3.5.1 Create Simple Loading Spinner
**File:** `apps/web/components/LoadingSpinner.tsx`

```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
}

export default function LoadingSpinner({ size = 'md', text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8', 
    lg: 'h-12 w-12'
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]}`} />
      {text && <p className="text-sm text-gray-600">{text}</p>}
    </div>
  )
}
```

### 3.5.2 Update Loading States in Editor
**File:** `apps/web/app/editor/[documentId]/page.tsx`

Replace complex connection states with simple loading:

```typescript
'use client'

import { useEffect } from 'react'
import { useYjs } from '@/providers/YjsProvider'
import { useParams } from 'next/navigation'
import TiptapEditor from '@/components/TiptapEditor'
import DocumentHeader from '@/components/DocumentHeader'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function EditorPage() {
  const { documentId } = useParams()
  const { switchDocument, isLoading, doc } = useYjs()

  useEffect(() => {
    if (documentId && typeof documentId === 'string') {
      switchDocument(documentId)
    }
  }, [documentId, switchDocument])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner size="lg" text="Loading document..." />
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600">Failed to load document</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 text-blue-600 hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      <DocumentHeader />
      <div className="flex-1 overflow-hidden">
        <TiptapEditor />
      </div>
    </div>
  )
}
```

## ✅ Validation Checklist

After completing Phase 3:

- [ ] DocumentHeader shows only save status, no connection status
- [ ] TiptapEditor works without collaboration extensions
- [ ] All collaboration-specific components removed
- [ ] Loading states simplified
- [ ] No WebSocket or real-time UI elements visible
- [ ] App UI is clean and focused on single-user editing

## 🧪 Test Phase 3

```bash
cd apps/web
pnpm dev
```

**Test in browser:**
1. Editor should look clean without collaboration elements
2. Save status should show clearly (Saving... / Saved)
3. No connection status indicators
4. No user presence indicators
5. Undo/redo should still work perfectly
6. All formatting tools should work

**Expected State After Phase 3:**
- ✅ Clean, single-user focused UI
- ✅ Clear save status indicators
- ✅ No collaboration elements visible
- ✅ Y.js editor functionality intact
- ✅ Professional, simple appearance

## 📝 Commit Your Progress

```bash
git add .
git commit -m "Phase 3: Simplify UI to remove collaboration elements

- Updated DocumentHeader to show only save status
- Removed collaboration extensions from TiptapEditor
- Deleted collaboration-specific components and pages
- Simplified loading states
- UI now focused on single-user document editing
- Maintained all core editor functionality"
```

---
**Next:** Proceed to `04_database_cleanup.md` to simplify the database schema.