-- 012_order_refunds.sql
-- Add refund tracking fields to orders table

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS refund_reason TEXT,
  ADD COLUMN IF NOT EXISTS refund_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- Create refunds table for detailed audit trail
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_id UUID,
  paymongo_refund_id TEXT,
  amount NUMERIC(10, 2) NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by UUID NOT NULL REFERENCES profiles(id),
  processed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

-- RLS policies
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- Buyers can view refunds for their orders
CREATE POLICY "Buyers can view own refunds"
  ON refunds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = refunds.order_id
      AND orders.buyer_id = auth.uid()
    )
  );

-- Business owners can view refunds for their business orders
CREATE POLICY "Business owners can view business refunds"
  ON refunds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      JOIN businesses ON businesses.id = orders.business_id
      WHERE orders.id = refunds.order_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Buyers can insert refund requests for their orders
CREATE POLICY "Buyers can request refunds"
  ON refunds FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = refunds.order_id
      AND orders.buyer_id = auth.uid()
    )
  );

-- Business owners and admins can update refunds for their orders
CREATE POLICY "Business owners can update refunds"
  ON refunds FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM orders
      JOIN businesses ON businesses.id = orders.business_id
      WHERE orders.id = refunds.order_id
      AND businesses.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add schema version
INSERT INTO schema_version (version, description)
VALUES (12, 'Add refund tracking fields and refunds table')
ON CONFLICT (version) DO NOTHING;
