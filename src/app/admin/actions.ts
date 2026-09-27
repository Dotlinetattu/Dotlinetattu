'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import midtransClient from 'midtrans-client';
import { Resend } from 'resend';
import { WEEK_DAYS, normalizeWeeklyHours, timeToMinutes, type WeeklyHours } from '@/lib/studio-hours';
import { createPaymentRequestRecord, type PaymentRequestInput } from '@/lib/payment-requests';
import { sendPaymentStatusEmail } from '@/lib/payment-status-email';
import { requireAdminSession } from '@/lib/require-admin';

async function adminOnly() {
  return await requireAdminSession() ? null : { error: 'Unauthorized. Sign in to the studio admin first.' };
}

type AdminActionResult = {
  success?: boolean;
  error?: string;
  status?: string;
  redirect_url?: string;
  payment?: unknown;
};

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isClockTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(':').map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

// ────────────────────────────────────────────────
// Blocked Dates Management (existing)
// ────────────────────────────────────────────────

export async function blockDateAction(formData: FormData): Promise<AdminActionResult> {
  const unauthorized = await adminOnly();
  if (unauthorized) return unauthorized;
  const date = formData.get('date') as string;
  const reason = formData.get('reason') as string;
  const start_time = formData.get('start_time') as string || null;
  const end_time = formData.get('end_time') as string || null;

  if (!isCalendarDate(date)) return { error: 'Choose a valid date.' };
  if ((start_time && !isClockTime(start_time)) || (end_time && !isClockTime(end_time))) {
    return { error: 'Choose valid block times.' };
  }
  if ((start_time && !end_time) || (!start_time && end_time)) {
    return { error: 'Provide both block times, or leave both blank for a full-day block.' };
  }
  if (start_time && end_time && timeToMinutes(start_time) >= timeToMinutes(end_time)) {
    return { error: 'The block end time must be after the start time.' };
  }

  const { error } = await supabaseAdmin
    .from('blocked_dates')
    .insert([{ date, reason, start_time, end_time }]);

  if (error) {
    if (error.code === '23505') {
      return { error: 'Date is already blocked' };
    }
    return { error: error.message };
  }

  revalidatePath('/admin');
  return { success: true };
}

