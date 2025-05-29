ALTER TABLE "User" ADD COLUMN "role" varchar DEFAULT 'regular' NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "availableModelProviders" jsonb DEFAULT '["openAI"]'::jsonb NOT NULL;