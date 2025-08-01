import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documents, documentAccess } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

// GET /api/documents/[id] - Get specific document
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const documentId = params.id

    // Check if user has access to this document
    const userAccess = await db
      .select({
        document: {
          id: documents.id,
          title: documents.title,
          encryptedContent: documents.encryptedContent,
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt,
        },
        accessLevel: documentAccess.accessLevel,
      })
      .from(documents)
      .innerJoin(documentAccess, eq(documents.id, documentAccess.documentId))
      .where(
        and(
          eq(documents.id, documentId),
          eq(documentAccess.userId, session.user.id)
        )
      )
      .limit(1)

    if (userAccess.length === 0) {
      return NextResponse.json(
        { error: 'Document not found or access denied' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...userAccess[0].document,
      accessLevel: userAccess[0].accessLevel,
    })
  } catch (error) {
    console.error('Error fetching document:', error)
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    )
  }
}

// PATCH /api/documents/[id] - Update document content
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const documentId = params.id
    const { encryptedContent, title } = await request.json()

    // Check if user has write access to this document
    const userAccess = await db
      .select({ accessLevel: documentAccess.accessLevel })
      .from(documentAccess)
      .where(
        and(
          eq(documentAccess.documentId, documentId),
          eq(documentAccess.userId, session.user.id)
        )
      )
      .limit(1)

    if (userAccess.length === 0) {
      return NextResponse.json(
        { error: 'Document not found or access denied' },
        { status: 404 }
      )
    }

    if (userAccess[0].accessLevel === 'read') {
      return NextResponse.json(
        { error: 'Insufficient permissions to modify document' },
        { status: 403 }
      )
    }

    // Update the document
    const updateData: any = {
      updatedAt: new Date(),
    }

    if (encryptedContent !== undefined) {
      updateData.encryptedContent = encryptedContent
    }

    if (title !== undefined) {
      updateData.title = title
    }

    await db
      .update(documents)
      .set(updateData)
      .where(eq(documents.id, documentId))

    return NextResponse.json({ message: 'Document updated successfully' })
  } catch (error) {
    console.error('Error updating document:', error)
    return NextResponse.json(
      { error: 'Failed to update document' },
      { status: 500 }
    )
  }
}

// DELETE /api/documents/[id] - Delete document (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const documentId = params.id

    // Check if user is the owner of this document
    const userAccess = await db
      .select({ accessLevel: documentAccess.accessLevel })
      .from(documentAccess)
      .where(
        and(
          eq(documentAccess.documentId, documentId),
          eq(documentAccess.userId, session.user.id)
        )
      )
      .limit(1)

    if (userAccess.length === 0) {
      return NextResponse.json(
        { error: 'Document not found or access denied' },
        { status: 404 }
      )
    }

    if (userAccess[0].accessLevel !== 'owner') {
      return NextResponse.json(
        { error: 'Only document owners can delete documents' },
        { status: 403 }
      )
    }

    // Delete the document (cascade will handle document_access records)
    await db.delete(documents).where(eq(documents.id, documentId))

    return NextResponse.json({ message: 'Document deleted successfully' })
  } catch (error) {
    console.error('Error deleting document:', error)
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    )
  }
}