export async function unblockDateAction(id: string): Promise<AdminActionResult> {
  const unauthorized = await adminOnly();
  if (unauthorized) return unauthorized;
  const { error } = await supabaseAdmin
    .from('blocked_dates')
    .delete()
    .eq('id', id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/admin');
  return { success: true };
}

export async function updateWeeklyHoursAction(hours: WeeklyHours): Promise<AdminActionResult> {
  const unauthorized = await adminOnly();
  if (unauthorized) return unauthorized;
  for (const { key, label } of WEEK_DAYS) {
    const day = hours[key];
    if (!day || typeof day.open !== 'boolean') return { error: `${label} has invalid hours.` };
    if (day.open && (!/^\d{2}:\d{2}$/.test(day.start) || !/^\d{2}:\d{2}$/.test(day.end))) {
      return { error: `Choose valid opening and closing times for ${label}.` };
    }
    if (day.open && timeToMinutes(day.start) >= timeToMinutes(day.end)) {
      return { error: `${label}'s closing time must be after its opening time.` };
    }
  }

  const { error } = await supabaseAdmin
    .from('studio_settings')
    .upsert({ key: 'open_hours', value: hours }, { onConflict: 'key' });

  if (error) return { error: error.message };
  revalidatePath('/admin');
  revalidatePath('/booking');
  return { success: true };
}

export async function updatePaymentSettingsAction(input: { usdPerIdr: number; holdHours: number }): Promise<AdminActionResult> {
  const unauthorized = await adminOnly();
  if (unauthorized) return unauthorized;
  if (!Number.isFinite(input.usdPerIdr) || input.usdPerIdr < 0.000001 || input.usdPerIdr > 0.01) {
    return { error: 'Enter a valid USD per IDR rate.' };
  }
  if (!Number.isInteger(input.holdHours) || input.holdHours < 6 || input.holdHours > 12) {
    return { error: 'Choose a booking hold between 6 and 12 hours.' };
  }

  const { error } = await supabaseAdmin
    .from('studio_settings')
    .upsert([
      { key: 'paypal_usd_per_idr', value: input.usdPerIdr },
      { key: 'pending_payment_hold_hours', value: input.holdHours },
    ], { onConflict: 'key' });
  if (error) return { error: error.message };
  revalidatePath('/admin');
  revalidatePath('/booking');
  return { success: true };
}

type AppointmentInput = {
  type: 'consultation' | 'design_review' | 'tattoo_session';
  date: string;
  time: string;
  duration_hours: number;
  notes?: string;
};

async function appointmentConflict(input: AppointmentInput, excludeId?: string) {
  let query = supabaseAdmin
    .from('appointments')
    .select('id, time, duration_hours')
    .eq('date', input.date)
    .eq('status', 'SCHEDULED');

  if (excludeId) query = query.neq('id', excludeId);

  const [{ data: appointments, error }, { data: blocks }, { data: openHoursSetting }] = await Promise.all([
    query,
    supabaseAdmin
      .from('blocked_dates')
      .select('start_time, end_time')
      .eq('date', input.date),
    supabaseAdmin
      .from('studio_settings')
      .select('value')
      .eq('key', 'open_hours')
      .maybeSingle(),
  ]);

  if (error) return 'Could not check calendar availability.';

  const start = timeToMinutes(input.time);
  const end = start + (Number(input.duration_hours) * 60);
  const overlaps = (itemStart: number, itemEnd: number) => start < itemEnd && end > itemStart;
  const dayKey = WEEK_DAYS[new Date(`${input.date}T12:00:00`).getDay()].key;
  const hours = normalizeWeeklyHours(openHoursSetting?.value)[dayKey];

  if (!hours.open) return 'The studio is closed on this day.';
  if (start < timeToMinutes(hours.start) || end > timeToMinutes(hours.end)) {
    return `Choose a time within studio hours: ${hours.start}–${hours.end}.`;
  }

  if ((appointments || []).some((appointment) => {
    const appointmentStart = timeToMinutes(appointment.time);
    return overlaps(appointmentStart, appointmentStart + (Number(appointment.duration_hours || 1) * 60));
  })) {
    return 'That time overlaps another appointment.';
  }

  if ((blocks || []).some((block) => {
    if (!block.start_time || !block.end_time) return true;
    return overlaps(timeToMinutes(block.start_time), timeToMinutes(block.end_time));
  })) {
    return 'That time is blocked in studio availability.';
  }

  return null;
}

function validateAppointment(input: AppointmentInput) {
  if (!isCalendarDate(input.date) || !isClockTime(input.time)) return 'Choose a valid date and time.';
  if (!['consultation', 'design_review', 'tattoo_session'].includes(input.type)) return 'Choose a valid appointment type.';
  if (!Number.isFinite(Number(input.duration_hours)) || Number(input.duration_hours) <= 0 || Number(input.duration_hours) > 16) {
    return 'Choose a valid appointment duration.';
  }
  if ((input.notes || '').trim().length > 2_000) return 'The private note is too long.';
  return null;
}

export async function addAppointment(bookingId: string, input: AppointmentInput): Promise<AdminActionResult> {
  const unauthorized = await adminOnly();
  if (unauthorized) return unauthorized;
  const validationError = validateAppointment(input);
  if (validationError) return { error: validationError };

  const conflict = await appointmentConflict(input);
  if (conflict) return { error: conflict };

  const { error } = await supabaseAdmin.from('appointments').insert([{
    booking_id: bookingId,
    type: input.type,
    date: input.date,
    time: input.time,
    duration_hours: Number(input.duration_hours),
    status: 'SCHEDULED',
    notes: input.notes?.trim() || null,
  }]);

  if (error) return { error: error.message };
  revalidatePath('/admin');
  return { success: true };
}

export async function rescheduleAppointment(appointmentId: string, input: AppointmentInput): Promise<AdminActionResult> {
  const unauthorized = await adminOnly();
  if (unauthorized) return unauthorized;
  const validationError = validateAppointment(input);
  if (validationError) return { error: validationError };

  const conflict = await appointmentConflict(input, appointmentId);
  if (conflict) return { error: conflict };

  const { error } = await supabaseAdmin
    .from('appointments')
    .update({
      type: input.type,
      date: input.date,
      time: input.time,
      duration_hours: Number(input.duration_hours),
      notes: input.notes?.trim() || null,
    })
    .eq('id', appointmentId);

  if (error) return { error: error.message };
  revalidatePath('/admin');
  return { success: true };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] || character);
}

export async function createPaymentRequest(bookingId: string, input: PaymentRequestInput): Promise<AdminActionResult> {
  const unauthorized = await adminOnly();
  if (unauthorized) return unauthorized;
  const result = await createPaymentRequestRecord(bookingId, { ...input, source: 'ADMIN_REQUEST', expiresAt: undefined });
  if ('success' in result) revalidatePath('/admin');
  return result;
}

