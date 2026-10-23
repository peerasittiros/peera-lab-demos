-- Template periods read '~mNN' (NN months before the current month); the clone turns them into 'YYYY-MM'.
CREATE OR REPLACE FUNCTION rentroll.period_for(template_period char(7), today date)
RETURNS char(7)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN template_period IS NULL THEN NULL
    WHEN btrim(template_period) LIKE '~m%' THEN
      to_char(date_trunc('month', today) - make_interval(months => substring(btrim(template_period) from 3)::int), 'YYYY-MM')
    ELSE template_period
  END
$$;
--> statement-breakpoint

-- Per-visitor sandbox (platform §6.1), written from packages/db/sql/clone-template.sql. Parents before children;
-- one id map remaps every foreign key. Relative template dates (days_ago) become timestamps for "today" in
-- Asia/Bangkok, so the demo always looks current.
CREATE OR REPLACE FUNCTION rentroll.clone_demo_tenant(template uuid, target uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  today date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
BEGIN
  CREATE TEMP TABLE rentroll_id_map (old uuid PRIMARY KEY, new uuid NOT NULL) ON COMMIT DROP;

  INSERT INTO rentroll_id_map SELECT id, gen_random_uuid() FROM rentroll.building WHERE tenant_id = template;
  INSERT INTO rentroll.building (id, tenant_id, name_th, name_en, address_th, address_en, promptpay_id, bank_name,
      bank_account_masked, billing_day, due_day, invoice_year_style)
    SELECT m.new, target, t.name_th, t.name_en, t.address_th, t.address_en, t.promptpay_id, t.bank_name,
      t.bank_account_masked, t.billing_day, t.due_day, t.invoice_year_style
    FROM rentroll.building t JOIN rentroll_id_map m ON m.old = t.id WHERE t.tenant_id = template;

  INSERT INTO rentroll_id_map SELECT id, gen_random_uuid() FROM rentroll.room_type WHERE tenant_id = template;
  INSERT INTO rentroll.room_type (id, tenant_id, building_id, name_th, name_en, monthly_rent_satang, daily_rent_satang,
      deposit_satang, advance_months)
    SELECT m.new, target, b.new, t.name_th, t.name_en, t.monthly_rent_satang, t.daily_rent_satang, t.deposit_satang,
      t.advance_months
    FROM rentroll.room_type t
    JOIN rentroll_id_map m ON m.old = t.id
    JOIN rentroll_id_map b ON b.old = t.building_id
    WHERE t.tenant_id = template;

  INSERT INTO rentroll.rate_plan (id, tenant_id, building_id, valid_from, elec_rate_satang, elec_min_satang, water_mode,
      water_rate_satang, water_min_satang, water_per_person_satang, common_fee_satang, late_fee_rule)
    SELECT gen_random_uuid(), target, b.new, t.valid_from, t.elec_rate_satang, t.elec_min_satang, t.water_mode,
      t.water_rate_satang, t.water_min_satang, t.water_per_person_satang, t.common_fee_satang, t.late_fee_rule
    FROM rentroll.rate_plan t
    JOIN rentroll_id_map b ON b.old = t.building_id
    WHERE t.tenant_id = template;

  INSERT INTO rentroll_id_map SELECT id, gen_random_uuid() FROM rentroll.room WHERE tenant_id = template;
  INSERT INTO rentroll.room (id, tenant_id, building_id, number, floor, room_type_id, size_sqm, maintenance,
      elec_meter_digits, water_meter_digits, sort)
    SELECT m.new, target, b.new, t.number, t.floor, rt.new, t.size_sqm, t.maintenance, t.elec_meter_digits,
      t.water_meter_digits, t.sort
    FROM rentroll.room t
    JOIN rentroll_id_map m ON m.old = t.id
    JOIN rentroll_id_map b ON b.old = t.building_id
    JOIN rentroll_id_map rt ON rt.old = t.room_type_id
    WHERE t.tenant_id = template;

  INSERT INTO rentroll_id_map SELECT id, gen_random_uuid() FROM rentroll.renter WHERE tenant_id = template;
  INSERT INTO rentroll.renter (id, tenant_id, name, phone, line_user_id, preferred_locale, emergency_contact, note)
    SELECT m.new, target, t.name, t.phone, t.line_user_id, t.preferred_locale, t.emergency_contact, t.note
    FROM rentroll.renter t JOIN rentroll_id_map m ON m.old = t.id WHERE t.tenant_id = template;

  INSERT INTO rentroll_id_map SELECT id, gen_random_uuid() FROM rentroll.contract WHERE tenant_id = template;
  INSERT INTO rentroll.contract (id, tenant_id, room_id, start_date, end_date, notice_date, status, monthly_rent_satang,
      deposit_satang, deposit_received_satang, advance_months, occupants, extras, note)
    SELECT m.new, target, r.new,
      CASE WHEN t.start_days_ago IS NULL THEN t.start_date ELSE today - t.start_days_ago END,
      CASE WHEN t.end_days_ago IS NULL THEN t.end_date ELSE today - t.end_days_ago END,
      CASE WHEN t.notice_days_ago IS NULL THEN t.notice_date ELSE today - t.notice_days_ago END,
      t.status, t.monthly_rent_satang, t.deposit_satang, t.deposit_received_satang,
      t.advance_months, t.occupants, t.extras, t.note
    FROM rentroll.contract t
    JOIN rentroll_id_map m ON m.old = t.id
    JOIN rentroll_id_map r ON r.old = t.room_id
    WHERE t.tenant_id = template;

  INSERT INTO rentroll.contract_renter (tenant_id, contract_id, renter_id, is_primary)
    SELECT target, c.new, rn.new, t.is_primary
    FROM rentroll.contract_renter t
    JOIN rentroll_id_map c ON c.old = t.contract_id
    JOIN rentroll_id_map rn ON rn.old = t.renter_id
    WHERE t.tenant_id = template;

  INSERT INTO rentroll.meter_reading (id, tenant_id, room_id, kind, period, reading, units_used, is_rollover, is_estimate,
      photo_url, anomaly, read_by, read_at)
    SELECT gen_random_uuid(), target, r.new, t.kind, rentroll.period_for(t.period, today), t.reading, t.units_used, t.is_rollover, t.is_estimate,
      t.photo_url, t.anomaly, t.read_by,
      CASE WHEN t.days_ago IS NULL THEN t.read_at
        ELSE ((today - t.days_ago)::timestamp + interval '9 hours') AT TIME ZONE 'Asia/Bangkok' END
    FROM rentroll.meter_reading t
    JOIN rentroll_id_map r ON r.old = t.room_id
    WHERE t.tenant_id = template;

  INSERT INTO rentroll_id_map SELECT id, gen_random_uuid() FROM rentroll.invoice WHERE tenant_id = template;
  INSERT INTO rentroll.invoice (id, tenant_id, building_id, contract_id, number, type, period, issue_date, due_date,
      status, subtotal_satang, total_satang, paid_satang, sent_at, public_token)
    SELECT m.new, target, b.new, c.new, t.number, t.type, rentroll.period_for(t.period, today),
      CASE WHEN t.days_ago IS NULL THEN t.issue_date ELSE today - t.days_ago END,
      CASE WHEN t.days_ago IS NULL THEN t.due_date ELSE today - t.days_ago + (t.due_date - t.issue_date) END,
      t.status, t.subtotal_satang, t.total_satang, t.paid_satang,
      CASE WHEN t.days_ago IS NULL THEN t.sent_at ELSE ((today - t.days_ago)::timestamp + interval '9 hours') AT TIME ZONE 'Asia/Bangkok' END,
      gen_random_uuid()::text
    FROM rentroll.invoice t
    JOIN rentroll_id_map m ON m.old = t.id
    JOIN rentroll_id_map b ON b.old = t.building_id
    JOIN rentroll_id_map c ON c.old = t.contract_id
    WHERE t.tenant_id = template;

  INSERT INTO rentroll.invoice_line (id, tenant_id, invoice_id, kind, label_th, label_en, qty, unit_price_satang,
      amount_satang, meta)
    SELECT gen_random_uuid(), target, i.new, t.kind, t.label_th, t.label_en, t.qty, t.unit_price_satang,
      t.amount_satang, t.meta
    FROM rentroll.invoice_line t
    JOIN rentroll_id_map i ON i.old = t.invoice_id
    WHERE t.tenant_id = template;

  INSERT INTO rentroll_id_map SELECT id, gen_random_uuid() FROM rentroll.payment WHERE tenant_id = template;
  INSERT INTO rentroll.payment (id, tenant_id, contract_id, amount_satang, method, paid_at, slip_url, status,
      reviewed_by, reject_reason, receipt_number)
    SELECT m.new, target, c.new, t.amount_satang, t.method,
      CASE WHEN t.days_ago IS NULL THEN t.paid_at
        ELSE ((today - t.days_ago)::timestamp + make_interval(mins => coalesce(t.minute_of_day, 600))) AT TIME ZONE 'Asia/Bangkok' END,
      t.slip_url, t.status, t.reviewed_by, t.reject_reason, t.receipt_number
    FROM rentroll.payment t
    JOIN rentroll_id_map m ON m.old = t.id
    JOIN rentroll_id_map c ON c.old = t.contract_id
    WHERE t.tenant_id = template;

  INSERT INTO rentroll.payment_allocation (tenant_id, payment_id, invoice_id, amount_satang)
    SELECT target, p.new, i.new, t.amount_satang
    FROM rentroll.payment_allocation t
    JOIN rentroll_id_map p ON p.old = t.payment_id
    JOIN rentroll_id_map i ON i.old = t.invoice_id
    WHERE t.tenant_id = template;

  INSERT INTO rentroll.credit_note (id, tenant_id, invoice_id, number, amount_satang, reason)
    SELECT gen_random_uuid(), target, i.new, t.number, t.amount_satang, t.reason
    FROM rentroll.credit_note t
    JOIN rentroll_id_map i ON i.old = t.invoice_id
    WHERE t.tenant_id = template;

  INSERT INTO rentroll.checklist (id, tenant_id, contract_id, kind, items, completed_at)
    SELECT gen_random_uuid(), target, c.new, t.kind, t.items, t.completed_at
    FROM rentroll.checklist t
    JOIN rentroll_id_map c ON c.old = t.contract_id
    WHERE t.tenant_id = template;

  INSERT INTO rentroll.settlement (id, tenant_id, contract_id, deposit_satang, deductions, refund_satang, settled_at)
    SELECT gen_random_uuid(), target, c.new, t.deposit_satang, t.deductions, t.refund_satang, t.settled_at
    FROM rentroll.settlement t
    JOIN rentroll_id_map c ON c.old = t.contract_id
    WHERE t.tenant_id = template;

  INSERT INTO rentroll_id_map SELECT id, gen_random_uuid() FROM rentroll.repair_ticket WHERE tenant_id = template;
  INSERT INTO rentroll.repair_ticket (id, tenant_id, room_id, renter_id, category, description, photo_url,
      preferred_time, allow_entry, status, assignee, scheduled_at, cost_satang, bill_to_renter, closed_at)
    SELECT m.new, target, r.new, rn.new, t.category, t.description, t.photo_url, t.preferred_time, t.allow_entry,
      t.status, t.assignee,
      CASE WHEN t.days_ago IS NULL THEN t.scheduled_at ELSE ((today - t.days_ago)::timestamp + interval '10 hours') AT TIME ZONE 'Asia/Bangkok' END,
      t.cost_satang, t.bill_to_renter, t.closed_at
    FROM rentroll.repair_ticket t
    JOIN rentroll_id_map m ON m.old = t.id
    JOIN rentroll_id_map r ON r.old = t.room_id
    LEFT JOIN rentroll_id_map rn ON rn.old = t.renter_id
    WHERE t.tenant_id = template;

  INSERT INTO rentroll.ticket_message (id, tenant_id, ticket_id, author_role, body, at)
    SELECT gen_random_uuid(), target, k.new, t.author_role, t.body,
      CASE WHEN t.days_ago IS NULL THEN t.at ELSE ((today - t.days_ago)::timestamp + make_interval(mins => coalesce(t.minute_of_day, 600))) AT TIME ZONE 'Asia/Bangkok' END
    FROM rentroll.ticket_message t
    JOIN rentroll_id_map k ON k.old = t.ticket_id
    WHERE t.tenant_id = template;

  INSERT INTO rentroll.announcement (id, tenant_id, building_id, title_th, title_en, body_th, body_en, published_at, expires_at)
    SELECT gen_random_uuid(), target, b.new, t.title_th, t.title_en, t.body_th, t.body_en,
      CASE WHEN t.days_ago IS NULL THEN t.published_at ELSE ((today - t.days_ago)::timestamp + interval '8 hours') AT TIME ZONE 'Asia/Bangkok' END,
      t.expires_at
    FROM rentroll.announcement t
    JOIN rentroll_id_map b ON b.old = t.building_id
    WHERE t.tenant_id = template;

  INSERT INTO rentroll.doc_sequence (tenant_id, building_id, doc_type, year, next_no)
    SELECT target, b.new, t.doc_type, t.year, t.next_no
    FROM rentroll.doc_sequence t
    JOIN rentroll_id_map b ON b.old = t.building_id
    WHERE t.tenant_id = template;

  DROP TABLE rentroll_id_map;
END
$$;
--> statement-breakpoint

-- Children before parents.
CREATE OR REPLACE FUNCTION rentroll.delete_demo_tenant(target uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM rentroll.doc_sequence WHERE tenant_id = target;
  DELETE FROM rentroll.announcement WHERE tenant_id = target;
  DELETE FROM rentroll.ticket_message WHERE tenant_id = target;
  DELETE FROM rentroll.repair_ticket WHERE tenant_id = target;
  DELETE FROM rentroll.settlement WHERE tenant_id = target;
  DELETE FROM rentroll.checklist WHERE tenant_id = target;
  DELETE FROM rentroll.credit_note WHERE tenant_id = target;
  DELETE FROM rentroll.payment_allocation WHERE tenant_id = target;
  DELETE FROM rentroll.payment WHERE tenant_id = target;
  DELETE FROM rentroll.invoice_line WHERE tenant_id = target;
  DELETE FROM rentroll.invoice WHERE tenant_id = target;
  DELETE FROM rentroll.meter_reading WHERE tenant_id = target;
  DELETE FROM rentroll.contract_renter WHERE tenant_id = target;
  DELETE FROM rentroll.contract WHERE tenant_id = target;
  DELETE FROM rentroll.renter WHERE tenant_id = target;
  DELETE FROM rentroll.room WHERE tenant_id = target;
  DELETE FROM rentroll.room_type WHERE tenant_id = target;
  DELETE FROM rentroll.rate_plan WHERE tenant_id = target;
  DELETE FROM rentroll.building WHERE tenant_id = target;
END
$$;
