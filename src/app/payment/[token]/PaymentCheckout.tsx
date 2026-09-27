'use client';

import { useEffect, useState } from 'react';

type Payment = {
  id: string;
  description: string;
  amount: number;
  status: string;
  provider: 'WISE' | 'PAYPAL' | 'MIDTRANS';
  provider_amount: number | null;
  provider_currency: string | null;
  payment_kind: string;
  transfer_reference: string | null;
  review_note: string | null;
  created_at: string;
  expires_at?: string | null;
};

function idr(value: number) { return `IDR ${value.toLocaleString('id-ID')}`; }
function usd(value: number | null) { return `USD ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function dateTime(date: string, time: string) {
  if (!date) return 'To be arranged';
  const label = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T00:00:00`));
  return time ? `${label} · ${time.slice(0, 5)}` : label;
}
function dateTimeWithZone(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
function label(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function statusTone(status: string) {
  if (['PAID', 'APPROVED'].includes(status)) return { text: 'text-emerald-300', border: 'border-emerald-500/35', background: 'bg-emerald-500/10', message: 'This payment has been confirmed by the studio.' };
  if (['DECLINED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(status)) return { text: 'text-red-300', border: 'border-red-500/40', background: 'bg-red-500/10', message: status === 'DECLINED' ? 'This Wise transfer was declined by the studio. Please contact Jerry before sending another transfer.' : 'This payment request is no longer active. Please contact Jerry for the next step.' };
  if (status === 'WAITING_REVIEW') return { text: 'text-amber-200', border: 'border-amber-500/40', background: 'bg-amber-500/10', message: 'Your transfer was received and is waiting for studio verification.' };
  return { text: 'text-amber-200', border: 'border-amber-500/40', background: 'bg-amber-500/10', message: 'This payment is waiting to be completed.' };
}

export default function PaymentCheckout({ payment, customerName, booking, summary, studioWhatsapp, wiseDetails }: { payment: Payment; customerName: string; booking: { sessionType: string; placement: string; date: string; time: string; price: number; initialDeposit: number }; summary: { baseTotal: number; additionalTotal: number; finalTotal: number; paidTotal: number; remaining: number } | null; studioWhatsapp: string; wiseDetails: { recipientName: string; bankName: string; accountDetails: string; referenceNote: string } }) {
  const [reference, setReference] = useState(payment.transfer_reference || '');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(payment.status);
  const [liveSummary, setLiveSummary] = useState(summary);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const token = typeof window === 'undefined' ? '' : window.location.pathname.split('/').pop() || '';

  useEffect(() => {
    let cancelled = false;

    const refreshStatus = async () => {
      try {
        const response = await fetch(`/api/payments/${token}/status`, { cache: 'no-store' });
        if (!response.ok || cancelled) return;
        const current = await response.json() as { status?: string; transferReference?: string | null; reviewNote?: string | null; summary?: typeof summary };
        if (current.status) {
          const nextStatus = current.status;
          setStatus((previous) => previous === nextStatus ? previous : nextStatus);
        }
        if (current.transferReference) setReference(current.transferReference);
        if (current.summary) setLiveSummary(current.summary);
        setLastChecked(new Date());
      } catch {
        // A temporary network error should not interrupt the payment page.
      }
    };

    refreshStatus();
    const interval = window.setInterval(refreshStatus, 5000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [token]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('paypal') !== 'return' || status === 'PAID') return;
    setBusy(true);
    fetch(`/api/payments/${token}/paypal/capture`, { method: 'POST' })
      .then(async (response) => ({ ok: response.ok, body: await response.json() }))
      .then(({ ok, body }) => { setMessage(ok ? 'Payment confirmed. Thank you.' : body.error || 'PayPal has not confirmed this payment yet.'); if (ok) setStatus('PAID'); })
      .catch(() => setMessage('We could not confirm PayPal yet. Please try again in a moment.'))
      .finally(() => setBusy(false));
  }, [status, token]);

  const startPayPal = async () => {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/payments/${token}/paypal/order`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not open PayPal.');
      window.location.assign(body.approveUrl);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not open PayPal.'); setBusy(false); }
  };

  const submitWise = async () => {
    if (!reference.trim()) { setMessage('Add the Wise transfer reference after sending payment.'); return; }
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/payments/${token}/wise-submitted`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not submit the transfer.');
      setStatus('WAITING_REVIEW'); setMessage('Thank you. Your transfer is waiting for studio verification.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not submit the transfer.'); }
    finally { setBusy(false); }
  };

  const complete = ['PAID', 'APPROVED'].includes(status);
  const tone = statusTone(status);
  const blocked = ['DECLINED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(status);
  const studioWhatsappDigits = studioWhatsapp.replace(/[^0-9]/g, '');
  const hasStudioWhatsapp = studioWhatsappDigits.length >= 8;
  const whatsappMessage = `Hi Jerry, I am ${customerName}.\n\nPayment: ${payment.description}\nAmount: ${idr(payment.amount)}\nStatus: ${label(status)}\nPayment ID: DLT-${payment.id.slice(0, 8).toUpperCase()}\n\nI would like to confirm the next step.`;
  const whatsappUrl = `https://wa.me/${studioWhatsappDigits}?text=${encodeURIComponent(whatsappMessage)}`;
  return <main className="min-h-screen bg-primary px-4 py-10 text-primary sm:py-16"><section className="mx-auto max-w-xl border border-border bg-surface p-6 shadow-2xl sm:p-9">
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Dotlinetattu payment</p>
    <h1 className="mt-3 font-heading text-4xl leading-tight">{complete ? 'Payment confirmed' : blocked ? 'Payment action needed' : status === 'WAITING_REVIEW' ? 'Transfer under review' : 'Complete your payment'}</h1>
    <p className="mt-3 text-secondary">Hello {customerName}. {complete ? 'The studio has recorded this payment.' : 'Use the secure method selected by the studio below.'}</p>
    {complete && <div className="mt-5 flex items-center gap-3 border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-200"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-400/60 bg-emerald-500/20"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4.2 4.2L19 6.5" /></svg></span><div><p className="font-semibold">Payment approved</p><p className="mt-0.5 text-sm text-emerald-100/80">This payment has been officially recorded.</p></div></div>}
    <section className="mt-7 border border-border bg-primary/40 p-4 sm:p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Booking details</p><dl className="mt-3 divide-y divide-border text-sm"><div className="flex justify-between gap-5 py-3"><dt className="text-secondary">Tattoo</dt><dd className="text-right font-medium">{label(booking.sessionType)} tattoo</dd></div><div className="flex justify-between gap-5 py-3"><dt className="text-secondary">Placement</dt><dd className="text-right font-medium">{booking.placement || 'To be confirmed'}</dd></div><div className="flex justify-between gap-5 py-3"><dt className="text-secondary">Appointment</dt><dd className="text-right font-medium">{dateTime(booking.date, booking.time)}</dd></div><div className="flex justify-between gap-5 py-3"><dt className="text-secondary">Original total</dt><dd className="font-mono">{idr(booking.price)}</dd></div></dl></section>
    <section className="mt-4 border border-border bg-primary/40 p-4 sm:p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">This payment</p><dl className="mt-3 divide-y divide-border text-sm"><div className="flex justify-between gap-5 py-3"><dt className="text-secondary">Purpose</dt><dd className="text-right font-medium">{payment.description}</dd></div><div className="flex justify-between gap-5 py-3"><dt className="text-secondary">Amount</dt><dd className="font-mono font-semibold">{idr(payment.amount)}</dd></div><div className="flex justify-between gap-5 py-3"><dt className="text-secondary">Method</dt><dd className="font-medium">{label(payment.provider)}</dd></div>{payment.provider === 'PAYPAL' && <div className="flex justify-between gap-5 py-3"><dt className="text-secondary">PayPal checkout</dt><dd className="font-mono font-semibold">{usd(payment.provider_amount)}</dd></div>}<div className="flex justify-between gap-5 py-3"><dt className="text-secondary">Status</dt><dd className={`font-semibold ${tone.text}`}>{label(status)}</dd></div><div className="flex justify-between gap-5 py-3"><dt className="text-secondary">Payment ID</dt><dd className="font-mono text-xs text-secondary">{payment.id.slice(0, 8).toUpperCase()}</dd></div></dl></section>
    <div role="status" className={`mt-4 border p-4 text-sm leading-6 ${tone.border} ${tone.background} ${tone.text}`}><p className="font-semibold">{label(status)}</p><p className="mt-1">{tone.message}</p></div>
    {status === 'PENDING' && payment.expires_at && <p className="mt-3 border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-sm leading-6 text-amber-100">Your selected time is held until <strong>{dateTimeWithZone(payment.expires_at)}</strong>. Complete payment or submit the Wise reference before then to keep the booking.</p>}
    {liveSummary && <section className="mt-4 border border-accent/30 bg-accent/[0.08] p-4 sm:p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Payment progress</p><dl className="mt-3 divide-y divide-accent/20 text-sm"><div className="flex justify-between gap-5 py-3"><dt className="text-secondary">Final agreed total</dt><dd className="font-mono">{idr(liveSummary.finalTotal)}</dd></div><div className="flex justify-between gap-5 py-3"><dt className="text-secondary">Confirmed payments</dt><dd className="font-mono text-emerald-300">{idr(liveSummary.paidTotal)}</dd></div><div className="flex justify-between gap-5 py-3"><dt className="font-medium text-primary">Remaining balance</dt><dd className="font-mono font-semibold text-primary">{idr(liveSummary.remaining)}</dd></div></dl></section>}
    {hasStudioWhatsapp && (payment.provider !== 'WISE' || status !== 'PENDING') && <a href={whatsappUrl} target="_blank" rel="noreferrer" className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 border border-[#08302b] bg-[#08302b] px-5 py-3 text-sm font-semibold text-emerald-200 transition-colors hover:border-emerald-600 hover:bg-emerald-600 hover:text-white"><span aria-hidden="true">◉</span> Contact Jerry on WhatsApp</a>}
    {!complete && !blocked && payment.provider === 'PAYPAL' && <button type="button" disabled={busy} onClick={startPayPal} className="mt-7 min-h-12 w-full bg-[#0070ba] px-5 py-3 font-semibold text-white transition-colors hover:bg-[#005ea6] disabled:opacity-50">{busy ? 'Opening PayPal…' : `Pay ${usd(payment.provider_amount)} with PayPal`}</button>}
    {!complete && !blocked && payment.provider === 'WISE' && <div className="mt-7 space-y-4"><div className="border border-accent/35 bg-accent/10 p-4 text-sm leading-6"><p className="font-semibold">Pay with Wise</p><p className="mt-2 text-secondary">Send exactly <strong className="text-primary">{idr(payment.amount)}</strong> using these transfer details. After sending, enter Wise&apos;s transfer reference so the studio can review it.</p>{wiseDetails.recipientName && <dl className="mt-4 divide-y divide-accent/20 border-y border-accent/20"><div className="flex justify-between gap-4 py-2"><dt className="text-secondary">Recipient</dt><dd className="text-right font-medium">{wiseDetails.recipientName}</dd></div>{wiseDetails.bankName && <div className="flex justify-between gap-4 py-2"><dt className="text-secondary">Bank / Wise</dt><dd className="text-right font-medium">{wiseDetails.bankName}</dd></div>}{wiseDetails.accountDetails && <div className="flex justify-between gap-4 py-2"><dt className="text-secondary">Account details</dt><dd className="whitespace-pre-wrap text-right font-mono text-xs text-primary">{wiseDetails.accountDetails}</dd></div>}</dl>}{wiseDetails.referenceNote && <p className="mt-3 text-xs text-secondary">Reference note: {wiseDetails.referenceNote}</p>}</div><label className="block text-sm font-medium">Wise transfer reference<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Example: WISE-12345678" className="mt-2 min-h-12 w-full border border-border bg-primary px-3 text-primary outline-none focus:border-accent" /></label><button type="button" disabled={busy || status === 'WAITING_REVIEW'} onClick={submitWise} className="min-h-12 w-full bg-accent px-5 py-3 font-semibold text-white disabled:opacity-50">{status === 'WAITING_REVIEW' ? 'Waiting for studio approval' : busy ? 'Submitting…' : 'I have sent the Wise transfer'}</button></div>}
    {payment.provider === 'MIDTRANS' && <p className="mt-7 border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">This is a previous payment link. Please contact the studio for help.</p>}
    {payment.review_note && <p className="mt-5 border border-border p-4 text-sm text-secondary">Studio note: {payment.review_note}</p>}
    <p className="mt-4 text-center text-xs text-secondary" aria-live="polite">Status updates automatically{lastChecked ? ` · checked ${lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
    {message && <p role="status" className="mt-5 border border-accent/30 bg-accent/10 p-4 text-sm text-primary">{message}</p>}
  </section></main>;
}