export async function refreshPaymentStatus(paymentId: string): Promise<AdminActionResult> {
  const unauthorized = await adminOnly();
  if (unauthorized) return unauthorized;
  const { data: payment, error } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();
  if (error || !payment) return { error: 'Payment record not found.' };
  if (payment.provider !== 'MIDTRANS') return { error: 'This payment updates automatically through PayPal or requires Wise review.' };
  if (!payment.midtrans_order_id) return { error: 'This payment has no Midtrans order ID.' };

  try {
    const core = new midtransClient.CoreApi({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: process.env.MIDTRANS_SERVER_KEY,
    });
    const status = await core.transaction.status(payment.midtrans_order_id);
    const transactionStatus = String(status.transaction_status || 'pending');
    const fraudStatus = String(status.fraud_status || '');
    const nextStatus = transactionStatus === 'settlement' || (transactionStatus === 'capture' && fraudStatus !== 'challenge')
      ? 'PAID'
      : transactionStatus === 'expire'
        ? 'EXPIRED'
        : transactionStatus === 'cancel'
          ? 'CANCELLED'
          : transactionStatus === 'deny'
            ? 'FAILED'
            : 'PENDING';
    const { error: updateError } = await supabaseAdmin
      .from('payments')
      .update({ status: nextStatus, paid_at: nextStatus === 'PAID' ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
      .eq('id', paymentId);
    if (updateError) return { error: updateError.message };
    revalidatePath('/admin');
    return { success: true, status: nextStatus };
  } catch (exception) {
    console.error('Failed to refresh Midtrans payment status:', exception);
    const message = exception instanceof Error ? exception.message : '';
    if (message.includes('404') || message.toLowerCase().includes("transaction doesn't exist")) {
      return { error: 'Midtrans could not find this transaction. It may be an old test link or belong to a different sandbox/production account. Create a new payment link.' };
    }
    return { error: 'Could not check Midtrans status. Please verify the payment environment and try again.' };
  }
}

export async function reviewWisePayment(paymentId: string, decision: 'approve' | 'decline', note?: string): Promise<AdminActionResult> {
  const unauthorized = await adminOnly();
  if (unauthorized) return unauthorized;
  const { data: payment, error } = await supabaseAdmin.from('payments').select('provider, status').eq('id', paymentId).single();
  if (error || !payment) return { error: 'Payment record not found.' };
  if (payment.provider !== 'WISE') return { error: 'Only Wise transfers need manual approval.' };
  if (!['PENDING', 'WAITING_REVIEW', 'DECLINED'].includes(payment.status)) return { error: 'This transfer has already been finalised.' };
  const status = decision === 'approve' ? 'APPROVED' : 'DECLINED';
  const { error: updateError } = await supabaseAdmin
    .from('payments')
    .update({ status, review_note: note?.trim() || null, reviewed_at: new Date().toISOString(), paid_at: decision === 'approve' ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq('id', paymentId);
  if (updateError) return { error: updateError.message };
  if (decision === 'approve') await sendPaymentStatusEmail(paymentId, 'RECEIPT');
  revalidatePath('/admin');
  return { success: true, status };
}

export async function resendPaymentEmail(paymentId: string): Promise<AdminActionResult> {
  const unauthorized = await adminOnly();
  if (unauthorized) return unauthorized;
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return { error: 'RESEND_API_KEY and RESEND_FROM_EMAIL must be configured.' };
  const { data: payment, error: paymentError } = await supabaseAdmin.from('payments').select('*').eq('id', paymentId).single();
  if (paymentError || !payment) return { error: 'Payment record not found.' };
  const { data: booking, error: bookingError } = await supabaseAdmin.from('bookings').select('*').eq('id', payment.booking_id).single();
  if (bookingError || !booking?.email) return { error: 'This client has no email address.' };

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    const result = await resend.emails.send({
      from: fromEmail,
      to: booking.email,
      subject: `Dotlinetattu - ${payment.description}`,
      html: `<p>Hello ${escapeHtml(booking.name)},</p><p>Here is your payment link for <strong>${escapeHtml(payment.description)}</strong>.</p><p><a href="${payment.payment_link}">Open secure payment checkout</a></p><p>Amount: IDR ${Number(payment.amount).toLocaleString('id-ID')}</p>`,
      text: `Hello ${booking.name}. Payment: ${payment.description}. Amount: IDR ${Number(payment.amount).toLocaleString('id-ID')}. Open the secure checkout: ${payment.payment_link}`,
    });
    if (result.error) return { error: result.error.message || 'Resend rejected the email.' };
    return { success: true };
  } catch (exception) {
    console.error('Payment email resend failed:', exception);
    return { error: exception instanceof Error ? exception.message : 'Email delivery failed.' };
  }
}

export async function cancelAppointment(appointmentId: string): Promise<AdminActionResult> {
  const unauthorized = await adminOnly();
  if (unauthorized) return unauthorized;
  const { error } = await supabaseAdmin
    .from('appointments')
    .update({ status: 'CANCELLED' })
    .eq('id', appointmentId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/admin');
  return { success: true };
}

export async function completeAppointment(appointmentId: string): Promise<AdminActionResult> {
  const unauthorized = await adminOnly();
  if (unauthorized) return unauthorized;
  const { error } = await supabaseAdmin
    .from('appointments')
    .update({ status: 'COMPLETED' })
    .eq('id', appointmentId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/admin');
  return { success: true };
}

export async function setClientStatus(
  bookingId: string,
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
): Promise<AdminActionResult> {
  const unauthorized = await adminOnly();
  if (unauthorized) return unauthorized;
  const legacyStage = status === 'COMPLETED'
    ? 'COMPLETED'
    : status === 'CANCELLED'
      ? 'CANCELLED'
      : undefined;

  const update: Record<string, string> = { admin_status: status };
  if (legacyStage) update.stage = legacyStage;

  const { error } = await supabaseAdmin
    .from('bookings')
    .update(update)
    .eq('id', bookingId);

  if (error) return { error: error.message };
  revalidatePath('/admin');
  return { success: true };
}
