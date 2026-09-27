import { supabaseAdmin } from '@/lib/supabase-admin';

export const DEFAULT_PENDING_PAYMENT_HOLD_HOURS = 12;

function fallbackUsdPerIdr() {
  const configured = Number(process.env.PAYPAL_USD_PER_IDR);
  return Number.isFinite(configured) && configured > 0 ? configured : 0.0000615;
}

function numberSetting(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export async function getPaymentSettings() {
  const { data } = await supabaseAdmin
    .from('studio_settings')
    .select('key, value')
    .in('key', ['paypal_usd_per_idr', 'pending_payment_hold_hours']);

  const values = new Map((data || []).map((setting) => [setting.key, setting.value]));
  const usdPerIdr = numberSetting(values.get('paypal_usd_per_idr'), fallbackUsdPerIdr());
  const holdHours = Math.min(12, Math.max(6, Math.round(numberSetting(values.get('pending_payment_hold_hours'), DEFAULT_PENDING_PAYMENT_HOLD_HOURS))));

  return { usdPerIdr, holdHours };
}

export function usdFromIdr(amount: number, usdPerIdr: number) {
  return Math.round(Number(amount) * usdPerIdr * 100) / 100;
}
