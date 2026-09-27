-- Pricing catalog matching the public services page.
CREATE TABLE IF NOT EXISTS service_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type TEXT NOT NULL CHECK (service_type IN ('flash', 'custom')),
  service_key TEXT NOT NULL,
  service_name TEXT NOT NULL,
  duration TEXT,
  price_idr NUMERIC NOT NULL CHECK (price_idr > 0),
  deposit_percent NUMERIC NOT NULL DEFAULT 50 CHECK (deposit_percent >= 0 AND deposit_percent <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_type, service_key)
);

INSERT INTO service_prices (service_type, service_key, service_name, duration, price_idr)
VALUES
  ('flash', 'small', 'Small Flash Tattoo', '10-15cm', 1500000),
  ('flash', 'medium', 'Medium Flash Tattoo', '15-20cm', 2500000),
  ('flash', 'large', 'Large Flash Tattoo', '20cm+', 4000000),
  ('custom', 'passing', 'Passing Session', '1-2 hours', 1500000),
  ('custom', 'beginning', 'Beginning Session', '3 hours', 2500000),
  ('custom', 'medium_session', 'Medium Session', '6 hours', 5500000),
  ('custom', '1day', '1 Day Session', '8 hours', 8500000),
  ('custom', '2days', '2 Days Session', '2 x 8 hours', 17000000)
ON CONFLICT (service_type, service_key) DO UPDATE SET
  service_name = EXCLUDED.service_name,
  duration = EXCLUDED.duration,
  price_idr = EXCLUDED.price_idr,
  deposit_percent = EXCLUDED.deposit_percent,
  is_active = true,
  updated_at = now();

ALTER TABLE service_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read active service prices" ON service_prices
  FOR SELECT USING (is_active = true);
