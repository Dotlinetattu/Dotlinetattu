import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { capturePayPalOrder } from '@/lib/payments';
import { sendPaymentStatusEmail } from '@/lib/payment-status-email';
import { expirePendingBookingHolds } from '@/lib/payment-holds';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, context: RouteContext<'/api/payments/[token]/paypal/capture'>) {
  const { token } = await context.params;
  await expirePendingBookingHolds();
  const { data: payment } = await supabaseAdmin.from('payments').select('id, provider, provider_order_id, status').eq('payment_token', token).single();
  if (!payment || payment.provider !== 'PAYPAL') return NextResponse.json({ error: 'PayPal payment request not found.' }, { status: 404 });
  if (['PAID', 'APPROVED'].includes(payment.status)) return NextResponse.json({ success: true, status: 'PAID' });
  if (['EXPIRED', 'CANCELLED', 'DECLINED', 'FAILED'].includes(payment.status)) return NextResponse.json({ error: 'This payment request is no longer open.' }, { status: 409 });
  if (!payment.provider_order_id) return NextResponse.json({ error: 'Open PayPal checkout first.' }, { status: 409 });
  try {
    const capture = await capturePayPalOrder(payment.provider_order_id);
    const captureId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id || null;
    const nextStatus = capture.status === 'COMPLETED' || captureId ? 'PAID' : 'PENDING';
    const { data: updatedPayment, error } = await supabaseAdmin
      .from('payments')
      .update({ status: nextStatus, provider_capture_id: captureId, paid_at: nextStatus === 'PAID' ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
      .eq('id', payment.id)
      .eq('status', 'PENDING')
      .select('id')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (nextStatus === 'PAID' && updatedPayment) await sendPaymentStatusEmail(payment.id, 'RECEIPT');
    return NextResponse.json({ success: nextStatus === 'PAID', status: nextStatus });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not confirm PayPal payment.' }, { status: 502 });
  }
}
