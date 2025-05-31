CREATE TABLE IF NOT EXISTS "VectorStoreDocument" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp NOT NULL,
	"content" text NOT NULL,
	"userId" uuid NOT NULL,
	"key" text,
	"mimeType" text NOT NULL,
	"size" integer NOT NULL,
	CONSTRAINT "VectorStoreDocument_key_unique" UNIQUE("key")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "VectorStoreDocument" ADD CONSTRAINT "VectorStoreDocument_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
