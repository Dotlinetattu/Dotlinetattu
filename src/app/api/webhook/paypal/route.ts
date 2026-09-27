import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyPayPalWebhook } from '@/lib/payments';
import { sendPaymentStatusEmail } from '@/lib/payment-status-email';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const event = await request.json().catch(() => null);
  if (!event) return NextResponse.json({ error: 'Invalid PayPal webhook.' }, { status: 400 });
  try {
    const verified = await verifyPayPalWebhook(request.headers, event);
    if (!verified) return NextResponse.json({ error: 'Webhook signature could not be verified.' }, { status: 401 });
    if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') return NextResponse.json({ received: true });
    const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
    const captureId = event.resource?.id;
    if (!orderId) return NextResponse.json({ received: true });
    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .update({ status: 'PAID', provider_capture_id: captureId || null, paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('provider', 'PAYPAL')
      .eq('provider_order_id', orderId)
      .eq('status', 'PENDING')
      .select('id')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (payment) await sendPaymentStatusEmail(payment.id, 'RECEIPT');
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('PayPal webhook error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'PayPal webhook processing failed.' }, { status: 500 });
  }
}
