import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documents, documentAccess } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { CreateDocumentSchema } from '@/lib/validation/schemas'
import { 
  withApiHandler, 
  createApiResponse, 
  AuthenticationError,
  handleApiErrorEnhanced 
} from '@/lib/api-handler'

// GET /api/documents - List user's documents
export const GET = withApiHandler(async () => {
  const session = await auth()
  
  if (!session?.user?.id) {
    throw new AuthenticationError()
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

  return createApiResponse(userDocuments)
})

// POST /api/documents - Create new document
export const POST = withApiHandler(async (request: NextRequest) => {
  const session = await auth()
  
  if (!session?.user?.id) {
    throw new AuthenticationError()
  }

  const rawData = await request.json()
  const validatedData = CreateDocumentSchema.parse(rawData)

  // Create the document
  const [newDocument] = await db
    .insert(documents)
    .values({
      userId: session.user.id,
      title: validatedData.title,
      encryptedContent: null,
    })
    .returning({ id: documents.id })

  // Grant owner access to the creator
  await db.insert(documentAccess).values({
    documentId: newDocument.id,
    userId: session.user.id,
    accessLevel: 'owner',
  })

  return createApiResponse({ 
    documentId: newDocument.id,
    message: 'Document created successfully' 
  }, 201)
})