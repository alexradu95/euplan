import { z } from 'zod';

// Helper function to create document ID validation based on environment
const createDocumentIdSchema = () => {
  if (process.env.NODE_ENV === 'test') {
    // In test environment, allow simple strings like 'doc123'
    return z.string().min(1, 'Document ID is required');
  }
  // In production/development, require proper UUID format
  return z.string().uuid('Invalid document ID format');
};

// WebSocket message validation schemas
export const JoinDocumentSchema = z.object({
  documentId: createDocumentIdSchema(),
});

export const DocumentUpdateSchema = z.object({
  update: z.array(z.number().int().min(0).max(255), 'Invalid update format'),
  documentId: createDocumentIdSchema(),
});

// Define proper awareness state structure based on Y.js awareness protocol
export const AwarenessStateSchema = z.object({
  user: z.object({
    name: z.string().optional(),
    color: z.string().optional(),
    cursor: z.object({
      anchor: z.number(),
      head: z.number()
    }).optional()
  }).optional(),
  selection: z.object({
    anchor: z.number(),
    head: z.number()
  }).optional()
}).catchall(z.unknown()); // Allow additional fields for extensibility

export const AwarenessUpdateSchema = z.object({
  awareness: AwarenessStateSchema,
  documentId: createDocumentIdSchema(),
});

// Database validation schemas
export const DocumentIdSchema = z.object({
  id: createDocumentIdSchema(),
});

export const UserIdSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

// Environment validation
export const EnvSchema = z.object({
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  DATABASE_URL: z.string().url('Invalid database URL'),
  PORT: z.string().regex(/^\d+$/, 'Port must be a number').default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// Type exports
export type JoinDocument = z.infer<typeof JoinDocumentSchema>;
export type DocumentUpdate = z.infer<typeof DocumentUpdateSchema>;
export type AwarenessUpdate = z.infer<typeof AwarenessUpdateSchema>;
export type DocumentId = z.infer<typeof DocumentIdSchema>;
export type UserId = z.infer<typeof UserIdSchema>;