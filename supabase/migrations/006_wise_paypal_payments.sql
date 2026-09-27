-- Payment requests are now provider-neutral. Existing Midtrans records stay intact
-- as historical records, while all new requests use Wise or PayPal.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'MIDTRANS',
  ADD COLUMN IF NOT EXISTS provider_order_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_capture_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS provider_currency TEXT,
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_kind TEXT NOT NULL DEFAULT 'DEPOSIT',
  ADD COLUMN IF NOT EXISTS transfer_reference TEXT,
  ADD COLUMN IF NOT EXISTS proof_url TEXT,
  ADD COLUMN IF NOT EXISTS review_note TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

UPDATE payments
SET provider = 'MIDTRANS',
    payment_kind = CASE WHEN source = 'INITIAL_BOOKING' THEN 'DEPOSIT' ELSE 'BALANCE_PAYMENT' END
WHERE provider IS NULL OR provider = 'MIDTRANS';

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_payment_token ON payments(payment_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_order_id ON payments(provider_order_id) WHERE provider_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_provider_status ON payments(provider, status);
CREATE INDEX IF NOT EXISTS idx_payments_appointment_id ON payments(appointment_id);

-- A separate adjustment is what increases the agreed total. A declined Wise
-- transfer never removes the charge or makes the remaining balance look paid.
CREATE TABLE IF NOT EXISTS booking_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'VOID')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_adjustments_booking_id ON booking_adjustments(booking_id);
ALTER TABLE booking_adjustments ENABLE ROW LEVEL SECURITY;

-- Add the link from a payment request to an additional charge once the table
-- exists, so the original payment history remains compatible.
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS adjustment_id UUID REFERENCES booking_adjustments(id) ON DELETE SET NULL;

-- Replace the original restrictive status check with the review states needed
-- for manual Wise transfers. Constraint names differ between older databases.
DO $$
DECLARE constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'payments'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE payments DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('PENDING', 'WAITING_REVIEW', 'APPROVED', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'DECLINED'));

ALTER TABLE payments
  ADD CONSTRAINT payments_provider_check
  CHECK (provider IN ('MIDTRANS', 'WISE', 'PAYPAL'));

ALTER TABLE payments
  ADD CONSTRAINT payments_kind_check
  CHECK (payment_kind IN ('DEPOSIT', 'BALANCE_PAYMENT', 'ADDITIONAL_CHARGE'));
