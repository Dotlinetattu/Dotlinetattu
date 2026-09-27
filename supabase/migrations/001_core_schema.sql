-- Base schema for a new Dotlinetattu Supabase project.
-- Apply this file before migrations 003 through 009.

CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  session_type TEXT NOT NULL CHECK (session_type IN ('flash', 'custom')),
  tattoo_size TEXT,
  placement TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  design_url TEXT,
  placement_url TEXT,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  price NUMERIC NOT NULL CHECK (price >= 0),
  deposit NUMERIC NOT NULL CHECK (deposit >= 0),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PAID', 'CONFIRMED', 'CANCELLED')),
  stage TEXT NOT NULL DEFAULT 'CONSULTATION_BOOKED',
  payment_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_created_at
  ON public.bookings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_date_time
  ON public.bookings (booking_date, booking_time);

CREATE TABLE IF NOT EXISTS public.blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blocked_dates_time_range_check
    CHECK ((start_time IS NULL AND end_time IS NULL) OR start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_blocked_dates_date
  ON public.blocked_dates (date);

CREATE TABLE IF NOT EXISTS public.studio_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  country TEXT NOT NULL,
  country_code TEXT NOT NULL,
  review_text TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read published reviews" ON public.reviews
  FOR SELECT TO anon, authenticated
  USING (is_published = TRUE);
