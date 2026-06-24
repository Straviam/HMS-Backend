CREATE TYPE "public"."day_of_week" AS ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');--> statement-breakpoint
CREATE TYPE "public"."doctor_involvement" AS ENUM('YES', 'NO', 'PARTIAL');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('MALE', 'FEMALE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'DOCTOR', 'RECEPTIONIST', 'OPD_OPERATOR', 'MANAGEMENT', 'ACCOUNTANT');--> statement-breakpoint
CREATE TYPE "public"."payment_status_enum" AS ENUM('PENDING', 'DONE');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('AVAILABLE', 'OCCUPIED', 'UNDER_MAINTENANCE', 'CLEANING');--> statement-breakpoint
CREATE TYPE "public"."txn_type" AS ENUM('SERVICE', 'DOCTOR', 'ROOM');--> statement-breakpoint
CREATE TABLE "doctor_timings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"day" "day_of_week" NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"avg_consultation_time" integer DEFAULT 15,
	"max_tokens" integer DEFAULT 20,
	"consultation_fee" numeric(10, 2) NOT NULL,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "doctors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"specialization" varchar(100),
	"doctor_name" varchar(100),
	"is_available" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "service_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_queuing_enabled" boolean DEFAULT false NOT NULL,
	"doctor_involvement" "doctor_involvement" DEFAULT 'NO' NOT NULL,
	"icon_key" varchar(100),
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_type_id" uuid NOT NULL,
	"service_name" varchar(255) NOT NULL,
	"system_code" varchar(100),
	"is_active" boolean DEFAULT true,
	"base_price" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "test_users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"age" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	CONSTRAINT "test_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mr_number" varchar(50) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"cnic" varchar(20),
	"gender" "gender" NOT NULL,
	"date_of_birth" timestamp NOT NULL,
	"phone" varchar(20) NOT NULL,
	"blood_group" varchar(5),
	"address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "patients_mr_number_unique" UNIQUE("mr_number"),
	CONSTRAINT "patients_cnic_unique" UNIQUE("cnic")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_no" varchar(50) NOT NULL,
	"patient_id" uuid NOT NULL,
	"total_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0.00',
	"payable_amount" numeric(12, 2) NOT NULL,
	"status" "payment_status_enum" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_no_unique" UNIQUE("invoice_no")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount_paid" numeric(12, 2) NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"reference_no" varchar(100),
	"paid_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_booking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"check_in" timestamp DEFAULT now() NOT NULL,
	"check_out" timestamp,
	"status" varchar(20) DEFAULT 'ACTIVE'
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_number" varchar(20) NOT NULL,
	"room_type" varchar(50) NOT NULL,
	"price_per_day" numeric(10, 2) NOT NULL,
	"status" "room_status" DEFAULT 'AVAILABLE' NOT NULL,
	"last_cleaned_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_room_number_unique" UNIQUE("room_number")
);
--> statement-breakpoint
CREATE TABLE "doctor_transactions" (
	"transaction_id" uuid PRIMARY KEY NOT NULL,
	"doctor_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_transactions" (
	"transaction_id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_transactions" (
	"transaction_id" uuid PRIMARY KEY NOT NULL,
	"service_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"txn_no" varchar(50) NOT NULL,
	"patient_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"type" "txn_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_txn_no_unique" UNIQUE("txn_no")
);
--> statement-breakpoint
ALTER TABLE "doctor_timings" ADD CONSTRAINT "doctor_timings_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_service_type_id_service_types_id_fk" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_booking" ADD CONSTRAINT "room_booking_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_booking" ADD CONSTRAINT "room_booking_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_transactions" ADD CONSTRAINT "doctor_transactions_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_transactions" ADD CONSTRAINT "doctor_transactions_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_transactions" ADD CONSTRAINT "room_transactions_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_transactions" ADD CONSTRAINT "room_transactions_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_transactions" ADD CONSTRAINT "service_transactions_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_transactions" ADD CONSTRAINT "service_transactions_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;