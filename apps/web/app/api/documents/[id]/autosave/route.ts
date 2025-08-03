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
