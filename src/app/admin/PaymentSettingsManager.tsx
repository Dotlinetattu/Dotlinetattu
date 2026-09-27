'use client';

import { useState } from 'react';
import { updatePaymentSettingsAction } from './actions';

const inputClass = 'min-h-11 w-full border border-border bg-background px-3 font-mono text-sm text-primary outline-none focus:border-accent';

export default function PaymentSettingsManager({ initialUsdPerIdr, initialHoldHours }: { initialUsdPerIdr: number; initialHoldHours: number }) {
  const [usdPerIdr, setUsdPerIdr] = useState(String(initialUsdPerIdr));
  const [holdHours, setHoldHours] = useState(String(initialHoldHours));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function save() {
    setSaving(true);
    setMessage('');
    const result = await updatePaymentSettingsAction({ usdPerIdr: Number(usdPerIdr), holdHours: Number(holdHours) });
    setMessage(result.error || 'Payment settings saved. New links will use these values.');
    setSaving(false);
  }

  return <section className="border border-border bg-surface p-4 md:p-6" aria-labelledby="payment-settings-title">
    <div className="border-b border-border pb-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Payment controls</p>
      <h2 id="payment-settings-title" className="mt-1 font-heading text-2xl text-primary">PayPal rate &amp; booking hold</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">The rate is locked into each new PayPal link. An unpaid first booking holds its chosen time only until the deadline. A Wise payment that has a submitted reference stays reserved for studio review.</p>
    </div>
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <label className="block"><span className="mb-2 block text-xs uppercase tracking-wider text-secondary">USD per IDR</span><input className={inputClass} type="number" min="0.000001" max="0.01" step="0.0000001" inputMode="decimal" value={usdPerIdr} onChange={(event) => setUsdPerIdr(event.target.value)} /><span className="mt-2 block text-xs leading-5 text-secondary">Example: 0.0000615. Used to calculate the USD amount for new PayPal links.</span></label>
      <label className="block"><span className="mb-2 block text-xs uppercase tracking-wider text-secondary">Unpaid booking hold</span><input className={inputClass} type="number" min="6" max="12" step="1" inputMode="numeric" value={holdHours} onChange={(event) => setHoldHours(event.target.value)} /><span className="mt-2 block text-xs leading-5 text-secondary">Choose 6 to 12 hours. After this, an initial payment still marked Pending expires and the time slot reopens.</span></label>
    </div>
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center"><button type="button" disabled={saving} onClick={save} className="min-h-11 bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">{saving ? 'Saving…' : 'Save payment settings'}</button>{message && <p role="status" className="text-sm leading-5 text-secondary">{message}</p>}</div>
  </section>;
}
