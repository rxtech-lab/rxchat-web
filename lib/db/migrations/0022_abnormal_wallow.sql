ALTER TABLE "Job" ADD COLUMN "jobTriggerType" varchar DEFAULT 'cronjob' NOT NULL;--> statement-breakpoint
ALTER TABLE "Job" ADD COLUMN "cron" text;