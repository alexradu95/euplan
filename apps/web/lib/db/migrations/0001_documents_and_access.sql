-- Migration: Add documents and document_access tables
-- Generated manually for Phase 1: User-Specific Document Storage

-- Documents table - stores user documents with encrypted content
CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text DEFAULT 'Untitled Document' NOT NULL,
	"encrypted_content" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Document access control - manages sharing and permissions
CREATE TABLE IF NOT EXISTS "document_access" (
	"document_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"access_level" text DEFAULT 'read' NOT NULL,
	"granted_at" timestamp DEFAULT now(),
	CONSTRAINT "document_access_document_id_user_id_pk" PRIMARY KEY("document_id","user_id")
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_documents_user_id" ON "documents" ("user_id");

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "document_access" ADD CONSTRAINT "document_access_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "document_access" ADD CONSTRAINT "document_access_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add constraint for access_level enum
ALTER TABLE "document_access" ADD CONSTRAINT "document_access_access_level_check" 
CHECK ("access_level" IN ('read', 'write', 'owner'));