CREATE TABLE "ddl_reminder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"deadline_kind" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ddl_reminder_uq" UNIQUE("activity_id","deadline_kind")
);
--> statement-breakpoint
ALTER TABLE "ddl_reminder" ADD CONSTRAINT "ddl_reminder_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE no action;