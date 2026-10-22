CREATE SCHEMA "platform";
--> statement-breakpoint
CREATE TABLE "platform"."demo_session" (
	"app" text NOT NULL,
	"id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"variant" text NOT NULL,
	"locale" text DEFAULT 'th' NOT NULL,
	"role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "demo_session_app_id_pk" PRIMARY KEY("app","id")
);
--> statement-breakpoint
CREATE TABLE "platform"."event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."mock_message" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"channel" text DEFAULT 'line' NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "demo_session_tenant_idx" ON "platform"."demo_session" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "demo_session_created_idx" ON "platform"."demo_session" USING btree ("app","created_at");--> statement-breakpoint
CREATE INDEX "event_tenant_idx" ON "platform"."event" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "mock_message_tenant_idx" ON "platform"."mock_message" USING btree ("tenant_id","id");