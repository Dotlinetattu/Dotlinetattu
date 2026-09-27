import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { appUrl, bookingPaymentSummary, formatIdr, formatUsd } from '@/lib/payments';

type EmailKind = 'REVIEW' | 'RECEIPT';

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] || character));
}

export async function sendPaymentStatusEmail(paymentId: string, kind: EmailKind) {
  if (!process.env.RESEND_API_KEY) return { skipped: 'RESEND_API_KEY is not configured.' };
  if (!process.env.RESEND_FROM_EMAIL) return { skipped: 'RESEND_FROM_EMAIL is not configured.' };
  const sentColumn = kind === 'RECEIPT' ? 'receipt_email_sent_at' : 'review_email_sent_at';
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('payments')
    .update({ [sentColumn]: new Date().toISOString() })
    .eq('id', paymentId)
    .is(sentColumn, null)
    .select('id')
    .maybeSingle();
  if (claimError || !claimed) return { skipped: claimError?.message || 'Email already sent.' };

  try {
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('id, booking_id, description, amount, status, provider, provider_amount, provider_currency, payment_kind, payment_token, transfer_reference')
      .eq('id', paymentId)
      .single();
    if (paymentError || !payment) throw new Error('Payment record not found.');
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('name, email, session_type, placement, booking_date, booking_time, price')
      .eq('id', payment.booking_id)
      .single();
    if (bookingError || !booking?.email) return { skipped: 'Customer has no email address.' };
    const summary = await bookingPaymentSummary(payment.booking_id);
    const receipt = kind === 'RECEIPT';
    const title = receipt ? 'Payment receipt' : 'Wise transfer received for review';
    const intro = receipt
      ? `We have confirmed your payment. Thank you, ${escapeHtml(booking.name)}.`
      : `Thank you, ${escapeHtml(booking.name)}. We received your Wise transfer reference and the studio will review it shortly.`;
    const paymentUrl = appUrl(`/payment/${payment.payment_token}`);
    const providerValue = payment.provider === 'PAYPAL' && payment.provider_amount
      ? `${formatUsd(Number(payment.provider_amount))} via PayPal`
      : payment.provider;
    const detailRows = [
      ['Payment ID', `DLT-${payment.id.slice(0, 8).toUpperCase()}`],
      ['Purpose', payment.description],
      ['Amount', formatIdr(Number(payment.amount))],
      ['Method', providerValue],
      ['Tattoo', `${booking.session_type} · ${booking.placement || 'To be confirmed'}`],
      ['Appointment', `${booking.booking_date} · ${booking.booking_time?.slice(0, 5) || 'To be arranged'}`],
      ['Final booking total', formatIdr(summary.finalTotal)],
      ['Confirmed payments', formatIdr(summary.paidTotal)],
      ['Remaining balance', formatIdr(summary.remaining)],
      ...(payment.transfer_reference ? [['Wise reference', payment.transfer_reference]] : []),
    ];
    const rows = detailRows.map(([label, value]) => `<tr><td style="padding:11px 0;border-bottom:1px solid #333;color:#9b968f;width:42%;font-size:13px">${escapeHtml(label)}</td><td style="padding:11px 0;border-bottom:1px solid #333;color:#fff;font-size:14px;text-align:right">${escapeHtml(value)}</td></tr>`).join('');
    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#171311;color:#fff"><p style="margin:0;color:#d67b55;font-size:12px;letter-spacing:2px;font-weight:bold">DOTLINETATTU</p><h1 style="font-family:Georgia,serif;margin:14px 0 10px;font-size:32px;font-weight:normal">${title}</h1><p style="color:#c6bfb6;line-height:1.6">${intro}</p>${!receipt ? '<p style="color:#e9c98a;line-height:1.6">This is not a payment receipt yet. Your payment will be recorded only after the studio approves the transfer.</p>' : ''}<table style="width:100%;border-collapse:collapse;margin-top:28px">${rows}</table><p style="text-align:center;margin:32px 0 0"><a href="${paymentUrl}" style="display:inline-block;background:#d67b55;color:#fff;padding:14px 22px;text-decoration:none;font-weight:bold">VIEW PAYMENT DETAILS</a></p></div>`;
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: booking.email,
      subject: receipt ? `Dotlinetattu receipt · ${payment.description}` : `Dotlinetattu transfer received · awaiting review`,
      html,
      text: `${title}\n\n${receipt ? 'Your payment is confirmed.' : 'Your Wise transfer is awaiting studio review.'}\nPayment: ${payment.description}\nAmount: ${formatIdr(Number(payment.amount))}\nConfirmed payments: ${formatIdr(summary.paidTotal)}\nRemaining balance: ${formatIdr(summary.remaining)}\nView details: ${paymentUrl}`,
    });
    if (result.error) throw new Error(result.error.message || 'Resend rejected the email.');
    return { success: true };
  } catch (error) {
    await supabaseAdmin.from('payments').update({ [sentColumn]: null }).eq('id', paymentId);
    console.error('Payment status email failed:', error);
    return { error: error instanceof Error ? error.message : 'Payment status email failed.' };
  }
}
