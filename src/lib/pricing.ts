export const SERVICE_PRICES = {
  flash: {
    small: 1_500_000,
    medium: 2_500_000,
    large: 4_000_000,
  },
  custom: {
    passing: 1_500_000,
    beginning: 2_500_000,
    medium_session: 5_500_000,
    '1day': 8_500_000,
    '2days': 17_000_000,
  },
} as const;

export const FLASH_DEPOSIT_PERCENT = 50;
export const CUSTOM_DEPOSIT_PERCENT = 10;

export function calculateDeposit(total: number, percentage: number) {
  return Math.round(total * percentage / 100);
}

export function bookingQuote(type: 'flash' | 'custom', size: string) {
  if (type === 'flash' && (size === 'small' || size === 'medium' || size === 'large')) {
    const total = SERVICE_PRICES.flash[size];
    return { total, deposit: calculateDeposit(total, FLASH_DEPOSIT_PERCENT) };
  }

  if (type === 'custom' && (size === 'passing' || size === 'beginning' || size === 'medium_session' || size === '1day' || size === '2days')) {
    const total = SERVICE_PRICES.custom[size];
    return { total, deposit: calculateDeposit(total, CUSTOM_DEPOSIT_PERCENT) };
  }

  return null;
}
