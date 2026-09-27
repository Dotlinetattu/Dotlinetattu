-- Legacy prototype schema. Do not use for a new production Supabase project.
-- For current setup, run migrations/001_core_schema.sql, then migrations 003 through 009 in order.

-- 1. Create Bookings Table
CREATE TABLE public.bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_name TEXT NOT NULL,
    client_email TEXT,
    client_whatsapp TEXT,
    booking_date DATE NOT NULL,
    booking_time TIME NOT NULL,
    tattoo_type TEXT NOT NULL, -- 'flash' or 'custom'
    total_price NUMERIC,
    deposit_amount NUMERIC,
    payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid_deposit', 'completed'
    payment_link TEXT, -- Xendit invoice URL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Reviews Table
CREATE TABLE public.reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_name TEXT NOT NULL,
    country TEXT NOT NULL,
    country_code TEXT NOT NULL, -- e.g. 'AU', 'DE'
    review_text TEXT NOT NULL,
    rating INTEGER DEFAULT 5,
    image_url TEXT,
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Setup Row Level Security (RLS)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Allow public read for reviews
CREATE POLICY "Allow public read reviews" ON public.reviews FOR SELECT USING (is_published = true);

-- Create a view for public availability checking (hides PII)
CREATE VIEW public.booked_slots AS
SELECT booking_date, booking_time 
FROM public.bookings 
WHERE payment_status IN ('paid_deposit', 'completed');
