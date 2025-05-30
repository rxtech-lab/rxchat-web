CREATE TABLE IF NOT EXISTS "Challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge" text NOT NULL,
	"userId" uuid,
	"type" varchar NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PasskeyAuthenticator" (
	"credentialID" text PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"credentialPublicKey" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"credentialDeviceType" varchar NOT NULL,
	"credentialBackedUp" boolean NOT NULL,
	"transports" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"name" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastUsed" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Challenges" ADD CONSTRAINT "Challenges_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PasskeyAuthenticator" ADD CONSTRAINT "PasskeyAuthenticator_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
