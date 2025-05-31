ALTER TABLE "VectorStoreDocument" ALTER COLUMN "content" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "VectorStoreDocument" ADD COLUMN "status" varchar DEFAULT 'pending' NOT NULL;