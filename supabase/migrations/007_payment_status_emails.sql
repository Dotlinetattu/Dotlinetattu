-- Prevent duplicate customer notifications when a PayPal return and webhook
-- arrive close together, while retaining a clear delivery audit trail.
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS review_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receipt_email_sent_at TIMESTAMPTZ;
