import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createPayPalOrder } from '@/lib/payments';
import { expirePendingBookingHolds } from '@/lib/payment-holds';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, context: RouteContext<'/api/payments/[token]/paypal/order'>) {
  const { token } = await context.params;
  await expirePendingBookingHolds();
  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('id, payment_token, description, provider_amount, provider_currency, provider, status, provider_order_id')
    .eq('payment_token', token)
    .single();
  if (!payment || payment.provider !== 'PAYPAL') return NextResponse.json({ error: 'PayPal payment request not found.' }, { status: 404 });
  if (['PAID', 'APPROVED', 'CANCELLED', 'DECLINED', 'EXPIRED', 'FAILED'].includes(payment.status)) return NextResponse.json({ error: 'This payment request is no longer open.' }, { status: 409 });
  if (!payment.provider_amount || payment.provider_currency !== 'USD') return NextResponse.json({ error: 'This PayPal amount is not configured.' }, { status: 422 });
  try {
    const order = await createPayPalOrder({ ...payment, provider_amount: Number(payment.provider_amount), provider_currency: payment.provider_currency });
    const { error } = await supabaseAdmin.from('payments').update({ provider_order_id: order.orderId, updated_at: new Date().toISOString() }).eq('id', payment.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ approveUrl: order.approveUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not create PayPal checkout.' }, { status: 502 });
  }
}
