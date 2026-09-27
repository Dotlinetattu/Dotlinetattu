import { supabaseAdmin } from '@/lib/supabase-admin';
import { appUrl, bookingPaymentSummary, type PaymentKind, type PaymentProvider } from '@/lib/payments';
import { getPaymentSettings, usdFromIdr } from '@/lib/payment-settings';

export type PaymentRequestInput = {
  description: string;
  amount: number;
  provider: PaymentProvider;
  providerAmount?: number;
  paymentKind: PaymentKind;
  appointmentId?: string;
  source?: 'INITIAL_BOOKING' | 'ADMIN_REQUEST';
  expiresAt?: string;
};

export async function createPaymentRequestRecord(bookingId: string, input: PaymentRequestInput) {
  const amount = Math.round(Number(input.amount));
  const description = input.description?.trim();
  if (!description) return { error: 'Payment description is required.' };
  if (!Number.isFinite(amount) || amount < 1000) return { error: 'Enter an amount of at least IDR 1,000.' };
  if (!['WISE', 'PAYPAL'].includes(input.provider)) return { error: 'Choose Wise or PayPal.' };
  if (!['DEPOSIT', 'BALANCE_PAYMENT', 'ADDITIONAL_CHARGE'].includes(input.paymentKind)) return { error: 'Choose a valid payment type.' };
  if (input.provider === 'WISE' && (!process.env.WISE_RECIPIENT_NAME || !process.env.WISE_ACCOUNT_DETAILS)) {
    return { error: 'Wise transfer details are not configured yet.' };
  }

  const requestedProviderAmount = input.providerAmount === undefined ? null : Number(input.providerAmount);
  const settings = input.provider === 'PAYPAL' ? await getPaymentSettings() : null;
  const providerAmount = input.provider === 'PAYPAL'
    ? requestedProviderAmount !== null && Number.isFinite(requestedProviderAmount) && requestedProviderAmount >= 0.01
      ? requestedProviderAmount
      : usdFromIdr(amount, settings!.usdPerIdr)
    : null;
  if (input.provider === 'PAYPAL' && (typeof providerAmount !== 'number' || !Number.isFinite(providerAmount) || providerAmount < 0.01)) {
    return { error: 'Enter a valid PayPal amount in USD.' };
  }

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select('id')
    .eq('id', bookingId)
    .single();
  if (error || !booking) return { error: 'Booking not found.' };

  try {
    const summary = await bookingPaymentSummary(bookingId);
    const { data: openPayments, error: openPaymentsError } = await supabaseAdmin
      .from('payments')
      .select('amount, status')
      .eq('booking_id', bookingId)
      .in('status', ['PENDING', 'WAITING_REVIEW']);
    if (openPaymentsError) return { error: openPaymentsError.message };
    const reserved = (openPayments || []).reduce((total, payment) => total + Number(payment.amount || 0), 0);
    if (input.paymentKind !== 'ADDITIONAL_CHARGE' && amount > Math.max(0, summary.remaining - reserved)) {
      return { error: `This request is more than the remaining unrequested balance (${Math.max(0, summary.remaining - reserved).toLocaleString('id-ID')} IDR).` };
    }

    let adjustmentId: string | null = null;
    if (input.paymentKind === 'ADDITIONAL_CHARGE') {
      const { data: adjustment, error: adjustmentError } = await supabaseAdmin
        .from('booking_adjustments')
        .insert({ booking_id: bookingId, description, amount, status: 'ACTIVE' })
        .select('id')
        .single();
      if (adjustmentError || !adjustment) return { error: adjustmentError?.message || 'Could not add the additional charge.' };
      adjustmentId = adjustment.id;
    }

    const paymentToken = crypto.randomUUID();
    const paymentLink = appUrl(`/payment/${paymentToken}`);
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        booking_id: bookingId,
        description,
        amount,
        status: 'PENDING',
        source: input.source || 'ADMIN_REQUEST',
        provider: input.provider,
        provider_amount: providerAmount,
        provider_currency: input.provider === 'PAYPAL' ? 'USD' : 'IDR',
        payment_kind: input.paymentKind,
        appointment_id: input.appointmentId || null,
        adjustment_id: adjustmentId,
        payment_token: paymentToken,
        payment_link: paymentLink,
        expires_at: input.expiresAt || null,
      })
      .select()
      .single();
    if (paymentError || !payment) return { error: paymentError?.message || 'Could not save the payment request.' };
    return { success: true, payment, redirect_url: paymentLink };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not create the payment request. Run migration 006 first.' };
  }
}

export async function releaseUnpaidInitialBooking(bookingId: string) {
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('bookings')
    .select('id, status')
    .eq('id', bookingId)
    .single();
  if (bookingError || !booking || booking.status !== 'PENDING') return;

  const { data: successfulPayments, error: paymentError } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('booking_id', bookingId)
    .in('status', ['PAID', 'APPROVED'])
    .limit(1);
  if (paymentError || successfulPayments?.length) return;

  await supabaseAdmin
    .from('bookings')
    .delete()
    .eq('id', bookingId)
    .eq('status', 'PENDING');
}
