-- The one write path for a stock movement in the database (the production edition's; the demo records movements in
-- the browser store). The balance moves in a single statement that takes the item's balance row lock, and the
-- movement is written with the balance it produced, in the same transaction. Concurrent calls for one item queue on
-- that lock, so item_balance always equals the sum of the ledger and every balance_after is a real running total.
CREATE OR REPLACE FUNCTION stockline.record_movement(
  p_tenant uuid,
  p_item uuid,
  p_type text,
  p_reason text,
  p_quantity integer,
  p_user uuid DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_occurred_at timestamptz DEFAULT now()
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  balance integer;
BEGIN
  INSERT INTO stockline.item_balance AS b (item_id, tenant_id, on_hand)
    VALUES (p_item, p_tenant, p_quantity)
  ON CONFLICT (item_id) DO UPDATE
    SET on_hand = b.on_hand + EXCLUDED.on_hand, updated_at = now()
    WHERE b.tenant_id = EXCLUDED.tenant_id
  RETURNING on_hand INTO balance;

  IF balance IS NULL THEN
    RAISE EXCEPTION 'item % does not belong to tenant %', p_item, p_tenant;
  END IF;

  INSERT INTO stockline.stock_movement
    (tenant_id, item_id, type, reason, quantity_base, user_id, note, reference, occurred_at, balance_after)
  VALUES
    (p_tenant, p_item, p_type, p_reason, p_quantity, p_user, p_note, p_reference, p_occurred_at, balance);

  RETURN balance;
END;
$$;
