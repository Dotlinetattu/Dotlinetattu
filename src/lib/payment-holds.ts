import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Releases only unpaid initial-booking holds. Wise payments awaiting manual
 * review are deliberately excluded because the customer has supplied proof.
 */
export async function expirePendingBookingHolds() {
  const now = new Date().toISOString();
  const { data: expiredCandidates, error } = await supabaseAdmin
    .from('payments')
    .select('id, booking_id')
    .eq('source', 'INITIAL_BOOKING')
    .eq('status', 'PENDING')
    .not('expires_at', 'is', null)
    .lt('expires_at', now);

  if (error || !expiredCandidates?.length) return [];

  const bookingIds = [...new Set(expiredCandidates.map((payment) => payment.booking_id))];
  const { data: relatedPayments } = await supabaseAdmin
    .from('payments')
    .select('booking_id, status')
    .in('booking_id', bookingIds);

  const bookingsWithConfirmedPayment = new Set(
    (relatedPayments || [])
      .filter((payment) => ['PAID', 'APPROVED'].includes(payment.status))
      .map((payment) => payment.booking_id),
  );

  const releasable = expiredCandidates.filter((payment) => !bookingsWithConfirmedPayment.has(payment.booking_id));
  if (!releasable.length) return [];

  const paymentIds = releasable.map((payment) => payment.id);
  const releasableBookingIds = [...new Set(releasable.map((payment) => payment.booking_id))];
  await Promise.all([
    supabaseAdmin.from('payments').update({ status: 'EXPIRED', updated_at: now }).in('id', paymentIds),
    supabaseAdmin.from('appointments').update({ status: 'CANCELLED' }).in('booking_id', releasableBookingIds).eq('status', 'SCHEDULED'),
    supabaseAdmin.from('bookings').update({ status: 'CANCELLED', admin_status: 'CANCELLED', stage: 'CANCELLED' }).in('id', releasableBookingIds).eq('status', 'PENDING'),
  ]);

  return releasableBookingIds;
}
