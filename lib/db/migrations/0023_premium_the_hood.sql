CREATE TABLE IF NOT EXISTS "TelegramUser" (
	"tgId" bigint PRIMARY KEY NOT NULL,
	"username" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastUsed" timestamp,
	"userId" uuid NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TelegramUser" ADD CONSTRAINT "TelegramUser_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
