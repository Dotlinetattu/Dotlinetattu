import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendPaymentStatusEmail } from '@/lib/payment-status-email';
import { expirePendingBookingHolds } from '@/lib/payment-holds';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: RouteContext<'/api/payments/[token]/wise-submitted'>) {
  const { token } = await context.params;
  await expirePendingBookingHolds();
  const body = await request.json().catch(() => null);
  const reference = typeof body?.reference === 'string' ? body.reference.trim() : '';
  if (reference.length < 3 || reference.length > 120) return NextResponse.json({ error: 'Enter a valid Wise transfer reference.' }, { status: 400 });
  const { data: payment } = await supabaseAdmin.from('payments').select('id, provider, status').eq('payment_token', token).single();
  if (!payment || payment.provider !== 'WISE') return NextResponse.json({ error: 'Wise payment request not found.' }, { status: 404 });
  if (!['PENDING', 'WAITING_REVIEW'].includes(payment.status)) return NextResponse.json({ error: 'This payment request is no longer open.' }, { status: 409 });
  const { error } = await supabaseAdmin.from('payments').update({ status: 'WAITING_REVIEW', transfer_reference: reference, updated_at: new Date().toISOString() }).eq('id', payment.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await sendPaymentStatusEmail(payment.id, 'REVIEW');
  return NextResponse.json({ success: true });
}
