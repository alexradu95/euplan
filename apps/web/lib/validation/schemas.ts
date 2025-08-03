import { z } from 'zod'

// User schemas
export const CreateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number')
})

export const LoginUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
})

// Document schemas
export const CreateDocumentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').default('Untitled Document')
})

export const UpdateDocumentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  content: z.string().optional()
})

export const DocumentIdSchema = z.object({
  id: z.string().uuid('Invalid document ID format')
})

// WebSocket message schemas
export const JoinDocumentSchema = z.object({
  documentId: z.string().uuid('Invalid document ID format')
})

export const DocumentUpdateSchema = z.object({
  update: z.array(z.number().int().min(0).max(255), 'Invalid update format'),
  documentId: z.string().uuid('Invalid document ID format')
})

export const AwarenessUpdateSchema = z.object({
  awareness: z.any(), // Y.js awareness can be complex, allow any for now
  documentId: z.string().uuid('Invalid document ID format')
})

// Database content validation
export const ContentSchema = z.string().min(0, 'Content must be a valid string')

// Environment validation
export const EnvSchema = z.object({
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  DATABASE_URL: z.string().url('Invalid database URL'),
  NEXTAUTH_SECRET: z.string().min(32, 'NextAuth secret must be at least 32 characters'),
  NEXTAUTH_URL: z.string().url('Invalid NextAuth URL').optional()
})

// Type exports
export type CreateUser = z.infer<typeof CreateUserSchema>
export type LoginUser = z.infer<typeof LoginUserSchema>
export type CreateDocument = z.infer<typeof CreateDocumentSchema>
export type UpdateDocument = z.infer<typeof UpdateDocumentSchema>
export type DocumentId = z.infer<typeof DocumentIdSchema>
export type JoinDocument = z.infer<typeof JoinDocumentSchema>
export type DocumentUpdate = z.infer<typeof DocumentUpdateSchema>
export type AwarenessUpdate = z.infer<typeof AwarenessUpdateSchema>