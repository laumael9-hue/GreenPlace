-- 032: Track whether an order is currently holding listing stock.
--
-- Stock is now reserved when an order is placed (for every payment method, including
-- GCash/Maya), and released when the order is cancelled, refunded, or its online payment
-- fails/expires. This flag makes that explicit so stock is never taken or returned twice.

INSERT INTO schema_version (version, description)
VALUES (32, 'Order stock_reserved flag')
ON CONFLICT (version) DO NOTHING;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS stock_reserved BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill with the old rule: cash orders and paid orders held stock; cancelled and
-- refunded orders already gave it back.
UPDATE orders
SET stock_reserved = TRUE
WHERE (payment_method = 'cash_on_pickup' OR payment_status = 'paid')
  AND status NOT IN ('cancelled', 'refunded')
  AND payment_status <> 'refunded';

-- Lets the stale-order sweep find unpaid online orders quickly.
CREATE INDEX IF NOT EXISTS idx_orders_unpaid_reserved
    ON orders(created_at)
    WHERE stock_reserved = TRUE AND payment_status IN ('pending', 'failed');
