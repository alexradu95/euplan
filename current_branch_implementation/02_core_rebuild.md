# Phase 2: Core Rebuild
**Timeline:** Day 2 Morning (3 hours)
**Goal:** Rebuild YjsProvider and implement simple auto-save persistence

## Step 2.1: Create Simple Auto-Save API Route (45 minutes)

### 2.1.1 Create Auto-Save Endpoint
**File:** `apps/web/app/api/documents/[id]/autosave/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const { encryptedContent } = await request.json()
    
    if (!encryptedContent) {
      return NextResponse.json({ error: 'Content required' }, { status: 400 })
    }

    // Verify user owns this document
    const existingDoc = await db
      .select({ userId: documents.userId })
      .from(documents)
      .where(eq(documents.id, params.id))
      .limit(1)

    if (!existingDoc[0] || existingDoc[0].userId !== session.user.id) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Save document
    await db
      .update(documents)
      .set({
        encryptedContent,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, params.id))

    return NextResponse.json({ 
      success: true,
      savedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Auto-save error:', error)
    return NextResponse.json(
      { error: 'Failed to save document' },
      { status: 500 }
    )
  }
}
```

### 2.1.2 Update Document Loading API
**File:** `apps/web/app/api/documents/[id]/route.ts`

Make sure GET endpoint works for loading documents:

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const document = await db
      .select()
      .from(documents)
      .where(eq(documents.id, params.id))
      .limit(1)

    if (!document[0] || document[0].userId !== session.user.id) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json(document[0])
  } catch (error) {
    console.error('Document load error:', error)
    return NextResponse.json(
      { error: 'Failed to load document' },
      { status: 500 }
    )
  }
}
```

## Step 2.2: Create Document Persistence Hook (60 minutes)

### 2.2.1 Create useDocumentPersistence Hook
**File:** `apps/web/hooks/useDocumentPersistence.ts`

```typescript
import { useState, useEffect, useCallback, useRef } from 'react'
import * as Y from 'yjs'
import { useSession } from 'next-auth/react'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface UseDocumentPersistenceOptions {
  autoSaveDelay?: number
  onSaveSuccess?: () => void
  onSaveError?: (error: Error) => void
}

