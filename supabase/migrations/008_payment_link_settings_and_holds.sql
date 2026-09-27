-- Per-link expiry keeps a pending first booking from blocking the calendar forever.
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Apply the default hold to legacy unpaid first deposits too, but never touch a
-- booking that already has a confirmed payment.
UPDATE payments AS pending_payment
SET source = 'INITIAL_BOOKING',
    expires_at = pending_payment.created_at + INTERVAL '12 hours'
FROM bookings
WHERE pending_payment.booking_id = bookings.id
  AND pending_payment.status = 'PENDING'
  AND pending_payment.payment_kind = 'DEPOSIT'
  AND bookings.status = 'PENDING'
  AND pending_payment.expires_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM payments AS successful_payment
    WHERE successful_payment.booking_id = pending_payment.booking_id
      AND successful_payment.status IN ('PAID', 'APPROVED')
  );

CREATE INDEX IF NOT EXISTS idx_payments_initial_hold_expiry
  ON payments (status, expires_at)
  WHERE source = 'INITIAL_BOOKING' AND status = 'PENDING';

-- Existing installation-safe defaults. Admin can change these from the dashboard.
INSERT INTO studio_settings (key, value)
VALUES
  ('paypal_usd_per_idr', '0.0000615'::jsonb),
  ('pending_payment_hold_hours', '12'::jsonb)
ON CONFLICT (key) DO NOTHING;
