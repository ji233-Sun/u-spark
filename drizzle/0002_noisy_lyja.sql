ALTER TABLE "manuscript_version" ADD COLUMN "cover_image_url" text;--> statement-breakpoint
ALTER TABLE "manuscript_version" ADD COLUMN "status" "manuscript_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "manuscript_version" ADD COLUMN "review_reason" text;--> statement-breakpoint
ALTER TABLE "manuscript_version" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "manuscript_version" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "manuscript_version" ADD CONSTRAINT "manuscript_version_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;