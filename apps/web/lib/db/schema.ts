import {
  timestamp,
  pgTable,
  text,
  primaryKey,
  integer,
  uuid,
  index,
} from "drizzle-orm/pg-core"

// Users table - stores account information (credentials-only, no external providers)
export const users = pgTable("user", {
  id: text("id").notNull().primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  hashedPassword: text("hashedPassword").notNull(), // Required for credential-based auth
})

// Removed accounts table - no external OAuth providers for privacy/security

// Sessions table - manages active user sessions
export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").notNull().primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

// Verification tokens - for email verification, password resets
export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
)

// Documents table - stores user documents with encrypted content
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled Document"),
    encryptedContent: text("encryptedContent"), // Base64 encoded encrypted Y.js document state
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow(),
  },
  (documents) => ({
    userIdIdx: index("idx_documents_user_id").on(documents.userId),
    userIdUpdatedAtIdx: index("idx_documents_user_id_updated_at").on(documents.userId, documents.updatedAt),
    userIdCreatedAtIdx: index("idx_documents_user_id_created_at").on(documents.userId, documents.createdAt),
  })
)

// Removed documentAccess table - no longer needed for single-user documents
// All documents are owned by their creator (userId), no sharing/collaboration needed