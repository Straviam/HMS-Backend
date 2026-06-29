ALTER TABLE "payments" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "room_booking" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_booking" ADD CONSTRAINT "room_booking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;