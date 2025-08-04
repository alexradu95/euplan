CREATE TABLE "dashboard_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"period" text NOT NULL,
	"layout" text NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "widget_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"widget_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"period_id" text NOT NULL,
	"data" text,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "widgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"config_id" uuid NOT NULL,
	"type" text NOT NULL,
	"position" text NOT NULL,
	"settings" text,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "dashboard_configs" ADD CONSTRAINT "dashboard_configs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widget_data" ADD CONSTRAINT "widget_data_widget_id_widgets_id_fk" FOREIGN KEY ("widget_id") REFERENCES "public"."widgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widget_data" ADD CONSTRAINT "widget_data_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widgets" ADD CONSTRAINT "widgets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widgets" ADD CONSTRAINT "widgets_config_id_dashboard_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."dashboard_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_dashboard_configs_user_period" ON "dashboard_configs" USING btree ("user_id","period");--> statement-breakpoint
CREATE INDEX "idx_dashboard_configs_user_updated_at" ON "dashboard_configs" USING btree ("user_id","updatedAt");--> statement-breakpoint
CREATE INDEX "idx_widget_data_widget_period" ON "widget_data" USING btree ("widget_id","period_id");--> statement-breakpoint
CREATE INDEX "idx_widget_data_user_period" ON "widget_data" USING btree ("user_id","period_id");--> statement-breakpoint
CREATE INDEX "idx_widget_data_widget_updated_at" ON "widget_data" USING btree ("widget_id","updatedAt");--> statement-breakpoint
CREATE INDEX "idx_widgets_config_id" ON "widgets" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX "idx_widgets_user_type" ON "widgets" USING btree ("user_id","type");