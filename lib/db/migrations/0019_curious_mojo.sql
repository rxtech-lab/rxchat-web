ALTER TABLE "VectorStoreDocument" ADD COLUMN "sha256" text;--> statement-breakpoint
ALTER TABLE "VectorStoreDocument" ADD CONSTRAINT "unique_sha256" UNIQUE("sha256");