CREATE SCHEMA "stockline";
--> statement-breakpoint
CREATE TABLE "stockline"."app_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_user_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "app_user_role_valid" CHECK ("stockline"."app_user"."role" in ('owner', 'staff'))
);
--> statement-breakpoint
CREATE TABLE "stockline"."audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid,
	"diff" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"days_ago" integer,
	"minute_of_day" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stockline"."category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name_th" text NOT NULL,
	"name_en" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_tenant_id_uq" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "stockline"."count_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"count_session_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"expected" integer NOT NULL,
	"counted" integer,
	"counted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "count_line_item_uq" UNIQUE("tenant_id","count_session_id","item_id"),
	CONSTRAINT "count_line_counted_nonnegative" CHECK ("stockline"."count_line"."counted" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stockline"."count_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"number" text NOT NULL,
	"scope" jsonb NOT NULL,
	"status" text NOT NULL,
	"blind" boolean DEFAULT false NOT NULL,
	"started_by" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"days_ago" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "count_session_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "count_session_number_uq" UNIQUE("tenant_id","number"),
	CONSTRAINT "count_session_status_valid" CHECK ("stockline"."count_session"."status" in ('open', 'submitted', 'approved'))
);
--> statement-breakpoint
CREATE TABLE "stockline"."item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"barcode" text,
	"name_th" text NOT NULL,
	"name_en" text,
	"category_id" uuid,
	"base_unit_id" uuid NOT NULL,
	"cost_satang" bigint,
	"price_satang" bigint,
	"min_qty" integer DEFAULT 0 NOT NULL,
	"reorder_qty" integer DEFAULT 0 NOT NULL,
	"supplier_id" uuid,
	"location" text,
	"image_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_tenant_sku_uq" UNIQUE("tenant_id","sku"),
	CONSTRAINT "item_tenant_barcode_uq" UNIQUE("tenant_id","barcode"),
	CONSTRAINT "item_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "item_min_qty_nonnegative" CHECK ("stockline"."item"."min_qty" >= 0),
	CONSTRAINT "item_reorder_qty_nonnegative" CHECK ("stockline"."item"."reorder_qty" >= 0),
	CONSTRAINT "item_cost_nonnegative" CHECK ("stockline"."item"."cost_satang" >= 0),
	CONSTRAINT "item_price_nonnegative" CHECK ("stockline"."item"."price_satang" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stockline"."item_balance" (
	"item_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"on_hand" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_balance_item_id_pk" PRIMARY KEY("item_id")
);
--> statement-breakpoint
CREATE TABLE "stockline"."item_unit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"factor" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_unit_item_unit_uq" UNIQUE("tenant_id","item_id","unit_id"),
	CONSTRAINT "item_unit_factor_gt_one" CHECK ("stockline"."item_unit"."factor" > 1)
);
--> statement-breakpoint
CREATE TABLE "stockline"."purchase_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"number" text NOT NULL,
	"supplier_id" uuid,
	"status" text NOT NULL,
	"ordered_at" timestamp with time zone,
	"expected_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"note" text,
	"created_by" uuid,
	"ordered_days_ago" integer,
	"expected_days_ago" integer,
	"received_days_ago" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_order_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "purchase_order_number_uq" UNIQUE("tenant_id","number"),
	CONSTRAINT "purchase_order_status_valid" CHECK ("stockline"."purchase_order"."status" in ('draft', 'ordered', 'partial', 'received', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "stockline"."purchase_order_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"qty_base" integer NOT NULL,
	"received_base" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_order_line_item_uq" UNIQUE("tenant_id","purchase_order_id","item_id"),
	CONSTRAINT "purchase_order_line_qty_positive" CHECK ("stockline"."purchase_order_line"."qty_base" > 0),
	CONSTRAINT "purchase_order_line_received_nonnegative" CHECK ("stockline"."purchase_order_line"."received_base" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stockline"."shop_settings" (
	"tenant_id" uuid NOT NULL,
	"shop_name_th" text NOT NULL,
	"shop_name_en" text,
	"low_stock_rule" text DEFAULT 'at_or_below_min' NOT NULL,
	"reorder_weekday" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_settings_tenant_id_pk" PRIMARY KEY("tenant_id"),
	CONSTRAINT "shop_settings_low_stock_rule_valid" CHECK ("stockline"."shop_settings"."low_stock_rule" in ('at_or_below_min', 'below_min')),
	CONSTRAINT "shop_settings_reorder_weekday_valid" CHECK ("stockline"."shop_settings"."reorder_weekday" between 1 and 7)
);
--> statement-breakpoint
CREATE TABLE "stockline"."stock_movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"type" text NOT NULL,
	"reason" text NOT NULL,
	"quantity_base" integer NOT NULL,
	"entered_qty" numeric,
	"entered_unit_id" uuid,
	"unit_cost_satang" bigint,
	"reference" text,
	"purchase_order_id" uuid,
	"count_session_id" uuid,
	"note" text,
	"user_id" uuid,
	"occurred_at" timestamp with time zone NOT NULL,
	"balance_after" integer NOT NULL,
	"days_ago" integer,
	"minute_of_day" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movement_type_valid" CHECK ("stockline"."stock_movement"."type" in ('in', 'out', 'adjust')),
	CONSTRAINT "stock_movement_sign_valid" CHECK (("stockline"."stock_movement"."type" = 'in' and "stockline"."stock_movement"."quantity_base" > 0) or ("stockline"."stock_movement"."type" = 'out' and "stockline"."stock_movement"."quantity_base" < 0) or ("stockline"."stock_movement"."type" = 'adjust' and "stockline"."stock_movement"."quantity_base" <> 0))
);
--> statement-breakpoint
CREATE TABLE "stockline"."supplier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"phone" text,
	"line_id" text,
	"lead_time_days" integer DEFAULT 1 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "supplier_lead_time_nonnegative" CHECK ("stockline"."supplier"."lead_time_days" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stockline"."unit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name_th" text NOT NULL,
	"name_en" text,
	"symbol" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_tenant_id_uq" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "stockline"."audit_event" ADD CONSTRAINT "audit_event_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "stockline"."app_user"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockline"."count_line" ADD CONSTRAINT "count_line_session_fk" FOREIGN KEY ("tenant_id","count_session_id") REFERENCES "stockline"."count_session"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockline"."count_line" ADD CONSTRAINT "count_line_item_fk" FOREIGN KEY ("tenant_id","item_id") REFERENCES "stockline"."item"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockline"."count_session" ADD CONSTRAINT "count_session_started_by_fk" FOREIGN KEY ("tenant_id","started_by") REFERENCES "stockline"."app_user"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockline"."count_session" ADD CONSTRAINT "count_session_approved_by_fk" FOREIGN KEY ("tenant_id","approved_by") REFERENCES "stockline"."app_user"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockline"."item" ADD CONSTRAINT "item_category_fk" FOREIGN KEY ("tenant_id","category_id") REFERENCES "stockline"."category"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockline"."item" ADD CONSTRAINT "item_base_unit_fk" FOREIGN KEY ("tenant_id","base_unit_id") REFERENCES "stockline"."unit"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockline"."item" ADD CONSTRAINT "item_supplier_fk" FOREIGN KEY ("tenant_id","supplier_id") REFERENCES "stockline"."supplier"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockline"."item_balance" ADD CONSTRAINT "item_balance_item_fk" FOREIGN KEY ("tenant_id","item_id") REFERENCES "stockline"."item"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockline"."item_unit" ADD CONSTRAINT "item_unit_item_fk" FOREIGN KEY ("tenant_id","item_id") REFERENCES "stockline"."item"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockline"."item_unit" ADD CONSTRAINT "item_unit_unit_fk" FOREIGN KEY ("tenant_id","unit_id") REFERENCES "stockline"."unit"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockline"."purchase_order" ADD CONSTRAINT "purchase_order_supplier_fk" FOREIGN KEY ("tenant_id","supplier_id") REFERENCES "stockline"."supplier"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockline"."purchase_order" ADD CONSTRAINT "purchase_order_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "stockline"."app_user"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockline"."purchase_order_line" ADD CONSTRAINT "purchase_order_line_order_fk" FOREIGN KEY ("tenant_id","purchase_order_id") REFERENCES "stockline"."purchase_order"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockline"."purchase_order_line" ADD CONSTRAINT "purchase_order_line_item_fk" FOREIGN KEY ("tenant_id","item_id") REFERENCES "stockline"."item"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockline"."stock_movement" ADD CONSTRAINT "stock_movement_item_fk" FOREIGN KEY ("tenant_id","item_id") REFERENCES "stockline"."item"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockline"."stock_movement" ADD CONSTRAINT "stock_movement_unit_fk" FOREIGN KEY ("tenant_id","entered_unit_id") REFERENCES "stockline"."unit"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockline"."stock_movement" ADD CONSTRAINT "stock_movement_order_fk" FOREIGN KEY ("tenant_id","purchase_order_id") REFERENCES "stockline"."purchase_order"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockline"."stock_movement" ADD CONSTRAINT "stock_movement_count_fk" FOREIGN KEY ("tenant_id","count_session_id") REFERENCES "stockline"."count_session"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockline"."stock_movement" ADD CONSTRAINT "stock_movement_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "stockline"."app_user"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_user_tenant_idx" ON "stockline"."app_user" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_event_tenant_idx" ON "stockline"."audit_event" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_event_entity_idx" ON "stockline"."audit_event" USING btree ("tenant_id","entity","entity_id");--> statement-breakpoint
CREATE INDEX "category_tenant_idx" ON "stockline"."category" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "count_line_tenant_idx" ON "stockline"."count_line" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "count_line_session_idx" ON "stockline"."count_line" USING btree ("tenant_id","count_session_id");--> statement-breakpoint
CREATE INDEX "count_session_tenant_idx" ON "stockline"."count_session" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "item_tenant_idx" ON "stockline"."item" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "item_active_category_idx" ON "stockline"."item" USING btree ("tenant_id","active","category_id");--> statement-breakpoint
CREATE INDEX "item_balance_tenant_idx" ON "stockline"."item_balance" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "item_unit_tenant_idx" ON "stockline"."item_unit" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "purchase_order_tenant_idx" ON "stockline"."purchase_order" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "purchase_order_status_idx" ON "stockline"."purchase_order" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "purchase_order_line_tenant_idx" ON "stockline"."purchase_order_line" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "purchase_order_line_order_idx" ON "stockline"."purchase_order_line" USING btree ("tenant_id","purchase_order_id");--> statement-breakpoint
CREATE INDEX "stock_movement_tenant_idx" ON "stockline"."stock_movement" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "stock_movement_tenant_item_occurred_idx" ON "stockline"."stock_movement" USING btree ("tenant_id","item_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "stock_movement_tenant_occurred_idx" ON "stockline"."stock_movement" USING btree ("tenant_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "supplier_tenant_idx" ON "stockline"."supplier" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "unit_tenant_idx" ON "stockline"."unit" USING btree ("tenant_id");