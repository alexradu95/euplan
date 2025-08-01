import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documents, documentAccess } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

// GET /api/documents - List user's documents
export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's documents (both owned and shared)
    const userDocuments = await db
      .select({
        id: documents.id,
        title: documents.title,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        accessLevel: documentAccess.accessLevel,
      })
      .from(documents)
      .innerJoin(documentAccess, eq(documents.id, documentAccess.documentId))
      .where(eq(documentAccess.userId, session.user.id))
      .orderBy(desc(documents.updatedAt))

    return NextResponse.json(userDocuments)
  } catch (error) {
    console.error('Error fetching documents:', error)
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

    const { title } = await request.json()

    // Create the document
    const [newDocument] = await db
      .insert(documents)
      .values({
        userId: session.user.id,
        title: title || 'Untitled Document',
        encryptedContent: null,
      })
      .returning({ id: documents.id })

    // Grant owner access to the creator
    await db.insert(documentAccess).values({
      documentId: newDocument.id,
      userId: session.user.id,
      accessLevel: 'owner',
    })

    return NextResponse.json({ 
      documentId: newDocument.id,
      message: 'Document created successfully' 
    })
  } catch (error) {
    console.error('Error creating document:', error)
    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    )
  }
}