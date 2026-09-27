import { NextResponse } from 'next/server';
import { expirePendingBookingHolds } from '@/lib/payment-holds';

export const dynamic = 'force-dynamic';

function isAuthorized(request: Request) {
  const secret = process.env.BOOKING_HOLD_CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!process.env.BOOKING_HOLD_CRON_SECRET) {
    return NextResponse.json({ error: 'Booking-hold cron is not configured.' }, { status: 503 });
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const releasedBookingIds = await expirePendingBookingHolds();
  return NextResponse.json({ released: releasedBookingIds.length });
}
