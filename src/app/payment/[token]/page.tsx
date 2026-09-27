import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase-admin';
import PaymentCheckout from './PaymentCheckout';
import { bookingPaymentSummary } from '@/lib/payments';

export const dynamic = 'force-dynamic';

export default async function PaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('id, booking_id, description, amount, status, provider, provider_amount, provider_currency, payment_kind, transfer_reference, review_note, appointment_id, created_at, expires_at')
    .eq('payment_token', token)
    .single();
  if (!payment) notFound();
  const [{ data: booking }, { data: appointment }] = await Promise.all([
    supabaseAdmin.from('bookings').select('name, session_type, placement, booking_date, booking_time, price, deposit').eq('id', payment.booking_id).single(),
    payment.appointment_id ? supabaseAdmin.from('appointments').select('type, date, time').eq('id', payment.appointment_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const summary = await bookingPaymentSummary(payment.booking_id).catch(() => null);
  const wiseDetails = {
    recipientName: process.env.WISE_RECIPIENT_NAME || '',
    bankName: process.env.WISE_BANK_NAME || '',
    accountDetails: process.env.WISE_ACCOUNT_DETAILS || '',
    referenceNote: process.env.WISE_REFERENCE_NOTE || '',
  };
  return <PaymentCheckout
    payment={{ ...payment, amount: Number(payment.amount), provider_amount: payment.provider_amount ? Number(payment.provider_amount) : null }}
    customerName={booking?.name || 'there'}
    booking={{ sessionType: booking?.session_type || '', placement: booking?.placement || '', date: appointment?.date || booking?.booking_date || '', time: appointment?.time || booking?.booking_time || '', price: Number(booking?.price || 0), initialDeposit: Number(booking?.deposit || 0) }}
    summary={summary}
    studioWhatsapp={process.env.NEXT_PUBLIC_STUDIO_WHATSAPP || ''}
    wiseDetails={wiseDetails}
  />;
}
