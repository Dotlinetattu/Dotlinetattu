'use server';

import { createPaymentRequestRecord, releaseUnpaidInitialBooking } from '@/lib/payment-requests';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getPaymentSettings, usdFromIdr } from '@/lib/payment-settings';

export async function createInitialPaymentRequest(
  bookingId: string,
  input: { description: string; amount: number; provider: 'WISE' | 'PAYPAL' }
) {
  const failAndRelease = async (error: string) => {
    await releaseUnpaidInitialBooking(bookingId);
    return { error };
  };
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('bookings')
    .select('deposit, status')
    .eq('id', bookingId)
    .single();
  if (bookingError || !booking || booking.status !== 'PENDING') {
    return { error: 'This booking is no longer available for payment.' };
  }

  const amount = Math.round(Number(booking.deposit));
  if (!Number.isFinite(amount) || amount < 1000) {
    return failAndRelease('The booking deposit is invalid. Please start the booking again.');
  }
  const settings = await getPaymentSettings();
  const providerAmount = input.provider === 'PAYPAL'
    ? usdFromIdr(amount, settings.usdPerIdr)
    : undefined;
  if (input.provider === 'PAYPAL' && !Number.isFinite(providerAmount)) {
    return failAndRelease('PayPal is not available for new bookings yet. The studio needs to set a USD conversion rate first.');
  }
  const expiresAt = new Date(Date.now() + (settings.holdHours * 60 * 60 * 1000)).toISOString();
  const result = await createPaymentRequestRecord(bookingId, {
    ...input,
    amount,
    providerAmount,
    paymentKind: 'DEPOSIT',
    source: 'INITIAL_BOOKING',
    expiresAt,
  });
  if ('error' in result) {
    await releaseUnpaidInitialBooking(bookingId);
  }
  return result;
}
