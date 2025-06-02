ALTER TABLE "VectorStoreDocument" ADD COLUMN "sha256" text;--> statement-breakpoint
ALTER TABLE "VectorStoreDocument" ADD CONSTRAINT "VectorStoreDocument_sha256_unique" UNIQUE("sha256");