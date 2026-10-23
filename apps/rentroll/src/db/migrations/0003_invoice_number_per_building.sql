-- Numbering sequences are per building per year (01 §4), so a number is unique per building, not per tenant.
-- Two buildings each issue INV-2569-10-0001 in their first month; the old tenant-wide constraint refused the second.

ALTER TABLE rentroll.invoice DROP CONSTRAINT IF EXISTS invoice_number_uq;
ALTER TABLE rentroll.invoice ADD CONSTRAINT invoice_number_uq UNIQUE (tenant_id, building_id, number);
