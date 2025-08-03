# Phase 4: Database Cleanup
**Timeline:** Day 3 Morning (2 hours)
**Goal:** Simplify database schema and remove collaboration complexity

## Step 4.1: Analyze Current Database Schema (30 minutes)

### 4.1.1 Review Current Schema
**File:** `apps/web/lib/db/schema.ts`

Identify tables and columns to remove:

**Tables to potentially remove:**
- Document access/permissions tables
- User collaboration tables  
- Sync status tracking tables
- Version conflict resolution tables
- Real-time session tables

**Columns to potentially remove from documents table:**
- Collaboration-related fields
- Complex permission fields
- Sync status fields
- Version tracking fields (if overly complex)

### 4.1.2 Check Current Migrations
```bash
# Review existing migrations
ls apps/web/lib/db/migrations/
```

Look for collaboration-related migrations that might need cleanup.

## Step 4.2: Create Database Migration (45 minutes)

### 4.2.1 Create Cleanup Migration
```bash
cd apps/web
npx drizzle-kit generate:pg --out ./lib/db/migrations --config ./drizzle.config.ts
```

**File:** `apps/web/lib/db/migrations/XXXX_simplify_schema.sql`

```sql
-- Remove collaboration-related tables (adjust based on your actual schema)
DROP TABLE IF EXISTS document_collaborators;
DROP TABLE IF EXISTS document_permissions;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS sync_status;
DROP TABLE IF EXISTS document_versions;

-- Remove collaboration columns from documents table (adjust based on your schema)
ALTER TABLE documents DROP COLUMN IF EXISTS shared_with;
ALTER TABLE documents DROP COLUMN IF EXISTS permissions;
ALTER TABLE documents DROP COLUMN IF EXISTS sync_status;
ALTER TABLE documents DROP COLUMN IF EXISTS version;
ALTER TABLE documents DROP COLUMN IF EXISTS last_sync;
ALTER TABLE documents DROP COLUMN IF EXISTS collaborator_count;

-- Add any missing simple columns we need
ALTER TABLE documents ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT 'Untitled Document';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS encrypted_content TEXT DEFAULT '';

-- Create index for faster user document queries
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at DESC);
```

### 4.2.2 Update Schema Definition
**File:** `apps/web/lib/db/schema.ts`

Simplify to essential tables only:

```typescript
import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

// Users table (keep for authentication)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Simplified documents table - single user ownership
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull().default('Untitled Document'),
  encryptedContent: text('encrypted_content').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Remove these tables if they exist:
// export const documentCollaborators = ...
// export const documentPermissions = ...
// export const userSessions = ...
// export const syncStatus = ...

// Keep authentication-related tables (accounts, sessions, verification_tokens)
// These are needed for NextAuth.js
export const accounts = pgTable('accounts', {
  // ... keep existing NextAuth schema
})

export const sessions = pgTable('sessions', {
  // ... keep existing NextAuth schema  
})

export const verificationTokens = pgTable('verification_tokens', {
  // ... keep existing NextAuth schema
})
```

## Step 4.3: Update API Routes for Simplified Schema (30 minutes)

### 4.3.1 Update Document Queries
**File:** `apps/web/app/api/documents/route.ts`

Simplify to only show user's own documents:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documents } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

// Get user's documents (no permission checking needed)
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userDocuments = await db
      .select({
        id: documents.id,
        title: documents.title,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(eq(documents.userId, session.user.id))
      .orderBy(desc(documents.updatedAt))

    return NextResponse.json(userDocuments)
  } catch (error) {
    console.error('Failed to fetch documents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}

// Create new document (always owned by current user)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title = 'Untitled Document' } = await request.json()

    const [newDocument] = await db
      .insert(documents)
      .values({
        userId: session.user.id,
        title,
        encryptedContent: '',
      })
      .returning({ id: documents.id })

    return NextResponse.json({ id: newDocument.id })
  } catch (error) {
    console.error('Failed to create document:', error)
    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    )
  }
}
```

### 4.3.2 Update Individual Document Routes
**File:** `apps/web/app/api/documents/[id]/route.ts`

Remove permission checking complexity:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documents } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

// Get single document (simple ownership check)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [document] = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.id, params.id),
          eq(documents.userId, session.user.id)
        )
      )
      .limit(1)

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json(document)
  } catch (error) {
    console.error('Failed to fetch document:', error)
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    )
  }
}

// Update document (simple ownership check)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, encryptedContent } = await request.json()

    const [updatedDocument] = await db
      .update(documents)
      .set({
        title,
        encryptedContent,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documents.id, params.id),
          eq(documents.userId, session.user.id)
        )
      )
      .returning({ id: documents.id })

    if (!updatedDocument) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update document:', error)
    return NextResponse.json(
      { error: 'Failed to update document' },
      { status: 500 }
    )
  }
}

// Delete document (simple ownership check)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [deletedDocument] = await db
      .delete(documents)
      .where(
        and(
          eq(documents.id, params.id),
          eq(documents.userId, session.user.id)
        )
      )
      .returning({ id: documents.id })

    if (!deletedDocument) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete document:', error)
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    )
  }
}
```

