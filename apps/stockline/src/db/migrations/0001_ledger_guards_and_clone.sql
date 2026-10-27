-- Search (02 §5): trigram indexes for Thai/English names and SKUs. They also serve ILIKE '%…%'.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS item_name_th_trgm_idx ON stockline.item USING gin (name_th gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS item_name_en_trgm_idx ON stockline.item USING gin (name_en gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS item_sku_trgm_idx ON stockline.item USING gin (sku gin_trgm_ops);
--> statement-breakpoint

-- The ledger is append-only (02 §4). Corrections are new `adjust` rows. The only delete allowed is
-- delete_demo_tenant removing a whole sandbox tenant, which sets stockline.tenant_delete for its transaction.
CREATE OR REPLACE FUNCTION stockline.reject_stock_movement_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('stockline.tenant_delete', true) = OLD.tenant_id::text THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'stock_movement is append-only: % is not allowed', TG_OP
    USING ERRCODE = '55000';
END
$$;
--> statement-breakpoint
CREATE TRIGGER stock_movement_append_only
BEFORE UPDATE OR DELETE ON stockline.stock_movement
FOR EACH ROW EXECUTE FUNCTION stockline.reject_stock_movement_mutation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION stockline.reject_stock_movement_truncate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'stock_movement is append-only: TRUNCATE is not allowed' USING ERRCODE = '55000';
END
$$;
--> statement-breakpoint
CREATE TRIGGER stock_movement_no_truncate
BEFORE TRUNCATE ON stockline.stock_movement
FOR EACH STATEMENT EXECUTE FUNCTION stockline.reject_stock_movement_truncate();
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON stockline.stock_movement FROM PUBLIC;
--> statement-breakpoint

-- Relative template time → a real timestamp (Asia/Bangkok). Day 0 rows never land in the future: the result is
-- capped just before now, keeping their order (both terms rise with minute_of_day).
CREATE OR REPLACE FUNCTION stockline.relative_time(days_ago integer, minute_of_day integer)
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT least(
    (((now() AT TIME ZONE 'Asia/Bangkok')::date - days_ago)::timestamp
      + make_interval(mins => coalesce(minute_of_day, 600))) AT TIME ZONE 'Asia/Bangkok',
    now() - make_interval(secs => 1440 - coalesce(minute_of_day, 600))
  )
$$;
--> statement-breakpoint

-- Per-visitor sandbox (platform §6.1), written from packages/db/sql/clone-template.sql. Parents before children;
-- one id map remaps every foreign key.
CREATE OR REPLACE FUNCTION stockline.clone_demo_tenant(template uuid, target uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  CREATE TEMP TABLE stockline_id_map (old uuid PRIMARY KEY, new uuid NOT NULL) ON COMMIT DROP;

  INSERT INTO stockline.shop_settings (tenant_id, shop_name_th, shop_name_en, low_stock_rule, reorder_weekday)
    SELECT target, t.shop_name_th, t.shop_name_en, t.low_stock_rule, t.reorder_weekday
    FROM stockline.shop_settings t WHERE t.tenant_id = template;

  INSERT INTO stockline_id_map SELECT id, gen_random_uuid() FROM stockline.unit WHERE tenant_id = template;
  INSERT INTO stockline.unit (id, tenant_id, name_th, name_en, symbol)
    SELECT m.new, target, t.name_th, t.name_en, t.symbol
    FROM stockline.unit t JOIN stockline_id_map m ON m.old = t.id WHERE t.tenant_id = template;

  INSERT INTO stockline_id_map SELECT id, gen_random_uuid() FROM stockline.category WHERE tenant_id = template;
  INSERT INTO stockline.category (id, tenant_id, name_th, name_en, sort)
    SELECT m.new, target, t.name_th, t.name_en, t.sort
    FROM stockline.category t JOIN stockline_id_map m ON m.old = t.id WHERE t.tenant_id = template;

  INSERT INTO stockline_id_map SELECT id, gen_random_uuid() FROM stockline.supplier WHERE tenant_id = template;
  INSERT INTO stockline.supplier (id, tenant_id, name, contact_name, phone, line_id, lead_time_days, note)
    SELECT m.new, target, t.name, t.contact_name, t.phone, t.line_id, t.lead_time_days, t.note
    FROM stockline.supplier t JOIN stockline_id_map m ON m.old = t.id WHERE t.tenant_id = template;

  INSERT INTO stockline_id_map SELECT id, gen_random_uuid() FROM stockline.app_user WHERE tenant_id = template;
  INSERT INTO stockline.app_user (id, tenant_id, display_name, role)
    SELECT m.new, target, t.display_name, t.role
    FROM stockline.app_user t JOIN stockline_id_map m ON m.old = t.id WHERE t.tenant_id = template;

  INSERT INTO stockline_id_map SELECT id, gen_random_uuid() FROM stockline.item WHERE tenant_id = template;
  INSERT INTO stockline.item (id, tenant_id, sku, barcode, name_th, name_en, category_id, base_unit_id, cost_satang,
      price_satang, min_qty, reorder_qty, supplier_id, location, image_url, active)
    SELECT m.new, target, t.sku, t.barcode, t.name_th, t.name_en, c.new, u.new, t.cost_satang, t.price_satang,
      t.min_qty, t.reorder_qty, s.new, t.location, t.image_url, t.active
    FROM stockline.item t
    JOIN stockline_id_map m ON m.old = t.id
    JOIN stockline_id_map u ON u.old = t.base_unit_id
    LEFT JOIN stockline_id_map c ON c.old = t.category_id
    LEFT JOIN stockline_id_map s ON s.old = t.supplier_id
    WHERE t.tenant_id = template;

  INSERT INTO stockline.item_unit (id, tenant_id, item_id, unit_id, factor)
    SELECT gen_random_uuid(), target, i.new, u.new, t.factor
    FROM stockline.item_unit t
    JOIN stockline_id_map i ON i.old = t.item_id
    JOIN stockline_id_map u ON u.old = t.unit_id
    WHERE t.tenant_id = template;

  INSERT INTO stockline_id_map SELECT id, gen_random_uuid() FROM stockline.purchase_order WHERE tenant_id = template;
  INSERT INTO stockline.purchase_order (id, tenant_id, number, supplier_id, status, ordered_at, expected_at,
      received_at, note, created_by)
    SELECT m.new, target, t.number, s.new, t.status,
      CASE WHEN t.ordered_days_ago IS NULL THEN t.ordered_at ELSE stockline.relative_time(t.ordered_days_ago, 600) END,
      CASE WHEN t.expected_days_ago IS NULL THEN t.expected_at
        ELSE (((now() AT TIME ZONE 'Asia/Bangkok')::date - t.expected_days_ago)::timestamp + interval '10 hours')
          AT TIME ZONE 'Asia/Bangkok' END,
      CASE WHEN t.received_days_ago IS NULL THEN t.received_at ELSE stockline.relative_time(t.received_days_ago, 660) END,
      t.note, cb.new
    FROM stockline.purchase_order t
    JOIN stockline_id_map m ON m.old = t.id
    LEFT JOIN stockline_id_map s ON s.old = t.supplier_id
    LEFT JOIN stockline_id_map cb ON cb.old = t.created_by
    WHERE t.tenant_id = template;

  INSERT INTO stockline.purchase_order_line (id, tenant_id, purchase_order_id, item_id, qty_base, received_base)
    SELECT gen_random_uuid(), target, po.new, i.new, t.qty_base, t.received_base
    FROM stockline.purchase_order_line t
    JOIN stockline_id_map po ON po.old = t.purchase_order_id
    JOIN stockline_id_map i ON i.old = t.item_id
    WHERE t.tenant_id = template;

  INSERT INTO stockline_id_map SELECT id, gen_random_uuid() FROM stockline.count_session WHERE tenant_id = template;
  INSERT INTO stockline.count_session (id, tenant_id, number, scope, status, blind, started_by, started_at,
      submitted_at, approved_by, approved_at)
    SELECT m.new, target, t.number,
      CASE WHEN t.scope->>'kind' = 'category'
        THEN jsonb_build_object('kind', 'category', 'categoryId', cat.new)
        ELSE t.scope END,
      t.status, t.blind, sb.new,
      CASE WHEN t.days_ago IS NULL THEN t.started_at ELSE stockline.relative_time(t.days_ago, 540) END,
      CASE WHEN t.days_ago IS NULL OR t.submitted_at IS NULL THEN t.submitted_at
        ELSE stockline.relative_time(t.days_ago, 660) END,
      ab.new,
      CASE WHEN t.days_ago IS NULL OR t.approved_at IS NULL THEN t.approved_at
        ELSE stockline.relative_time(t.days_ago, 1020) END
    FROM stockline.count_session t
    JOIN stockline_id_map m ON m.old = t.id
    LEFT JOIN stockline_id_map sb ON sb.old = t.started_by
    LEFT JOIN stockline_id_map ab ON ab.old = t.approved_by
    LEFT JOIN stockline_id_map cat ON cat.old = (t.scope->>'categoryId')::uuid
    WHERE t.tenant_id = template;

  INSERT INTO stockline.count_line (id, tenant_id, count_session_id, item_id, expected, counted, counted_at)
    SELECT gen_random_uuid(), target, cs.new, i.new, t.expected, t.counted,
      CASE WHEN s.days_ago IS NULL OR t.counted_at IS NULL THEN t.counted_at
        ELSE stockline.relative_time(s.days_ago, 600) END
    FROM stockline.count_line t
    JOIN stockline.count_session s ON s.id = t.count_session_id
    JOIN stockline_id_map cs ON cs.old = t.count_session_id
    JOIN stockline_id_map i ON i.old = t.item_id
    WHERE t.tenant_id = template;

  INSERT INTO stockline.stock_movement (id, tenant_id, item_id, type, reason, quantity_base, entered_qty,
      entered_unit_id, unit_cost_satang, reference, purchase_order_id, count_session_id, note, user_id, occurred_at,
      balance_after)
    SELECT gen_random_uuid(), target, i.new, t.type, t.reason, t.quantity_base, t.entered_qty, u.new,
      t.unit_cost_satang, t.reference, po.new, cs.new, t.note, usr.new,
      CASE WHEN t.days_ago IS NULL THEN t.occurred_at ELSE stockline.relative_time(t.days_ago, t.minute_of_day) END,
      t.balance_after
    FROM stockline.stock_movement t
    JOIN stockline_id_map i ON i.old = t.item_id
    LEFT JOIN stockline_id_map u ON u.old = t.entered_unit_id
    LEFT JOIN stockline_id_map po ON po.old = t.purchase_order_id
    LEFT JOIN stockline_id_map cs ON cs.old = t.count_session_id
    LEFT JOIN stockline_id_map usr ON usr.old = t.user_id
    WHERE t.tenant_id = template;

  INSERT INTO stockline.item_balance (item_id, tenant_id, on_hand)
    SELECT i.new, target, b.on_hand
    FROM stockline.item_balance b JOIN stockline_id_map i ON i.old = b.item_id
    WHERE b.tenant_id = template;

  INSERT INTO stockline.audit_event (id, tenant_id, user_id, action, entity, entity_id, diff, at)
    SELECT gen_random_uuid(), target, u.new, t.action, t.entity, coalesce(e.new, t.entity_id), t.diff,
      CASE WHEN t.days_ago IS NULL THEN t.at ELSE stockline.relative_time(t.days_ago, t.minute_of_day) END
    FROM stockline.audit_event t
    LEFT JOIN stockline_id_map u ON u.old = t.user_id
    LEFT JOIN stockline_id_map e ON e.old = t.entity_id
    WHERE t.tenant_id = template;

  DROP TABLE stockline_id_map;
END
$$;
--> statement-breakpoint

-- Children before parents. The ledger trigger lets these deletes through for this tenant only.
CREATE OR REPLACE FUNCTION stockline.delete_demo_tenant(target uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('stockline.tenant_delete', target::text, true);
  DELETE FROM stockline.audit_event WHERE tenant_id = target;
  DELETE FROM stockline.item_balance WHERE tenant_id = target;
  DELETE FROM stockline.stock_movement WHERE tenant_id = target;
  DELETE FROM stockline.count_line WHERE tenant_id = target;
  DELETE FROM stockline.count_session WHERE tenant_id = target;
  DELETE FROM stockline.purchase_order_line WHERE tenant_id = target;
  DELETE FROM stockline.purchase_order WHERE tenant_id = target;
  DELETE FROM stockline.item_unit WHERE tenant_id = target;
  DELETE FROM stockline.item WHERE tenant_id = target;
  DELETE FROM stockline.app_user WHERE tenant_id = target;
  DELETE FROM stockline.supplier WHERE tenant_id = target;
  DELETE FROM stockline.category WHERE tenant_id = target;
  DELETE FROM stockline.unit WHERE tenant_id = target;
  DELETE FROM stockline.shop_settings WHERE tenant_id = target;
  PERFORM set_config('stockline.tenant_delete', '', true);
END
$$;
