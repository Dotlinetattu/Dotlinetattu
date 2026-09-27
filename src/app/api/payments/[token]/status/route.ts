import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { bookingPaymentSummary } from '@/lib/payments';
import { expirePendingBookingHolds } from '@/lib/payment-holds';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await expirePendingBookingHolds();
  const { data: payment, error } = await supabaseAdmin
    .from('payments')
    .select('id, booking_id, status, transfer_reference, review_note, updated_at')
    .eq('payment_token', token)
    .single();

  if (error || !payment) {
    return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
  }

  const summary = await bookingPaymentSummary(payment.booking_id).catch(() => null);
  return NextResponse.json({
    id: payment.id,
    status: payment.status,
    transferReference: payment.transfer_reference,
    reviewNote: payment.review_note,
    updatedAt: payment.updated_at,
    summary,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