export function useDocumentPersistence(
  ydoc: Y.Doc | null,
  documentId: string | null,
  options: UseDocumentPersistenceOptions = {}
) {
  const { data: session } = useSession()
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout>()
  
  const {
    autoSaveDelay = 2000, // 2 seconds
    onSaveSuccess,
    onSaveError,
  } = options

  // Save function
  const saveDocument = useCallback(async () => {
    if (!ydoc || !documentId || !session?.user?.id) return

    setSaveStatus('saving')

    try {
      // Get Y.js document state as binary
      const state = Y.encodeStateAsUpdate(ydoc)
      
      // Convert to base64 for transmission
      const encryptedContent = btoa(String.fromCharCode(...state))

      const response = await fetch(`/api/documents/${documentId}/autosave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedContent }),
      })

      if (!response.ok) {
        throw new Error(`Save failed: ${response.statusText}`)
      }

      setSaveStatus('saved')
      setLastSaved(new Date())
      onSaveSuccess?.()

    } catch (error) {
      console.error('Document save error:', error)
      setSaveStatus('error')
      onSaveError?.(error as Error)
    }
  }, [ydoc, documentId, session, onSaveSuccess, onSaveError])

  // Debounced save function
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveDocument()
    }, autoSaveDelay)
  }, [saveDocument, autoSaveDelay])

  // Listen for Y.js document changes
  useEffect(() => {
    if (!ydoc || !documentId) return

    const handleUpdate = () => {
      debouncedSave()
    }

    ydoc.on('update', handleUpdate)

    return () => {
      ydoc.off('update', handleUpdate)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [ydoc, documentId, debouncedSave])

  // Manual save function
  const manualSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    await saveDocument()
  }, [saveDocument])

  // Save on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        // Note: Can't await in cleanup, so this is fire-and-forget
        if (ydoc && documentId && session?.user?.id) {
          saveDocument()
        }
      }
    }
  }, [ydoc, documentId, session, saveDocument])

  return {
    saveStatus,
    lastSaved,
    manualSave,
  }
}
```

## Step 2.3: Rebuild YjsProvider (75 minutes)

### 2.3.1 Create New Simplified YjsProvider
**File:** `apps/web/providers/YjsProvider.tsx`

```typescript
'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as Y from 'yjs'
import { useSession } from 'next-auth/react'
import { useDocumentPersistence } from '@/hooks/useDocumentPersistence'

interface YjsContextType {
  doc: Y.Doc | null
  currentDocumentId: string | null
  isLoading: boolean
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  lastSaved: Date | null
  switchDocument: (documentId: string) => Promise<void>
  createDocument: (title?: string) => Promise<string | null>
  manualSave: () => Promise<void>
}

const YjsContext = createContext<YjsContextType>({
  doc: null,
  currentDocumentId: null,
  isLoading: false,
  saveStatus: 'idle',
  lastSaved: null,
  switchDocument: async () => {},
  createDocument: async () => null,
  manualSave: async () => {},
})

export const useYjs = () => useContext(YjsContext)

export function YjsProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const [doc, setDoc] = useState<Y.Doc | null>(null)
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Auto-save functionality
  const { saveStatus, lastSaved, manualSave } = useDocumentPersistence(
    doc,
    currentDocumentId,
    {
      onSaveError: (error) => {
        console.error('Auto-save failed:', error)
        // Could show toast notification here
      },
    }
  )

  // Load document from server
  const loadDocument = useCallback(async (documentId: string): Promise<Y.Doc | null> => {
    if (!session?.user?.id) return null

    try {
      const response = await fetch(`/api/documents/${documentId}`)
      if (!response.ok) {
        throw new Error('Failed to load document')
      }

      const data = await response.json()
      const newDoc = new Y.Doc()

      // Load content if it exists
      if (data.encryptedContent) {
        try {
          // Convert base64 back to binary
          const binaryData = Uint8Array.from(
            atob(data.encryptedContent),
            c => c.charCodeAt(0)
          )
          // Apply the state to Y.js document
          Y.applyUpdate(newDoc, binaryData)
        } catch (error) {
          console.error('Failed to parse document content:', error)
          // Document will be empty, which is okay
        }
      }

      return newDoc
    } catch (error) {
      console.error('Failed to load document:', error)
      return null
    }
  }, [session])

  // Switch to different document
  const switchDocument = useCallback(async (documentId: string) => {
    setIsLoading(true)

    try {
      // Save current document if exists
      if (doc && currentDocumentId) {
        await manualSave()
      }

      // Load new document
      const newDoc = await loadDocument(documentId)
      if (newDoc) {
        setDoc(newDoc)
        setCurrentDocumentId(documentId)
      }
    } catch (error) {
      console.error('Failed to switch document:', error)
    } finally {
      setIsLoading(false)
    }
  }, [doc, currentDocumentId, manualSave, loadDocument])

  // Create new document
  const createDocument = useCallback(async (title = 'Untitled Document'): Promise<string | null> => {
    if (!session?.user?.id) return null

    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })

      if (!response.ok) {
        throw new Error('Failed to create document')
      }

      const { id: documentId } = await response.json()
      await switchDocument(documentId)
      return documentId
    } catch (error) {
      console.error('Failed to create document:', error)
      return null
    }
  }, [session, switchDocument])

  const value: YjsContextType = {
    doc,
    currentDocumentId,
    isLoading,
    saveStatus,
    lastSaved,
    switchDocument,
    createDocument,
    manualSave,
  }

  return <YjsContext.Provider value={value}>{children}</YjsContext.Provider>
}
```

## Step 2.4: Update Document Creation API (if needed) (30 minutes)

### 2.4.1 Ensure Document Creation Works
**File:** `apps/web/app/api/documents/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documents } from '@/lib/db/schema'
import { nanoid } from 'nanoid'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title = 'Untitled Document' } = await request.json()

    const documentId = nanoid()
    
    await db.insert(documents).values({
      id: documentId,
      userId: session.user.id,
      title,
      encryptedContent: '', // Empty initially
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    return NextResponse.json({ id: documentId })
  } catch (error) {
    console.error('Document creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    )
  }
}
```

## ✅ Validation Checklist

After completing Phase 2:

- [ ] Auto-save API endpoint created and working
- [ ] Document persistence hook implemented
- [ ] YjsProvider rebuilt without WebSocket logic
- [ ] Document loading API working
- [ ] Document creation API working
- [ ] Y.js documents save automatically after changes

## 🧪 Test Phase 2

```bash
cd apps/web
pnpm dev
```

**Test in browser:**
1. Login to the app
2. Create a new document
3. Type some content in the editor
4. Wait 2-3 seconds and check for "Saved" status
5. Refresh the page - content should persist
6. Undo/redo should still work (Y.js functionality)

**Expected State After Phase 2:**
- ✅ Documents save automatically
- ✅ Y.js undo/redo works
- ✅ Document switching works
- ✅ No WebSocket errors
- ❌ UI may still show old collaboration elements (fix in Phase 3)

## 📝 Commit Your Progress

```bash
git add .
git commit -m "Phase 2: Rebuild core persistence without sync server

- Created auto-save API endpoint for documents
- Implemented useDocumentPersistence hook with debounced saves
- Rebuilt YjsProvider without WebSocket logic
- Document creation, loading, and auto-saving now works
- Y.js undo/redo functionality preserved"
```

---
**Next:** Proceed to `03_ui_simplification.md` to clean up the user interface.