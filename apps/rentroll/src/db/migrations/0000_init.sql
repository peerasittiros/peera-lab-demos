CREATE SCHEMA IF NOT EXISTS "rentroll";
--> statement-breakpoint
CREATE TABLE "rentroll"."building" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name_th" text NOT NULL,
	"name_en" text,
	"address_th" text,
	"address_en" text,
	"promptpay_id" text NOT NULL,
	"bank_name" text,
	"bank_account_masked" text,
	"billing_day" smallint DEFAULT 25 NOT NULL,
	"due_day" smallint DEFAULT 5 NOT NULL,
	"invoice_year_style" text DEFAULT 'be' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "building_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "building_billing_day_valid" CHECK ("rentroll"."building"."billing_day" between 1 and 28),
	CONSTRAINT "building_due_day_valid" CHECK ("rentroll"."building"."due_day" between 1 and 28),
	CONSTRAINT "building_invoice_year_style_valid" CHECK ("rentroll"."building"."invoice_year_style" in ('be', 'ce'))
);
--> statement-breakpoint
CREATE TABLE "rentroll"."rate_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"valid_from" date NOT NULL,
	"elec_rate_satang" integer NOT NULL,
	"elec_min_satang" integer DEFAULT 0 NOT NULL,
	"water_mode" text NOT NULL,
	"water_rate_satang" integer DEFAULT 0 NOT NULL,
	"water_min_satang" integer DEFAULT 0 NOT NULL,
	"water_per_person_satang" integer DEFAULT 0 NOT NULL,
	"common_fee_satang" integer DEFAULT 0 NOT NULL,
	"late_fee_rule" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_plan_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "rate_plan_building_fk" FOREIGN KEY ("tenant_id","building_id") REFERENCES "rentroll"."building"("tenant_id","id"),
	CONSTRAINT "rate_plan_water_mode_valid" CHECK ("rentroll"."rate_plan"."water_mode" in ('per_unit', 'per_person'))
);
--> statement-breakpoint
CREATE TABLE "rentroll"."room_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"name_th" text NOT NULL,
	"name_en" text,
	"monthly_rent_satang" bigint NOT NULL,
	"daily_rent_satang" bigint,
	"deposit_satang" bigint NOT NULL,
	"advance_months" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_type_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "room_type_building_fk" FOREIGN KEY ("tenant_id","building_id") REFERENCES "rentroll"."building"("tenant_id","id"),
	CONSTRAINT "room_type_rent_nonnegative" CHECK ("rentroll"."room_type"."monthly_rent_satang" >= 0),
	CONSTRAINT "room_type_deposit_nonnegative" CHECK ("rentroll"."room_type"."deposit_satang" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rentroll"."room" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"number" text NOT NULL,
	"floor" smallint NOT NULL,
	"room_type_id" uuid NOT NULL,
	"size_sqm" numeric,
	"maintenance" boolean DEFAULT false NOT NULL,
	"elec_meter_digits" smallint DEFAULT 5 NOT NULL,
	"water_meter_digits" smallint DEFAULT 4 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "room_building_number_uq" UNIQUE("tenant_id","building_id","number"),
	CONSTRAINT "room_building_fk" FOREIGN KEY ("tenant_id","building_id") REFERENCES "rentroll"."building"("tenant_id","id"),
	CONSTRAINT "room_room_type_fk" FOREIGN KEY ("tenant_id","room_type_id") REFERENCES "rentroll"."room_type"("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "rentroll"."renter" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"line_user_id" text,
	"preferred_locale" text DEFAULT 'th' NOT NULL,
	"emergency_contact" jsonb,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "renter_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "renter_locale_valid" CHECK ("rentroll"."renter"."preferred_locale" in ('th', 'en'))
);
--> statement-breakpoint
CREATE TABLE "rentroll"."contract" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"notice_date" date,
	"status" text NOT NULL,
	"monthly_rent_satang" bigint NOT NULL,
	"deposit_satang" bigint NOT NULL,
	"deposit_received_satang" bigint DEFAULT 0 NOT NULL,
	"advance_months" smallint DEFAULT 1 NOT NULL,
	"occupants" smallint DEFAULT 1 NOT NULL,
	"extras" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"note" text,
	"start_days_ago" integer,
	"notice_days_ago" integer,
	"end_days_ago" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contract_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "contract_room_fk" FOREIGN KEY ("tenant_id","room_id") REFERENCES "rentroll"."room"("tenant_id","id"),
	CONSTRAINT "contract_status_valid" CHECK ("rentroll"."contract"."status" in ('active', 'notice_given', 'ended')),
	CONSTRAINT "contract_occupants_valid" CHECK ("rentroll"."contract"."occupants" between 1 and 4)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "contract_one_live_per_room_uq" ON "rentroll"."contract" ("tenant_id","room_id") WHERE "rentroll"."contract"."status" in ('active', 'notice_given');
--> statement-breakpoint
CREATE TABLE "rentroll"."contract_renter" (
	"tenant_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"renter_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contract_renter_uq" UNIQUE("tenant_id","contract_id","renter_id"),
	CONSTRAINT "contract_renter_contract_fk" FOREIGN KEY ("tenant_id","contract_id") REFERENCES "rentroll"."contract"("tenant_id","id"),
	CONSTRAINT "contract_renter_renter_fk" FOREIGN KEY ("tenant_id","renter_id") REFERENCES "rentroll"."renter"("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "rentroll"."meter_reading" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"period" char(7) NOT NULL,
	"reading" integer NOT NULL,
	"units_used" integer,
	"is_rollover" boolean DEFAULT false NOT NULL,
	"is_estimate" boolean DEFAULT false NOT NULL,
	"photo_url" text,
	"anomaly" text,
	"read_by" text,
	"read_at" timestamp with time zone,
	"days_ago" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meter_reading_uq" UNIQUE("tenant_id","room_id","kind","period"),
	CONSTRAINT "meter_reading_room_fk" FOREIGN KEY ("tenant_id","room_id") REFERENCES "rentroll"."room"("tenant_id","id"),
	CONSTRAINT "meter_reading_kind_valid" CHECK ("rentroll"."meter_reading"."kind" in ('electricity', 'water')),
	CONSTRAINT "meter_reading_nonnegative" CHECK ("rentroll"."meter_reading"."reading" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rentroll"."invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"number" text NOT NULL,
	"type" text NOT NULL,
	"period" char(7),
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"status" text NOT NULL,
	"subtotal_satang" bigint NOT NULL,
	"total_satang" bigint NOT NULL,
	"paid_satang" bigint DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"public_token" text NOT NULL,
	"days_ago" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "invoice_number_uq" UNIQUE("tenant_id","number"),
	CONSTRAINT "invoice_public_token_uq" UNIQUE("public_token"),
	CONSTRAINT "invoice_contract_period_type_uq" UNIQUE("contract_id","period","type"),
	CONSTRAINT "invoice_building_fk" FOREIGN KEY ("tenant_id","building_id") REFERENCES "rentroll"."building"("tenant_id","id"),
	CONSTRAINT "invoice_contract_fk" FOREIGN KEY ("tenant_id","contract_id") REFERENCES "rentroll"."contract"("tenant_id","id"),
	CONSTRAINT "invoice_type_valid" CHECK ("rentroll"."invoice"."type" in ('monthly', 'move_in', 'move_out', 'one_off')),
	CONSTRAINT "invoice_status_valid" CHECK ("rentroll"."invoice"."status" in ('draft', 'sent', 'partially_paid', 'paid', 'void')),
	CONSTRAINT "invoice_total_nonnegative" CHECK ("rentroll"."invoice"."total_satang" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rentroll"."invoice_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"label_th" text NOT NULL,
	"label_en" text NOT NULL,
	"qty" numeric DEFAULT 1 NOT NULL,
	"unit_price_satang" bigint NOT NULL,
	"amount_satang" bigint NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_line_invoice_fk" FOREIGN KEY ("tenant_id","invoice_id") REFERENCES "rentroll"."invoice"("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "rentroll"."payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"amount_satang" bigint NOT NULL,
	"method" text NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"slip_url" text,
	"status" text NOT NULL,
	"reviewed_by" text,
	"reject_reason" text,
	"receipt_number" text,
	"days_ago" integer,
	"minute_of_day" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "payment_contract_fk" FOREIGN KEY ("tenant_id","contract_id") REFERENCES "rentroll"."contract"("tenant_id","id"),
	CONSTRAINT "payment_amount_positive" CHECK ("rentroll"."payment"."amount_satang" > 0),
	CONSTRAINT "payment_method_valid" CHECK ("rentroll"."payment"."method" in ('promptpay', 'transfer', 'cash')),
	CONSTRAINT "payment_status_valid" CHECK ("rentroll"."payment"."status" in ('pending_review', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "rentroll"."payment_allocation" (
	"tenant_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount_satang" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_allocation_uq" UNIQUE("tenant_id","payment_id","invoice_id"),
	CONSTRAINT "payment_allocation_payment_fk" FOREIGN KEY ("tenant_id","payment_id") REFERENCES "rentroll"."payment"("tenant_id","id"),
	CONSTRAINT "payment_allocation_invoice_fk" FOREIGN KEY ("tenant_id","invoice_id") REFERENCES "rentroll"."invoice"("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "rentroll"."credit_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"number" text NOT NULL,
	"amount_satang" bigint NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_note_number_uq" UNIQUE("tenant_id","number"),
	CONSTRAINT "credit_note_invoice_fk" FOREIGN KEY ("tenant_id","invoice_id") REFERENCES "rentroll"."invoice"("tenant_id","id"),
	CONSTRAINT "credit_note_amount_positive" CHECK ("rentroll"."credit_note"."amount_satang" > 0)
);
--> statement-breakpoint
CREATE TABLE "rentroll"."checklist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"items" jsonb NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checklist_contract_kind_uq" UNIQUE("tenant_id","contract_id","kind"),
	CONSTRAINT "checklist_contract_fk" FOREIGN KEY ("tenant_id","contract_id") REFERENCES "rentroll"."contract"("tenant_id","id"),
	CONSTRAINT "checklist_kind_valid" CHECK ("rentroll"."checklist"."kind" in ('move_in', 'move_out'))
);
--> statement-breakpoint
CREATE TABLE "rentroll"."settlement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"deposit_satang" bigint NOT NULL,
	"deductions" jsonb NOT NULL,
	"refund_satang" bigint NOT NULL,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlement_contract_uq" UNIQUE("tenant_id","contract_id"),
	CONSTRAINT "settlement_contract_fk" FOREIGN KEY ("tenant_id","contract_id") REFERENCES "rentroll"."contract"("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "rentroll"."repair_ticket" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"renter_id" uuid,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"photo_url" text,
	"preferred_time" text,
	"allow_entry" boolean DEFAULT false NOT NULL,
	"status" text NOT NULL,
	"assignee" text,
	"scheduled_at" timestamp with time zone,
	"cost_satang" bigint,
	"bill_to_renter" boolean DEFAULT false NOT NULL,
	"closed_at" timestamp with time zone,
	"days_ago" integer,
	"minute_of_day" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repair_ticket_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "repair_ticket_room_fk" FOREIGN KEY ("tenant_id","room_id") REFERENCES "rentroll"."room"("tenant_id","id"),
	CONSTRAINT "repair_ticket_renter_fk" FOREIGN KEY ("tenant_id","renter_id") REFERENCES "rentroll"."renter"("tenant_id","id"),
	CONSTRAINT "repair_ticket_category_valid" CHECK ("rentroll"."repair_ticket"."category" in ('electrical', 'plumbing', 'aircon', 'furniture', 'internet', 'other')),
	CONSTRAINT "repair_ticket_status_valid" CHECK ("rentroll"."repair_ticket"."status" in ('new', 'scheduled', 'in_progress', 'done', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "rentroll"."ticket_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_role" text NOT NULL,
	"body" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"days_ago" integer,
	"minute_of_day" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_message_ticket_fk" FOREIGN KEY ("tenant_id","ticket_id") REFERENCES "rentroll"."repair_ticket"("tenant_id","id"),
	CONSTRAINT "ticket_message_author_valid" CHECK ("rentroll"."ticket_message"."author_role" in ('owner', 'caretaker', 'tenant'))
);
--> statement-breakpoint
CREATE TABLE "rentroll"."announcement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"title_th" text NOT NULL,
	"title_en" text NOT NULL,
	"body_th" text NOT NULL,
	"body_en" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"days_ago" integer,
	"minute_of_day" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcement_building_fk" FOREIGN KEY ("tenant_id","building_id") REFERENCES "rentroll"."building"("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "rentroll"."doc_sequence" (
	"tenant_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"doc_type" text NOT NULL,
	"year" smallint NOT NULL,
	"next_no" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doc_sequence_pk" PRIMARY KEY("building_id","doc_type","year"),
	CONSTRAINT "doc_sequence_building_fk" FOREIGN KEY ("tenant_id","building_id") REFERENCES "rentroll"."building"("tenant_id","id")
);
--> statement-breakpoint
CREATE INDEX "building_tenant_idx" ON "rentroll"."building" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "rate_plan_tenant_idx" ON "rentroll"."rate_plan" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "rate_plan_building_idx" ON "rentroll"."rate_plan" ("tenant_id","building_id","valid_from");
--> statement-breakpoint
CREATE INDEX "room_type_tenant_idx" ON "rentroll"."room_type" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "room_tenant_idx" ON "rentroll"."room" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "room_building_floor_idx" ON "rentroll"."room" ("tenant_id","building_id","floor");
--> statement-breakpoint
CREATE INDEX "renter_tenant_idx" ON "rentroll"."renter" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "contract_tenant_idx" ON "rentroll"."contract" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "contract_room_status_idx" ON "rentroll"."contract" ("tenant_id","room_id","status");
--> statement-breakpoint
CREATE INDEX "contract_renter_tenant_idx" ON "rentroll"."contract_renter" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "meter_reading_tenant_idx" ON "rentroll"."meter_reading" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "meter_reading_period_idx" ON "rentroll"."meter_reading" ("tenant_id","period");
--> statement-breakpoint
CREATE INDEX "invoice_tenant_idx" ON "rentroll"."invoice" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "invoice_building_period_idx" ON "rentroll"."invoice" ("tenant_id","building_id","period");
--> statement-breakpoint
CREATE INDEX "invoice_status_due_idx" ON "rentroll"."invoice" ("tenant_id","status","due_date");
--> statement-breakpoint
CREATE INDEX "invoice_line_tenant_idx" ON "rentroll"."invoice_line" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "invoice_line_invoice_idx" ON "rentroll"."invoice_line" ("tenant_id","invoice_id");
--> statement-breakpoint
CREATE INDEX "payment_tenant_idx" ON "rentroll"."payment" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "payment_status_idx" ON "rentroll"."payment" ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX "payment_allocation_tenant_idx" ON "rentroll"."payment_allocation" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "credit_note_tenant_idx" ON "rentroll"."credit_note" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "checklist_tenant_idx" ON "rentroll"."checklist" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "settlement_tenant_idx" ON "rentroll"."settlement" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "repair_ticket_tenant_idx" ON "rentroll"."repair_ticket" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "repair_ticket_status_idx" ON "rentroll"."repair_ticket" ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX "ticket_message_tenant_idx" ON "rentroll"."ticket_message" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "ticket_message_ticket_idx" ON "rentroll"."ticket_message" ("tenant_id","ticket_id");
--> statement-breakpoint
CREATE INDEX "announcement_tenant_idx" ON "rentroll"."announcement" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "doc_sequence_tenant_idx" ON "rentroll"."doc_sequence" ("tenant_id");
