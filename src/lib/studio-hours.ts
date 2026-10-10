export const WEEK_DAYS = [
  { key: 'sunday', label: 'Sunday', short: 'Sun' },
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
  { key: 'saturday', label: 'Saturday', short: 'Sat' },
] as const;

export type DayKey = (typeof WEEK_DAYS)[number]['key'];

export type DayHours = {
  open: boolean;
  start: string;
  end: string;
};

export type WeeklyHours = Record<DayKey, DayHours>;

const defaultDay = (): DayHours => ({ open: true, start: '10:00', end: '18:00' });

export const DEFAULT_WEEKLY_HOURS: WeeklyHours = {
  sunday: defaultDay(),
  monday: defaultDay(),
  tuesday: defaultDay(),
  wednesday: defaultDay(),
  thursday: defaultDay(),
  friday: defaultDay(),
  saturday: defaultDay(),
};

export function normalizeWeeklyHours(value: unknown): WeeklyHours {
  if (!value || typeof value !== 'object') return DEFAULT_WEEKLY_HOURS;

  const candidate = value as Record<string, unknown>;
  const legacyStart = typeof candidate.start === 'string' ? candidate.start : '10:00';
  const legacyEnd = typeof candidate.end === 'string' ? candidate.end : '18:00';

  return Object.fromEntries(WEEK_DAYS.map(({ key }) => {
    const day = candidate[key];
    if (!day || typeof day !== 'object') {
      return [key, { open: true, start: legacyStart, end: legacyEnd }];
    }

    const hours = day as Record<string, unknown>;
    return [key, {
      open: hours.open !== false,
      start: typeof hours.start === 'string' ? hours.start : legacyStart,
      end: typeof hours.end === 'string' ? hours.end : legacyEnd,
    }];
  })) as WeeklyHours;
}

export function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours * 60) + (minutes || 0);
}

export function getStudioDateTime(value: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Makassar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value).reduce<Record<string, string>>((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: (Number(parts.hour) * 60) + Number(parts.minute),
  };
}

export function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60).toString().padStart(2, '0');
  const remainder = (minutes % 60).toString().padStart(2, '0');
  return `${hours}:${remainder}`;
}

export function bookingSlotsForDay(hours: DayHours) {
  if (!hours.open) return [];
  const start = timeToMinutes(hours.start);
  const end = timeToMinutes(hours.end);
  const slots: string[] = [];

  for (let minute = start; minute + 60 <= end; minute += 60) {
    // Booking actions accept canonical HH:mm values. Appending seconds here
    // made every calendar choice fail server-side validation as HH:mm:ss.
    slots.push(minutesToTime(minute));
  }

  return slots;
}
