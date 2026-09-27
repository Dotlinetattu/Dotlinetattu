import { supabaseAdmin } from '@/lib/supabase-admin';
import BlockedDatesManager from './BlockedDatesManager';
import BookingsTable from './BookingsTable';
import { normalizeWeeklyHours } from '@/lib/studio-hours';
import { getPaymentSettings } from '@/lib/payment-settings';
import PaymentSettingsManager from './PaymentSettingsManager';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const { data: bookings, error } = await supabaseAdmin
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: appointments } = await supabaseAdmin
    .from('appointments')
    .select('*')
    .order('date', { ascending: true });

  const { data: payments, error: paymentsError } = await supabaseAdmin
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: adjustments, error: adjustmentsError } = await supabaseAdmin
    .from('booking_adjustments')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: blockedDates } = await supabaseAdmin
    .from('blocked_dates')
    .select('*')
    .order('date', { ascending: true });

  const [{ data: openHoursSetting }, paymentSettings] = await Promise.all([supabaseAdmin
    .from('studio_settings')
    .select('value')
    .eq('key', 'open_hours')
    .maybeSingle(), getPaymentSettings()]);

  if (error) {
    return <div className="text-red-500">Error loading bookings: {error.message}</div>;
  }

  return (
    <div className="space-y-8 pb-20">
      <BookingsTable
        bookings={bookings || []}
        appointments={appointments || []}
        payments={payments || []}
        adjustments={adjustments || []}
        paymentsReady={!paymentsError && !adjustmentsError}
        blockedDates={blockedDates || []}
        openHours={normalizeWeeklyHours(openHoursSetting?.value)}
      />

      <PaymentSettingsManager initialUsdPerIdr={paymentSettings.usdPerIdr} initialHoldHours={paymentSettings.holdHours} />

      <details className="group rounded-sm border border-border bg-surface">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <span>Studio availability &amp; blocked dates</span>
          <span className="text-secondary transition-transform duration-200 group-open:rotate-45" aria-hidden="true">+</span>
        </summary>
        <div className="border-t border-border p-4 md:p-6">
          <BlockedDatesManager
            blockedDates={blockedDates || []}
            initialWeeklyHours={normalizeWeeklyHours(openHoursSetting?.value)}
          />
        </div>
      </details>
    </div>
  );
}
