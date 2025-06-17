ALTER TABLE "Prompt" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "Prompt" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;