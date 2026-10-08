# Dotlinetattu — Full Project Handoff

> Handpoke & tribal tattoo studio website for **Silver Jerry** in Bali, Indonesia.
> Built with **Next.js 16 (App Router)**, **Supabase**, **Midtrans**, **Resend**, **Hostinger file storage**, and **Tailwind CSS v4**. Older booking-image records in Supabase may still reference Cloudinary.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Dependencies](#2-tech-stack--dependencies)
3. [Design System & Aesthetic Rules](#3-design-system--aesthetic-rules)
4. [File Structure](#4-file-structure)
5. [Database Schema (Supabase)](#5-database-schema-supabase)
6. [Environment Variables](#6-environment-variables)
7. [Booking Flow (Customer-Facing)](#7-booking-flow-customer-facing)
8. [Admin Dashboard](#8-admin-dashboard)
9. [Multi-Stage Booking Pipeline](#9-multi-stage-booking-pipeline)
10. [Payment System (Midtrans)](#10-payment-system-midtrans)
11. [Email System (Resend)](#11-email-system-resend)
12. [Image Uploads (Hostinger)](#12-image-uploads-hostinger)
13. [Calendar & Slot Blocking](#13-calendar--slot-blocking)
14. [Homepage Sections](#14-homepage-sections)
15. [Other Pages](#15-other-pages)
16. [UI Components](#16-ui-components)
17. [Business Rules & Pricing](#17-business-rules--pricing)
18. [Known Issues & Incomplete Features](#18-known-issues--incomplete-features)
19. [Deployment & Infrastructure](#19-deployment--infrastructure)
20. [Contact & Access Info](#20-contact--access-info)

---

## 1. Project Overview

**Dotlinetattu** is a booking-enabled website for a handpoke tattoo studio in Bali run by **Silver Jerry**. The site serves two purposes:
1. **Marketing/Portfolio** — Showcase tattoo work, explain the traditional handpoke process, and build trust with tourists visiting Bali.
2. **Booking System** — Allow customers to book flash or custom tattoo sessions online with deposit payments, and give Jerry an admin dashboard to manage the multi-stage pipeline from consultation to completed session.

**Live URL**: `https://dotlinetattu.com` (deployed on Hostinger)
**GitHub Repo**: `https://github.com/bintangmogot/handpoke-tatoo-bali`

---

## 2. Tech Stack & Dependencies

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | Next.js (App Router) | 16.3.6 |
| React | React / React DOM | 19.2.8 |
| Language | TypeScript | ^5 |
| Database | Supabase (PostgreSQL) | @supabase/supabase-js ^2.114.0 |
| Payments | Midtrans Snap API | midtrans-client ^1.4.3 |
| Email | Resend | ^6.28.0 |
| Media | Local static images/audio/video and Hostinger booking uploads; historical booking URLs may remain on Cloudinary | — |
| CSS | Tailwind CSS v4 | ^4 (via @tailwindcss/postcss) |
| Icons | flag-icons | ^7.5.0 (country flags for reviews) |

### Scripts
```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint"
}
```

---

## 3. Design System & Aesthetic Rules

### Color Palette (Earthy, Raw, Warm)

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-dark` | `#110f0e` | Page background |
| `--bg-card` | `#181514` | Card backgrounds |
| `--bg-surface` | `#1f1b1a` | Surface elements |
| `--text-light` | `#e6e1db` | Primary text |
| `--text-muted` | `#8c8279` | Secondary text |
| `--accent-orange` | `#b85c38` | Terracotta/Rust accent |
| `--accent-orange-hover` | `#8f4528` | Hover state |
| `--border-dim` | `rgba(184, 92, 56, 0.15)` | Subtle borders |

### Typography
- **Sans**: `Inter` (body text, labels, buttons)
- **Heading**: `Playfair Display` (section titles, hero)

### Visual Details
- Custom SVG stipple dot pattern on `body` reflecting handpoke texture
- Global `.noise-overlay` fixed background texture
- `.glass-panel` backdrop blur utility
- Earth gradient utilities (`.bg-gradient-earth`, `.bg-gradient-earth-reverse`)
- Section dividers: `ChevronDivider` and `WaveDivider` SVG components

> [!CAUTION]
> ### Forbidden Words & Aesthetics
> - **NEVER** use the words: "ritual", "spiritual", "meditation" — use "culture", "traditional process", "focus" instead
> - **NO** neon glows, bright greens, or `text-shadow`
> - **NO** emojis in emails ("terlalu kelihatan AI")
> - Mentawai is the origin reference for tribal patterns — not generic "tribal"
> - Aesthetic must feel: **raw, earthy, muted, handmade** — not polished/corporate

---

## 4. File Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout (fonts, metadata, global UI)
│   ├── page.tsx                # Homepage (7 major sections)
│   ├── globals.css             # Tailwind v4 theme tokens, custom patterns
│   ├── icon.png                # Favicon
│   ├── about/page.tsx          # Studio story, artist profile
│   ├── services/page.tsx       # Service tiers, pricing table
│   ├── gallery/page.tsx        # Filterable portfolio grid
│   ├── faq/page.tsx            # FAQ accordion
│   ├── booking/page.tsx        # Booking route (wraps BookingEngine)
│   ├── blog/
│   │   ├── page.tsx            # Blog index
│   │   └── [slug]/page.tsx     # Dynamic blog post
│   ├── admin/
│   │   ├── layout.tsx          # Admin wrapper
│   │   ├── page.tsx            # Dashboard (fetches bookings, appointments, blocked_dates)
│   │   ├── BookingsTable.tsx   # Client-side pipeline table + drawer
│   │   ├── BlockedDatesManager.tsx  # Block/unblock dates
│   │   ├── actions.ts          # Server actions (advance stage, payment link, etc.)
│   │   └── login/
│   │       ├── page.tsx        # Password login
│   │       └── actions.ts      # Cookie-based auth
│   ├── actions/
│   │   ├── bookingActions.ts   # Public booking actions (create, get slots)
│   │   ├── paymentActions.ts   # Midtrans transaction creation
│   │   └── emailActions.ts     # Resend email notifications
│   └── api/
│       ├── upload/route.ts     # Hostinger-backed image upload endpoint
│       └── webhook/midtrans/route.ts  # Payment webhook handler
├── components/
│   ├── booking/
│   │   └── BookingEngine.tsx   # Multi-step booking wizard (870+ lines)
│   ├── layout/
│   │   ├── EnterOverlay.tsx    # Entrance overlay
│   │   ├── Navbar.tsx          # Sticky navigation
│   │   ├── Footer.tsx          # Site footer
│   │   └── WhatsAppButton.tsx  # Floating WhatsApp FAB
│   └── ui/
│       ├── Accordion.tsx       # Collapsible FAQ
│       ├── Marquee.tsx         # Infinite scrolling banner
│       ├── ScrollReveal.tsx    # Intersection observer reveal
│       ├── SectionDividers.tsx # SVG chevron/wave dividers
│       ├── TestimonialCard.tsx # Review card
│       ├── TestimonialCarousel.tsx  # Draggable review carousel
│       └── ZoomableImage.tsx   # Lightbox/modal zoom
├── lib/
│   ├── supabase.ts             # Client-side Supabase (anon key)
│   └── supabase-admin.ts       # Server-side Supabase (service role, bypasses RLS)
├── data/
│   └── blog.ts                 # Static blog post data
└── supabase/
    ├── schema.sql              # Initial tables (bookings, reviews, booked_slots view)
    ├── fix_rls.sql             # RLS policy fixes
    └── migrations/
        └── 003_appointments_and_stages.sql  # Appointments table + stage column
```

---

## 5. Database Schema (Supabase)

### `bookings` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `name` | TEXT | Client name |
| `email` | TEXT | Client email |
| `whatsapp` | TEXT | Client WhatsApp number |
| `session_type` | TEXT | `flash` or `custom` |
| `tattoo_size` | TEXT | Flash: small/medium/large. Custom: passing/medium/1day/2days/test |
| `placement` | TEXT | Body placement description |
| `design_url` | TEXT | Reference image URL (new uploads use Hostinger storage; older rows may use Cloudinary) |
| `placement_url` | TEXT | Placement image URL (new uploads use Hostinger storage; older rows may use Cloudinary) |
| `booking_date` | DATE | Selected date |
| `booking_time` | TIME | Selected time |
| `price` | NUMERIC | Total price in IDR |
| `deposit` | NUMERIC | Deposit amount in IDR |
| `status` | TEXT | `PENDING`, `PAID`, `CONFIRMED`, `CANCELLED` |
| `stage` | TEXT | Pipeline stage (see section 9) |
| `payment_link` | TEXT | Midtrans redirect URL (set by admin) |
| `created_at` | TIMESTAMPTZ | Auto |

### `appointments` table (Migration 003)
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `booking_id` | UUID (FK) | References `bookings(id)` ON DELETE CASCADE |
| `type` | TEXT | `consultation`, `design_review`, `tattoo_session` |
| `date` | DATE | Appointment date |
| `time` | TIME | Start time |
| `duration_hours` | NUMERIC(3,1) | Duration (default 2) |
| `status` | TEXT | `SCHEDULED`, `COMPLETED`, `CANCELLED` |
| `notes` | TEXT | Optional notes |
| `created_at` | TIMESTAMPTZ | Auto |

### `blocked_dates` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `date` | DATE | Blocked date |
| `start_time` | TIME | NULL = full day block |
| `end_time` | TIME | NULL = full day block |
| `reason` | TEXT | Optional reason |

### `studio_settings` table
| Column | Type | Notes |
|--------|------|-------|
| `key` | TEXT | Setting key (e.g. `open_hours`) |
| `value` | JSONB | Setting value |

### `reviews` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | |
| `client_name` | TEXT | Reviewer name |
| `country` | TEXT | Country name |
| `country_code` | TEXT | ISO code for flag icon |
| `review_text` | TEXT | Review content |
| `rating` | INTEGER | 1-5 stars |
| `image_url` | TEXT | Optional review image |
| `is_published` | BOOLEAN | Show on website |
| `created_at` | TIMESTAMPTZ | |

### RLS (Row Level Security)
- All tables have RLS enabled
- `bookings`: Public INSERT allowed (for customers booking)
- `appointments`: Full access policy (all operations)
- Server actions use `supabaseAdmin` (service role key) which bypasses RLS

---

## 6. Environment Variables

| Variable | Where Used | Description |
|----------|-----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/supabase.ts`, `supabase-admin.ts` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `src/lib/supabase.ts` | Supabase anonymous key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/lib/supabase-admin.ts` | Supabase service role (server-only, bypasses RLS) |
| `MIDTRANS_SERVER_KEY` | `paymentActions.ts`, `admin/actions.ts`, webhook | Midtrans server key |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | `BookingEngine.tsx` | Midtrans client key for Snap popup |
| `ADMIN_PASSWORD` | `admin/login/actions.ts` | Admin dashboard login password |
| `RESEND_API_KEY` | `emailActions.ts`, `admin/actions.ts` | Resend API key for email |
| `ADMIN_EMAIL` | `emailActions.ts` | Admin notification email (defaults to `onboarding@resend.dev`) |
| `RESEND_FROM_EMAIL` | `emailActions.ts`, `admin/actions.ts` | Sender email (defaults to `Dotlinetattu <onboarding@resend.dev>`) |
| `HOSTINGER_UPLOAD_DIR` | `src/app/api/upload/route.ts`, `src/app/api/uploads/[filename]/route.ts` | Absolute persistent folder outside Hostinger deployment directories |

> [!IMPORTANT]
> **Security**: Never put secrets in chat, source code, or public-prefixed variables. Configure production values in the Hostinger dashboard.

---

## 7. Booking Flow (Customer-Facing)

### Flash Tattoo Flow (5 steps)

```
Type Selection -> Warning Disclaimer -> Form -> Calendar -> Checkout (50% DP) -> Success
```

1. **Warning Step**: Explains hand tapping limitations with photo examples (what works vs what doesn't)
2. **Form Step**: Name, Email, WhatsApp, Placement, Flash size (Small/Medium/Large), Reference upload, Placement photo upload
3. **Calendar Step**: Pick date and time from available slots
4. **Checkout Step**: Shows total price + 50% deposit, "Pay Deposit & Book" button
5. **Success Step**: Order confirmed, WhatsApp link to Jerry

### Custom Tattoo Flow (4 steps)

```
Type Selection -> Form -> Calendar -> Checkout (10% DP) -> Success ("Consultation Booked")
```

1. **Form Step**: Name, Email, WhatsApp, Placement, Session tier (Test/Passing/Medium/1day/2days), Reference upload, Placement photo upload
2. **Calendar Step**: Pick consultation date
3. **Checkout Step**: Shows total price + 10% deposit, "Book Consultation" button
4. **Success Step**: "Consultation Booked" message explaining next steps (design discussion, pricing, session scheduling)

### Key Implementation Details
- Form state persists in `localStorage` (`dotlinetattu_booking_draft`)
- Images uploaded to Hostinger storage via `/api/upload` before booking is created
- Midtrans Snap popup loaded dynamically (`snap.js`)
- Calendar checks `appointments` table (duration-aware blocking)

---

## 8. Admin Dashboard

### Access
- URL: `/admin`
- Login: `/admin/login` (password-based, cookie: `admin_session`)
- Auth is simple cookie check, no JWT/OAuth

### Dashboard Components

1. **BookingsTable** (`BookingsTable.tsx`)
   - Filter tabs: All | Consultation | In Progress | Scheduled | Completed
   - Table columns: Date/Time, Client, Type, Stage badge, Payment status
   - Click row -> opens detail drawer/modal with:
     - Client info (name, WhatsApp, email)
     - Reference images (design + placement)
     - Appointment timeline (all appointments for this booking)
     - Stage advancement form (date picker, time dropdown, duration, notes)
     - "Send Payment Link" button (at Deal Confirmed stage)
     - Cancel/Complete buttons for each appointment

2. **BlockedDatesManager** (`BlockedDatesManager.tsx`)
   - Block full days or specific hourly windows
   - Shows list of blocked dates with reason
   - Unblock functionality

---

## 9. Multi-Stage Booking Pipeline

### Stages (Custom Tattoo)

```
CONSULTATION_BOOKED -> DESIGN_IN_PROGRESS -> DEAL_CONFIRMED -> SESSION_SCHEDULED -> IN_PROGRESS -> COMPLETED
```

| Stage | Description | Action Required |
|-------|-------------|-----------------|
| `CONSULTATION_BOOKED` | Initial booking. Customer paid 10% DP. | Consultation meeting happens |
| `DESIGN_IN_PROGRESS` | After consultation. Jerry designs. | Design review meeting |
| `DEAL_CONFIRMED` | Price agreed. Payment link sent. | Customer pays 50% deposit |
| `SESSION_SCHEDULED` | Session date set | Tattoo session happens |
| `IN_PROGRESS` | Tattoo being done (multi-day) | Session completes |
| `COMPLETED` | All done | - |
| `CANCELLED` | Cancelled at any point | - |

### Stage Advancement Rules
- Each advance can optionally create a new **appointment** that blocks the calendar
- **DEAL_CONFIRMED** stage requires setting a final price (admin enters amount)
- **DEAL_CONFIRMED** shows "Send Payment Link" button which:
  1. Creates Midtrans transaction for 50% deposit
  2. Saves `payment_link` to booking
  3. Emails customer with payment link via Resend
- **Cancelling an appointment** reverts the stage to previous:
  - `DESIGN_IN_PROGRESS` -> `CONSULTATION_BOOKED`
  - `SESSION_SCHEDULED` -> `DEAL_CONFIRMED`
  - `IN_PROGRESS` -> `SESSION_SCHEDULED`

### Flash Tattoo (Simplified)
- Goes directly to `SESSION_SCHEDULED` stage (50% deposit, same as before)
- No multi-stage pipeline needed

### Appointment Types & Default Durations
| Type | Default Duration |
|------|-----------------|
| `consultation` | 1 hour |
| `design_review` | 1 hour |
| `tattoo_session` | 4 hours |

Durations are customizable by Jerry via dropdown when advancing stages.

---

## 10. Payment System (Midtrans)

### Current Mode: **SANDBOX** (not production yet)

### How It Works

1. **Customer Checkout** (`paymentActions.ts`):
   - Creates Midtrans Snap transaction with `order_id: bookingId + '-' + Date.now()`
   - Returns `{ token, redirect_url }`
   - BookingEngine calls `window.snap.pay(token)` for popup

2. **Admin Payment Link** (`admin/actions.ts` -> `sendPaymentLinkToCustomer`):
   - Creates Midtrans transaction for 50% deposit
   - `order_id: bookingId.substring(0, 36) + '-' + Date.now().toString(36)` (max 50 chars)
   - Saves `redirect_url` to `bookings.payment_link`
   - Emails customer the link via Resend

3. **Webhook** (`api/webhook/midtrans/route.ts`):
   - Validates SHA-512 signature
   - Extracts booking UUID via `payload.order_id.substring(0, 36)`
   - Maps Midtrans status to booking status:
     - `settlement` / `capture+accept` -> `PAID`
     - `cancel` / `deny` / `expire` -> `CANCELLED`
     - `pending` -> `PENDING`
   - On `PAID`: triggers admin email + customer receipt email

> [!WARNING]
> **Midtrans order_id limit is 50 characters**. The format was changed from `UUID-dp-timestamp` (53 chars, broke) to `UUID-base36timestamp` (46 chars).

> [!IMPORTANT]
> **Sandbox Snap Script**: `https://app.sandbox.midtrans.com/snap/snap.js`
> When switching to production, change to: `https://app.midtrans.com/snap/snap.js` and set `isProduction: true` in `paymentActions.ts`.

---

## 11. Email System (Resend)

### Emails Sent

1. **Admin Notification** (`sendPaymentSuccessEmail`):
   - Triggered when payment webhook receives `PAID` status
   - Sent to `ADMIN_EMAIL`
   - Contains: client name, WhatsApp link, date/time, placement, session type, price, deposit

2. **Customer Receipt** (`sendCustomerReceiptEmail`):
   - Triggered alongside admin notification
   - Sent to customer's email
   - Contains: Order ID (`#DLT-<8chars>`), date/time, session type, placement, total price, deposit paid, WhatsApp link

3. **Payment Request** (in `sendPaymentLinkToCustomer`):
   - Triggered when admin clicks "Send Payment Link"
   - Contains: Order ID, total price, deposit amount (50%), "PAY DEPOSIT NOW" CTA button

### Email Design Rules
- Dark theme (`#111111` background, `#ffffff` text)
- Professional, no emojis
- No logo image (AVIF broke in Gmail, was removed)
- Sender name: "Dotlinetattu"

> [!WARNING]
> **Resend Free Tier Limitation**: Can only send to the email address used to sign up. Customer emails require **domain verification** on Resend. Bang Jerry needs to create a Resend account and verify `dotlinetattu.com` domain.

---

## 12. Image Uploads (Hostinger)

- **Upload Endpoint**: `/api/upload` (POST)
- **Method**: JPG, PNG, and WebP images up to 8 MB are validated and stored in the folder configured by `HOSTINGER_UPLOAD_DIR`
- **Image Endpoint**: `/api/uploads/[filename]` (GET)
- **Used for**: Customer reference images and placement photos during booking
- **Important**: Keep this folder outside Hostinger-managed build folders such as `hbuilds`, `nodejs`, and `public_html`; those can be replaced during deployment. Verify the folder is writable and persists across redeploys before accepting live bookings.
- Existing booking rows may still contain public Cloudinary image URLs. Keep those assets available until the rows and files are migrated or no longer needed.
- The homepage hero video is now served locally from `public/assets/Video/hero-background.mp4` as an optimized 8.1 MB MP4. Keep the Cloudinary source until the Hostinger deployment is verified.

---

## 13. Calendar & Slot Blocking

### How Availability is Determined

The website calendar (`BookingEngine.tsx`) determines available time slots by checking **three sources**:

1. **Appointments** (`appointments` table, status = `SCHEDULED`):
   - **Duration-aware**: A 2-hour appointment at 10:00 blocks both 10:00 AND 11:00
   - Logic: `slotHour >= apptStartHour && slotHour < apptStartHour + apptDuration`

2. **Blocked Dates** (`blocked_dates` table):
   - Full day blocks (no `start_time`) -> entire day disabled
   - Hourly blocks (`start_time` + `end_time`) -> specific hours disabled

3. **Studio Open Hours** (`studio_settings` table, key = `open_hours`):
   - Default: 10:00 - 18:00
   - Only shows time slots within open hours

### "Fully Booked" Day Detection
A day is marked fully booked when:
```
bookedHourCount + blockedHourlySlots >= totalDailySlots
```
Where `bookedHourCount` sums `duration_hours` of all appointments (not just count).

### Admin Time Dropdown
- Range: 06:00 - 18:00
- Shows "(Booked)" and disables already-taken slots
- Also duration-aware (checks existing appointments on selected date)

---

## 14. Homepage Sections

1. **Hero**: Fullscreen with a self-hosted MP4 video background, "Est. 2019 - Bali, Indonesia" badge, "Book a Session" CTA
2. **Chevron Divider**
3. **The Approach**: Traditional Handpoke + Music Collaboration (RA.VA.NA)
4. **Marquee**: Scrolling brand keywords
5. **Wave Divider**
6. **Artist Spotlight**: Silver Jerry bio (2010 -> 2015 -> 2019 founding)
7. **Chevron Divider**
8. **The Process**: Custom flow (3 steps) vs Flash flow (3 steps) comparison cards
9. **Wave Divider**
10. **Signature Works**: 3-piece curated portfolio preview -> links to `/gallery`
11. **Chevron Divider**
12. **Tattoo Styles**: Two-column accordion (Handpoke, Machine Fine Line, Mentawai Tribal, etc.)
13. **Wave Divider**
14. **Reviews & Testimonials**: Draggable carousel with 10 Google reviews + country flags

---

## 15. Other Pages

| Route | Description |
|-------|-------------|
| `/about` | Studio story, Silver Jerry profile, philosophy |
| `/services` | Service tiers with pricing table |
| `/gallery` | Filterable portfolio grid (Handpoke, Machine, Flash) |
| `/faq` | Studio rules, hygiene standards, minimum size policy, FAQ accordion |
| `/booking` | Multi-step booking wizard (see section 7) |
| `/blog` | Blog index listing articles from `src/data/blog.ts` |
| `/blog/[slug]` | Individual blog post |

---

## 16. UI Components

| Component | Location | Description |
|-----------|----------|-------------|
| `BookingEngine` | `components/booking/` | 870+ line multi-step booking wizard |
| `EnterOverlay` | `components/layout/` | Entrance overlay banner |
| `Navbar` | `components/layout/` | Fixed top nav, mobile drawer, booking CTA |
| `Footer` | `components/layout/` | Branding, links, address, contact |
| `WhatsAppButton` | `components/layout/` | Floating WhatsApp FAB (+62 823-3976-0624) |
| `Accordion` | `components/ui/` | Animated collapsible (FAQ page) |
| `Marquee` | `components/ui/` | Infinite horizontal scroll banner |
| `ScrollReveal` | `components/ui/` | Intersection observer reveal wrapper |
| `SectionDividers` | `components/ui/` | Chevron + Wave SVG dividers |
| `TestimonialCard` | `components/ui/` | Review card with stars + country flag |
| `TestimonialCarousel` | `components/ui/` | Draggable/paginated review carousel |
| `ZoomableImage` | `components/ui/` | Lightbox/modal zoom for tattoo images |

---

## 17. Business Rules & Pricing

### Flash Tattoo Pricing (50% Deposit)
| Size | Price (IDR) | Deposit |
|------|------------|---------|
| Small (5-10cm) | 1,000,000 | 500,000 |
| Medium (11-15cm) | 1,750,000 | 875,000 |
| Large (16-25cm+) | 2,500,000 | 1,250,000 |

### Custom Tattoo Pricing (10% Initial Deposit)
| Tier | Price (IDR) | Initial Deposit |
|------|------------|-----------------|
| Test Session | 10,000 | 10,000 (100%) |
| Passing (1-2h) | 1,500,000 | 150,000 |
| Medium (6h) | 5,500,000 | 550,000 |
| 1-Day (8h) | 8,500,000 | 850,000 |
| 2-Days (16h) | 17,000,000 | 1,700,000 |

### Business Rules
- **Offline consultation** (in-person meeting) requires **10% deposit** payment
- **WhatsApp consultation** is **free**
- When admin advances to **Deal Confirmed**, they set the final price and can auto-send a **Midtrans payment link** to the customer for 50% deposit
- **WhatsApp number**: `+62 823-3976-0624` (Silver Jerry)

---

## 18. Known Issues & Incomplete Features

### Must Fix

| Issue | Details | File(s) |
|-------|---------|---------|
| **Hostinger upload folder** | Set `HOSTINGER_UPLOAD_DIR` to a writable persistent path outside deployment folders before deploying this upload change | Hostinger environment variables |
| **`.env.example` outdated** | Still references Xendit; should list all current env vars | `.env.example` |
| **Resend domain not verified** | Customer emails won't deliver until `dotlinetattu.com` is verified on Resend with Jerry's account | N/A (Resend dashboard) |
| **Midtrans in Sandbox mode** | Need to switch to Production when ready for real payments | `paymentActions.ts`, `admin/actions.ts`, `BookingEngine.tsx` |

### Pending Features (Requested but Not Yet Built)

| Feature | Details |
|---------|---------|
| **Custom type: Send Payment Link after price change** | When admin changes a custom booking's price in the admin panel, there should be a button to send the updated payment link to the customer's email. Currently the "Send Payment Link" button only appears at the Deal Confirmed stage. |
| **Vercel account separation** | Site is on the developer's personal Vercel Hobby account (has 20 projects). Should move to Jerry's own Vercel account to avoid commercial use policy violation. Simple re-deploy + copy env vars. |

### Not Building (Decided Against)

| Feature | Reason |
|---------|--------|
| **PDF receipt generation** | HTML email receipts are sufficient. If needed later, recommend a `/receipt/[id]` page with browser print-to-PDF. |

---

## 19. Deployment & Infrastructure

### Current Setup
- **Hosting**: Hostinger Node.js Web App (live)
- **Database**: Supabase (hosted PostgreSQL)
- **Domain**: `dotlinetattu.com` connected to Hostinger
- **Media**: Hostinger static files and upload storage; Cloudinary retained temporarily for historical booking photos
- **Payments**: Midtrans (Sandbox)
- **Email**: Resend (free tier, shared domain)

### Deploy Process
1. Push to `main` branch on GitHub
2. Vercel auto-detects and builds
3. No manual intervention needed unless env vars change

### To Switch Midtrans to Production
1. In Vercel, change `MIDTRANS_SERVER_KEY` and `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` to production keys
2. In `src/app/actions/paymentActions.ts`: change `isProduction: false` to `isProduction: true`
3. In `src/app/admin/actions.ts`: same change for `sendPaymentLinkToCustomer`
4. In `src/components/booking/BookingEngine.tsx`: change Snap script URL from `app.sandbox.midtrans.com` to `app.midtrans.com`

### To Verify Resend Domain
1. Jerry creates account at resend.com
2. Add domain `dotlinetattu.com`
3. Add DNS records (DKIM, SPF) to Hostinger DNS
4. Share API key (user adds to Vercel env vars)
5. Update `RESEND_FROM_EMAIL` to `Dotlinetattu <noreply@dotlinetattu.com>`

---

## 20. Contact & Access Info

| What | Details |
|------|---------|
| Studio Owner | Silver Jerry |
| WhatsApp | +62 823-3976-0624 |
| Domain | dotlinetattu.com (Hostinger) |
| GitHub | github.com/bintangmogot/handpoke-tatoo-bali |
| Vercel | Deployed on developer's personal Hobby account |
| Supabase | Managed by developer (env vars in Vercel) |

> [!CAUTION]
> **API Keys Policy**: The owner/developer strictly refuses to share API keys in chat. Never ask for them — reference the Vercel dashboard for all secrets.

---

## Technical Notes for AI Agents

### PowerShell Escaping
- **DO NOT** use PowerShell here-strings for code containing backticks or template literals — PowerShell evaluates them and mangles the output.
- **Use** file write/replace tools with exact literal strings.

### Gmail Email Rendering
- Gmail blocks `.avif` images (even with Cloudinary `f_png` transform). Logo was removed.
- Emails from `onboarding@resend.dev` land in spam. Custom domain verification fixes this.

### Midtrans Sandbox Testing
- "Test notification URL" button sends dummy `order_id: "test-123"` — causes expected 404 in webhook. Safe to ignore.
- Sandbox Snap script: `https://app.sandbox.midtrans.com/snap/snap.js`
