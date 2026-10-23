-- Sent invoices are immutable (01 §4). Once an invoice leaves draft, its identity and amounts cannot change, and its
-- lines cannot be edited or removed. Only the payment fields (paid_satang) and the status move forward (sent →
-- partially_paid → paid). Corrections are a credit note or an adjustment on a later invoice, never an edit.
-- Inserts are not guarded: the seed and clone_demo_tenant write an invoice and then its lines in one transaction.
-- The demo reset is the only deletion path: delete_demo_tenant sets rentroll.demo_delete for its own transaction.

CREATE OR REPLACE FUNCTION rentroll.guard_sent_invoice() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' AND coalesce(current_setting('rentroll.demo_delete', true), '') <> 'on' THEN
      RAISE EXCEPTION 'sent invoice % cannot be deleted: issue a credit note instead', OLD.number
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'draft' THEN
    RETURN NEW;
  END IF;
  IF (NEW.id, NEW.tenant_id, NEW.building_id, NEW.contract_id, NEW.number, NEW.type, NEW.period,
      NEW.issue_date, NEW.due_date, NEW.subtotal_satang, NEW.total_satang, NEW.sent_at, NEW.public_token)
     IS DISTINCT FROM
     (OLD.id, OLD.tenant_id, OLD.building_id, OLD.contract_id, OLD.number, OLD.type, OLD.period,
      OLD.issue_date, OLD.due_date, OLD.subtotal_satang, OLD.total_satang, OLD.sent_at, OLD.public_token) THEN
    RAISE EXCEPTION 'sent invoice % is immutable: issue a credit note or an adjustment instead', OLD.number
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status NOT IN ('sent', 'partially_paid', 'paid') THEN
    RAISE EXCEPTION 'sent invoice % can only move to sent, partially paid or paid', OLD.number
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS invoice_guard ON rentroll.invoice;
CREATE TRIGGER invoice_guard
  BEFORE UPDATE OR DELETE ON rentroll.invoice
  FOR EACH ROW EXECUTE FUNCTION rentroll.guard_sent_invoice();

--> statement-breakpoint

CREATE OR REPLACE FUNCTION rentroll.guard_invoice_line() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  parent_status text;
BEGIN
  SELECT status INTO parent_status FROM rentroll.invoice WHERE id = OLD.invoice_id;
  IF parent_status IS NOT NULL AND parent_status <> 'draft'
     AND coalesce(current_setting('rentroll.demo_delete', true), '') <> 'on' THEN
    RAISE EXCEPTION 'lines of a sent invoice cannot be changed' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS invoice_line_guard ON rentroll.invoice_line;
CREATE TRIGGER invoice_line_guard
  BEFORE UPDATE OR DELETE ON rentroll.invoice_line
  FOR EACH ROW EXECUTE FUNCTION rentroll.guard_invoice_line();

--> statement-breakpoint

-- The public invoice link needs no session. This lookup returns only the tenant and invoice ids for a token.
CREATE OR REPLACE FUNCTION rentroll.find_invoice_by_token(token text)
RETURNS TABLE (tenant_id uuid, invoice_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = rentroll
AS $$
  SELECT i.tenant_id, i.id FROM rentroll.invoice i WHERE i.public_token = token
$$;

--> statement-breakpoint

-- Children before parents. Same body as 0001; the flag lets the guards above allow this one reset.
CREATE OR REPLACE FUNCTION rentroll.delete_demo_tenant(target uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('rentroll.demo_delete', 'on', true);
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
