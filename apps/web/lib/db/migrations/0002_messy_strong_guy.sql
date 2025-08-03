DROP INDEX "idx_documents_user_id_updated_at";--> statement-breakpoint
DROP INDEX "idx_documents_user_id_created_at";--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "content" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "createdAt" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "updatedAt" timestamp DEFAULT now();--> statement-breakpoint
CREATE INDEX "idx_documents_user_id_updated_at" ON "documents" USING btree ("user_id","updatedAt");--> statement-breakpoint
CREATE INDEX "idx_documents_user_id_created_at" ON "documents" USING btree ("user_id","createdAt");--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "encrypted_content";--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "updated_at";