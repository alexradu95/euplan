import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documents } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { nanoid } from 'nanoid'

// GET /api/documents - List user's documents
export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's documents
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
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}

// POST /api/documents - Create new document
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