## Step 4.4: Run Database Migration (15 minutes)

### 4.4.1 Backup Database
```bash
# If using local PostgreSQL
pg_dump your_database_name > backup_before_simplification.sql

# Or if using Docker
docker exec your_postgres_container pg_dump -U postgres your_database_name > backup_before_simplification.sql
```

### 4.4.2 Run Migration
```bash
cd apps/web

# Generate the migration if you haven't already
npx drizzle-kit generate:pg

# Run the migration
npx drizzle-kit push:pg
```

### 4.4.3 Verify Schema
```bash
# Connect to your database and verify the simplified schema
psql your_database_url -c "\dt"  # List tables
psql your_database_url -c "\d+ documents"  # Describe documents table
```

## Step 4.5: Update Document Hooks (20 minutes)

### 4.5.1 Update useDocuments Hook
**File:** `apps/web/hooks/useDocuments.ts`

Simplify to only load user's documents:

```typescript
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface Document {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export function useDocuments() {
  const { data: session } = useSession()
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDocuments = async () => {
    if (!session?.user?.id) return

    try {
      setIsLoading(true)
      const response = await fetch('/api/documents')
      
      if (!response.ok) {
        throw new Error('Failed to load documents')
      }

      const docs = await response.json()
      setDocuments(docs)
      setError(null)
    } catch (err) {
      setError('Failed to load documents')
      console.error('Error loading documents:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [session])

  const createDocument = async (title?: string) => {
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })

      if (!response.ok) {
        throw new Error('Failed to create document')
      }

      const { id } = await response.json()
      await loadDocuments() // Refresh list
      return id
    } catch (err) {
      console.error('Error creating document:', err)
      return null
    }
  }

  return {
    documents,
    isLoading,
    error,
    createDocument,
    refreshDocuments: loadDocuments,
  }
}
```

## ✅ Validation Checklist

After completing Phase 4:

- [ ] Database schema simplified to essential tables only
- [ ] Migration completed successfully
- [ ] Document ownership is simple (user_id = session.user.id)
- [ ] All collaboration tables removed
- [ ] API routes updated for simplified access control
- [ ] Document hooks work with new schema

## 🧪 Test Phase 4

```bash
cd apps/web
pnpm dev
```

**Test in browser:**
1. Login should still work
2. Can create new documents
3. Can load existing documents
4. Documents save properly
5. Only see your own documents
6. No permission/sharing functionality

**Test database directly:**
```sql
-- Check simplified schema
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Verify documents table structure
\d+ documents

-- Check that user can only see their documents
SELECT id, title, user_id FROM documents WHERE user_id = 'your-user-id';
```

**Expected State After Phase 4:**
- ✅ Simplified database schema
- ✅ Single-user document ownership
- ✅ No collaboration complexity
- ✅ Fast, simple queries
- ✅ All functionality still works

## 📝 Commit Your Progress

```bash
git add .
git commit -m "Phase 4: Simplify database schema for single-user use

- Removed collaboration tables (document_collaborators, permissions, etc.)
- Simplified documents table to essential fields only
- Updated API routes for simple ownership model (user_id check)
- Removed complex permission checking logic
- Added database indexes for performance
- All document operations now use simple user ownership model"
```

---
**Next:** Proceed to `05_testing_validation.md` to update tests and validate functionality.