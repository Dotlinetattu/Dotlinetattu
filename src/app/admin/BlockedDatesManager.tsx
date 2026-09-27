'use client';

import { useState } from 'react';
import { WEEK_DAYS, type DayKey, type WeeklyHours } from '@/lib/studio-hours';
import { blockDateAction, unblockDateAction, updateWeeklyHoursAction } from './actions';

type BlockedDate = {
  id: string;
  date: string;
  reason: string;
  start_time: string | null;
  end_time: string | null;
};

const fieldClass = 'min-h-11 w-full border border-border bg-background px-3 text-sm text-primary outline-none focus:border-accent';
const buttonClass = 'inline-flex min-h-11 cursor-pointer items-center justify-center border border-surface bg-surface px-4 text-sm font-medium text-primary transition-colors hover:border-[#2a1b14] hover:bg-[#2a1b14] disabled:cursor-not-allowed disabled:border-zinc-900 disabled:bg-zinc-900 disabled:text-zinc-500';

export default function BlockedDatesManager({
  blockedDates,
  initialWeeklyHours,
}: {
  blockedDates: BlockedDate[];
  initialWeeklyHours: WeeklyHours;
}) {
  const [weeklyHours, setWeeklyHours] = useState(initialWeeklyHours);
  const [savingHours, setSavingHours] = useState(false);
  const [hoursMessage, setHoursMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isFullDay, setIsFullDay] = useState(true);

  function updateDay(day: DayKey, change: Partial<WeeklyHours[DayKey]>) {
    setWeeklyHours((current) => ({
      ...current,
      [day]: { ...current[day], ...change },
    }));
    setHoursMessage('');
  }

  function copyMondayToEveryDay() {
    const monday = weeklyHours.monday;
    setWeeklyHours(Object.fromEntries(
      WEEK_DAYS.map(({ key }) => [key, { ...monday }]),
    ) as WeeklyHours);
    setHoursMessage('Monday’s hours copied to every day. Save to apply them.');
  }

  async function saveWeeklyHours() {
    setSavingHours(true);
    setHoursMessage('');
    const result = await updateWeeklyHoursAction(weeklyHours);
    setHoursMessage(result.error || 'Weekly hours saved. The public booking calendar now follows this schedule.');
    setSavingHours(false);
  }

  async function handleBlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const form = event.currentTarget;
    const result = await blockDateAction(new FormData(form));

    if (result?.error) {
      setError(result.error);
    } else {
      form.reset();
      setIsFullDay(true);
    }
    setLoading(false);
  }

  async function handleUnblock(id: string) {
    if (confirm('Are you sure you want to unblock this?')) {
      await unblockDateAction(id);
    }
  }

  const formatTime = (time: string | null) => time?.substring(0, 5) || '';

  return (
    <div className="space-y-8">
      <section className="border border-border bg-surface p-4 md:p-6" aria-labelledby="weekly-hours-title">
        <div className="mb-5 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Regular schedule</p>
            <h2 id="weekly-hours-title" className="mt-1 font-heading text-2xl text-primary">Weekly opening hours</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-secondary">Set when clients may book on each weekday. Turn a day off when the studio is normally closed.</p>
          </div>
          <button type="button" className={buttonClass} onClick={copyMondayToEveryDay}>Copy Monday to all</button>
        </div>

        <div className="divide-y divide-border border-y border-border">
          {WEEK_DAYS.map(({ key, label, short }) => {
            const hours = weeklyHours[key];
            return (
              <div key={key} className="grid gap-3 py-4 sm:grid-cols-[7rem_7rem_1fr] sm:items-center">
                <div>
                  <span className="hidden text-sm font-semibold text-primary sm:inline">{label}</span>
                  <span className="text-sm font-semibold text-primary sm:hidden">{short}</span>
                </div>
                <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm text-primary">
                  <input
                    type="checkbox"
                    checked={hours.open}
                    onChange={(event) => updateDay(key, { open: event.target.checked })}
                    className="h-4 w-4 accent-[var(--accent-orange)]"
                  />
                  {hours.open ? 'Open' : 'Closed'}
                </label>
                {hours.open ? (
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <label>
                      <span className="sr-only">{label} opening time</span>
                      <input type="time" value={hours.start} onChange={(event) => updateDay(key, { start: event.target.value })} className={`${fieldClass} [color-scheme:dark]`} />
                    </label>
                    <span className="text-xs text-secondary">to</span>
                    <label>
                      <span className="sr-only">{label} closing time</span>
                      <input type="time" value={hours.end} onChange={(event) => updateDay(key, { end: event.target.value })} className={`${fieldClass} [color-scheme:dark]`} />
                    </label>
                  </div>
                ) : (
                  <p className="text-sm text-secondary">No online bookings on this day</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="button" className="min-h-11 bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500" disabled={savingHours} onClick={saveWeeklyHours}>
            {savingHours ? 'Saving…' : 'Save weekly hours'}
          </button>
          {hoursMessage && <p role="status" className="text-sm leading-5 text-secondary">{hoursMessage}</p>}
        </div>
      </section>

      <section className="border border-border bg-surface p-4 md:p-6" aria-labelledby="exceptions-title">
        <div className="mb-5 border-b border-border pb-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Exceptions</p>
          <h2 id="exceptions-title" className="mt-1 font-heading text-2xl text-primary">Block a date or time</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-secondary">Use this only for holidays, travel, breaks, or another one-off time when the regular weekly schedule should not apply.</p>
        </div>

        <form onSubmit={handleBlock} className="mb-8 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-wider text-secondary">Date</span>
              <input type="date" name="date" required className={`${fieldClass} [color-scheme:dark]`} />
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end border border-border bg-background px-3 text-sm text-primary">
              <input type="checkbox" name="isFullDay" checked={isFullDay} onChange={(event) => setIsFullDay(event.target.checked)} className="h-4 w-4 accent-[var(--accent-orange)]" />
              Block the full day
            </label>
          </div>

          {!isFullDay && (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-wider text-secondary">Unavailable from</span>
                <input type="time" name="start_time" required className={`${fieldClass} [color-scheme:dark]`} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-wider text-secondary">Unavailable until</span>
                <input type="time" name="end_time" required className={`${fieldClass} [color-scheme:dark]`} />
              </label>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-wider text-secondary">Reason · optional</span>
              <input type="text" name="reason" placeholder="Holiday, guest spot, personal break…" className={fieldClass} />
            </label>
            <button type="submit" disabled={loading} className="min-h-11 bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
              {loading ? 'Blocking…' : 'Add exception'}
            </button>
          </div>
        </form>

        {error && <p role="alert" className="mb-4 border border-border px-4 py-3 text-sm text-primary">{error}</p>}

        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[36rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-background text-xs text-secondary">
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Unavailable</th>
                <th className="p-3 font-medium">Reason</th>
                <th className="p-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {blockedDates.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-sm text-secondary">No schedule exceptions.</td></tr>
              ) : blockedDates.map((item) => (
                <tr key={item.id} className="border-b border-border">
                  <td className="p-3 text-sm text-primary">{item.date}</td>
                  <td className="p-3 text-sm text-primary">{item.start_time && item.end_time ? `${formatTime(item.start_time)}–${formatTime(item.end_time)}` : 'Full day'}</td>
                  <td className="p-3 text-sm text-secondary">{item.reason || '—'}</td>
                  <td className="p-3 text-right"><button type="button" onClick={() => handleUnblock(item.id)} className={`${buttonClass} min-h-9 px-3 text-xs text-secondary`}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
