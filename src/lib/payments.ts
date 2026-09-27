import { supabaseAdmin } from '@/lib/supabase-admin';

export const SUCCESSFUL_PAYMENT_STATUSES = ['PAID', 'APPROVED'] as const;

export type PaymentProvider = 'WISE' | 'PAYPAL';
export type PaymentKind = 'DEPOSIT' | 'BALANCE_PAYMENT' | 'ADDITIONAL_CHARGE';

export function appUrl(path = '') {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`;
  if (!configuredUrl && process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_APP_URL must be configured in production.');
  }
  const base = configuredUrl || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}${path}`;
}

export function formatIdr(value: number) {
  return `IDR ${Number(value || 0).toLocaleString('id-ID')}`;
}

export function formatUsd(value: number) {
  return `USD ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function bookingPaymentSummary(bookingId: string) {
  const [{ data: booking, error: bookingError }, { data: payments, error: paymentsError }, { data: adjustments, error: adjustmentsError }] = await Promise.all([
    supabaseAdmin.from('bookings').select('id, price').eq('id', bookingId).single(),
    supabaseAdmin.from('payments').select('id, amount, status').eq('booking_id', bookingId),
    supabaseAdmin.from('booking_adjustments').select('amount, status').eq('booking_id', bookingId),
  ]);
  if (bookingError || !booking) throw new Error('Booking not found.');
  if (paymentsError || adjustmentsError) throw new Error('Payment data is not ready. Run migration 006 first.');

  const baseTotal = Number(booking.price || 0);
  const additionalTotal = (adjustments || [])
    .filter((adjustment) => adjustment.status === 'ACTIVE')
    .reduce((total, adjustment) => total + Number(adjustment.amount || 0), 0);
  const paidTotal = (payments || [])
    .filter((payment) => SUCCESSFUL_PAYMENT_STATUSES.includes(payment.status as typeof SUCCESSFUL_PAYMENT_STATUSES[number]))
    .reduce((total, payment) => total + Number(payment.amount || 0), 0);
  const finalTotal = baseTotal + additionalTotal;
  return { baseTotal, additionalTotal, finalTotal, paidTotal, remaining: Math.max(0, finalTotal - paidTotal) };
}

async function paypalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error('PayPal is not configured yet. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.');
  const base = process.env.PAYPAL_ENVIRONMENT === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw new Error(body.error_description || 'Could not connect to PayPal.');
  return { base, token: body.access_token as string };
}

export async function createPayPalOrder(payment: { id: string; payment_token: string; description: string; provider_amount: number; provider_currency: string }) {
  const { base, token } = await paypalAccessToken();
  const returnUrl = appUrl(`/payment/${payment.payment_token}?paypal=return`);
  const cancelUrl = appUrl(`/payment/${payment.payment_token}?paypal=cancelled`);
  const response = await fetch(`${base}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': payment.id },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{ reference_id: payment.id, description: payment.description.slice(0, 127), amount: { currency_code: payment.provider_currency, value: Number(payment.provider_amount).toFixed(2) } }],
      application_context: { return_url: returnUrl, cancel_url: cancelUrl, user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING' },
    }),
    cache: 'no-store',
  });
  const body = await response.json();
  if (!response.ok || !body.id) throw new Error(body.message || 'PayPal could not create this checkout.');
  const approveUrl = body.links?.find((link: { rel: string }) => link.rel === 'approve')?.href;
  if (!approveUrl) throw new Error('PayPal did not return an approval link.');
  return { orderId: body.id as string, approveUrl: approveUrl as string };
}

export async function capturePayPalOrder(orderId: string) {
  const { base, token } = await paypalAccessToken();
  const response = await fetch(`${base}/v2/checkout/orders/${orderId}/capture`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, cache: 'no-store' });
  const body = await response.json();
  if (!response.ok && body.name !== 'ORDER_ALREADY_CAPTURED') throw new Error(body.message || 'PayPal could not confirm the payment.');
  return body;
}

export async function verifyPayPalWebhook(headers: Headers, event: unknown) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error('PAYPAL_WEBHOOK_ID is not configured.');
  const { base, token } = await paypalAccessToken();
  const response = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_algo: headers.get('paypal-auth-algo'),
      cert_url: headers.get('paypal-cert-url'),
      transmission_id: headers.get('paypal-transmission-id'),
      transmission_sig: headers.get('paypal-transmission-sig'),
      transmission_time: headers.get('paypal-transmission-time'),
      webhook_id: webhookId,
      webhook_event: event,
    }),
    cache: 'no-store',
  });
  const body = await response.json();
  return response.ok && body.verification_status === 'SUCCESS';
}
