ALTER TABLE "doctors" RENAME COLUMN "dr_name" TO "doctor_name";--> statement-breakpoint
ALTER TABLE "doctor_timings" ALTER COLUMN "start_time" SET DATA TYPE time;--> statement-breakpoint
ALTER TABLE "doctor_timings" ALTER COLUMN "end_time" SET DATA TYPE time;