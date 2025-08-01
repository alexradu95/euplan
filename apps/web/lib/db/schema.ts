import {
  timestamp,
  pgTable,
  text,
  primaryKey,
  integer,
  uuid,
  index,
} from "drizzle-orm/pg-core"
import type { AdapterAccount } from "next-auth/adapters"  // Fixed import

// Users table - stores account information
export const users = pgTable("user", {
  id: text("id").notNull().primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  hashedPassword: text("hashedPassword"), // For credential-based auth
})

// Accounts table - for OAuth providers (Google, GitHub, etc.)
export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
)

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
    encryptedContent: text("encrypted_content"), // Base64 encoded encrypted Y.js document state
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (documents) => ({
    userIdIdx: index("idx_documents_user_id").on(documents.userId),
  })
)

// Document access control - manages sharing and permissions
export const documentAccess = pgTable(
  "document_access",
  {
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessLevel: text("access_level", { 
      enum: ["read", "write", "owner"] 
    }).notNull().default("read"),
    grantedAt: timestamp("granted_at", { mode: "date" }).defaultNow(),
  },
  (documentAccess) => ({
    compoundKey: primaryKey({ 
      columns: [documentAccess.documentId, documentAccess.userId] 
    }),
  })
)