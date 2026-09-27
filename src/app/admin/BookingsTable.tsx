'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import { minutesToTime, timeToMinutes, WEEK_DAYS, type WeeklyHours } from '@/lib/studio-hours';
import {
  addAppointment,
  cancelAppointment,
  completeAppointment,
  createPaymentRequest,
  rescheduleAppointment,
  reviewWisePayment,
  refreshPaymentStatus,
  setClientStatus,
} from './actions';

type Appointment = {
  id: string;
  booking_id: string;
  type: string;
  date: string;
  time: string;
  duration_hours: number;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  notes: string | null;
};

type Payment = {
  id: string;
  booking_id: string;
  description: string;
  amount: number;
  status: 'PENDING' | 'WAITING_REVIEW' | 'APPROVED' | 'DECLINED' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
  payment_link: string | null;
  paid_at: string | null;
  created_at: string;
  source?: string | null;
  provider?: 'MIDTRANS' | 'WISE' | 'PAYPAL' | null;
  provider_amount?: number | null;
  provider_currency?: string | null;
  payment_kind?: 'DEPOSIT' | 'BALANCE_PAYMENT' | 'ADDITIONAL_CHARGE' | null;
  appointment_id?: string | null;
  transfer_reference?: string | null;
  review_note?: string | null;
};

type Booking = {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  session_type: string;
  description?: string;
  design_url: string | null;
  placement_url: string | null;
  booking_date: string;
  booking_time: string;
  status: string;
  stage?: string;
  admin_status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  price: number;
  deposit: number;
  placement: string;
  created_at: string;
};

type Adjustment = { id: string; booking_id: string; description: string; amount: number; status: 'ACTIVE' | 'VOID'; created_at: string };
type BlockedDate = { id: string; date: string; start_time: string | null; end_time: string | null; reason: string | null };

type Filter = 'attention' | 'upcoming' | 'payment' | 'completed' | 'all';
type Panel = 'appointment' | 'payment' | null;

const APPOINTMENT_LABELS: Record<string, string> = {
  consultation: 'Consultation',
  design_review: 'Design / follow-up meeting',
  tattoo_session: 'Tattoo session',
};

const APPOINTMENT_GUIDANCE = {
  consultation: {
    title: 'Consultation · talk before committing',
    description: 'Use for the first conversation: tattoo idea, placement, size, budget, and whether the design is suitable. No tattooing happens in this slot.',
    duration: 'Usually 30–60 minutes.',
  },
  design_review: {
    title: 'Design / follow-up meeting · review together',
    description: 'Use to review or refine artwork before tattooing, or for a short healing and touch-up assessment after the tattoo session.',
    duration: 'Usually 30–60 minutes.',
  },
  tattoo_session: {
    title: 'Tattoo session · the actual tattoo work',
    description: 'Use for the in-studio tattoo appointment. Choose enough time for setup, stencil placement, tattooing, and a short break if needed.',
    duration: 'Usually 2 hours or more, depending on the design.',
  },
} as const;

function Icon({ name, className = 'h-4 w-4' }: { name: 'calendar' | 'card' | 'chat' | 'chevron' | 'clock' | 'close' | 'search' | 'user'; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    calendar: <><path d="M8 2v4M16 2v4M3 9h18"/><rect x="3" y="4" width="18" height="17" rx="2"/></>,
    card: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></>,
    chat: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.5-5A8 8 0 1 1 21 15Z"/>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  };
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${date}T00:00:00`));
}

function appointmentTimeRange(time: string, durationHours: number) {
  const start = time.slice(0, 5);
  const end = minutesToTime(timeToMinutes(start) + (Number(durationHours) * 60));
  return `${start}–${end}`;
}

function money(value: number) {
  return `IDR ${Number(value || 0).toLocaleString('id-ID')}`;
}

function availableAppointmentTimes({ date, durationHours, appointments, blockedDates, openHours, excludeId }: { date: string; durationHours: number; appointments: Appointment[]; blockedDates: BlockedDate[]; openHours: WeeklyHours; excludeId?: string }) {
  if (!date || !Number.isFinite(durationHours) || durationHours <= 0) return [];
  const day = WEEK_DAYS[new Date(`${date}T12:00:00`).getDay()];
  const hours = openHours[day.key];
  if (!hours?.open) return [];

  const opening = timeToMinutes(hours.start);
  const closing = timeToMinutes(hours.end);
  const duration = durationHours * 60;
  const conflicts = appointments.filter((appointment) => appointment.status === 'SCHEDULED' && appointment.date === date && appointment.id !== excludeId);
  const blocks = blockedDates.filter((block) => block.date === date);
  const available: string[] = [];

  for (let start = opening; start + duration <= closing; start += 30) {
    const end = start + duration;
    const overlaps = (from: number, until: number) => start < until && end > from;
    const appointmentConflict = conflicts.some((appointment) => {
      const appointmentStart = timeToMinutes(appointment.time.slice(0, 5));
      return overlaps(appointmentStart, appointmentStart + (Number(appointment.duration_hours) * 60));
    });
    const blocked = blocks.some((block) => {
      if (!block.start_time || !block.end_time) return true;
      return overlaps(timeToMinutes(block.start_time), timeToMinutes(block.end_time));
    });
    if (!appointmentConflict && !blocked) available.push(minutesToTime(start));
  }
  return available;
}

function whatsappUrl(number: string, message?: string) {
  const phone = number.replace(/[^0-9]/g, '').replace(/^0/, '62');
  return `https://wa.me/${phone}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

function WhatsAppIcon() {
  return <Image src="/assets/whatsapp.png" alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-full" />;
}

function clientStatus(booking: Booking) {
  if (booking.admin_status) return booking.admin_status;
  if (booking.stage === 'COMPLETED') return 'COMPLETED';
  if (booking.stage === 'CANCELLED' || booking.status === 'CANCELLED') return 'CANCELLED';
  return 'ACTIVE';
}

const inputClass = 'min-h-12 w-full rounded-sm border border-border bg-primary px-3 text-base text-primary outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent';
const secondaryButton = 'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-sm border border-surface bg-surface px-3 py-2 text-sm font-medium text-primary transition-colors hover:border-[#2a1b14] hover:bg-[#2a1b14] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:border-zinc-900 disabled:bg-zinc-900 disabled:text-zinc-500';
const primaryButton = 'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500';
const whatsappButton = 'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-sm border border-emerald-950 bg-emerald-950 px-3 py-2 text-sm font-semibold text-emerald-200 transition-colors hover:border-emerald-700 hover:bg-emerald-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:bg-zinc-900 disabled:text-zinc-500';
const scheduleButton = 'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-sm border border-sky-950 bg-sky-950 px-3 py-2 text-sm font-semibold text-sky-200 transition-colors hover:border-sky-700 hover:bg-sky-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:bg-zinc-900 disabled:text-zinc-500';
const dangerButton = 'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-sm border border-red-950 bg-red-950 px-3 py-2 text-sm font-semibold text-red-200 transition-colors hover:border-red-700 hover:bg-red-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:bg-zinc-900 disabled:text-zinc-500';

export default function BookingsTable({ bookings, appointments, payments, adjustments, paymentsReady, blockedDates, openHours }: {
  bookings: Booking[];
  appointments: Appointment[];
  payments: Payment[];
  adjustments: Adjustment[];
  paymentsReady: boolean;
  blockedDates: BlockedDate[];
  openHours: WeeklyHours;
}) {
  const [filter, setFilter] = useState<Filter>('attention');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [createdPayment, setCreatedPayment] = useState<{ url: string; description: string; amount: number } | null>(null);
  const [zoomedImage, setZoomedImage] = useState<{ src: string; label: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [appointmentForm, setAppointmentForm] = useState({
    type: 'consultation' as 'consultation' | 'design_review' | 'tattoo_session',
    date: localToday(),
    time: '10:00',
    duration_hours: 1,
    notes: '',
  });
  const [paymentForm, setPaymentForm] = useState({ description: 'Tattoo session deposit', amount: '', provider: 'WISE' as 'WISE' | 'PAYPAL', providerAmount: '', paymentKind: 'DEPOSIT' as 'DEPOSIT' | 'BALANCE_PAYMENT' | 'ADDITIONAL_CHARGE', appointmentId: '' });

  const selected = bookings.find((booking) => booking.id === selectedId) || null;
  const appointmentGuide = APPOINTMENT_GUIDANCE[appointmentForm.type];
  const today = localToday();
  const availableTimes = useMemo(() => availableAppointmentTimes({
    date: appointmentForm.date,
    durationHours: appointmentForm.duration_hours,
    appointments,
    blockedDates,
    openHours,
    excludeId: editingAppointment?.id,
  }), [appointmentForm.date, appointmentForm.duration_hours, appointments, blockedDates, editingAppointment?.id, openHours]);

  useEffect(() => {
    if (panel !== 'appointment' || availableTimes.includes(appointmentForm.time)) return;
    setAppointmentForm((current) => ({ ...current, time: availableTimes[0] || '' }));
  }, [availableTimes, appointmentForm.time, panel]);

  const appointmentsFor = (bookingId: string) => appointments
    .filter((appointment) => appointment.booking_id === bookingId)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  const paymentsFor = (bookingId: string) => payments
    .filter((payment) => payment.booking_id === bookingId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const paymentSummaryFor = (booking: Booking) => {
    const additional = adjustments.filter((adjustment) => adjustment.booking_id === booking.id && adjustment.status === 'ACTIVE').reduce((total, adjustment) => total + Number(adjustment.amount || 0), 0);
    const paid = paymentsFor(booking.id).filter((payment) => ['PAID', 'APPROVED'].includes(payment.status)).reduce((total, payment) => total + Number(payment.amount || 0), 0);
    const finalTotal = Number(booking.price || 0) + additional;
    return { finalTotal, paid, remaining: Math.max(0, finalTotal - paid) };
  };

  const nextAppointment = (bookingId: string) => appointmentsFor(bookingId)
    .find((appointment) => appointment.status === 'SCHEDULED' && appointment.date >= today);

  const hasPendingPayment = (bookingId: string) => {
    const booking = bookings.find((item) => item.id === bookingId);
    const bookingPayments = paymentsFor(bookingId);
    return bookingPayments.some((payment) => ['PENDING', 'WAITING_REVIEW'].includes(payment.status) && !(booking?.status === 'PAID' && payment.source === 'INITIAL_BOOKING'));
  };

  const pendingPaymentsFor = (bookingId: string) => {
    const booking = bookings.find((item) => item.id === bookingId);
    return paymentsFor(bookingId).filter((payment) => ['PENDING', 'WAITING_REVIEW'].includes(payment.status) && !(booking?.status === 'PAID' && payment.source === 'INITIAL_BOOKING'));
  };

  const matchesFilter = (booking: Booking, target: Filter) => {
    const status = clientStatus(booking);
    const next = nextAppointment(booking.id);
    const waiting = hasPendingPayment(booking.id);
    if (target === 'attention') return status === 'ACTIVE' && (!next || waiting);
    if (target === 'upcoming') return status === 'ACTIVE' && Boolean(next);
    if (target === 'payment') return waiting;
    if (target === 'completed') return status !== 'ACTIVE';
    return true;
  };

  const filteredBookings = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return bookings.filter((booking) => {
      const searchMatch = !normalized || [booking.name, booking.whatsapp, booking.email, booking.placement]
        .some((value) => value?.toLowerCase().includes(normalized));
      return searchMatch && matchesFilter(booking, filter);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, appointments, payments, adjustments, filter, query, today]);

  const filters: { key: Filter; label: string; description: string }[] = [
    { key: 'attention', label: 'Needs action', description: 'No next meeting or payment still open' },
    { key: 'upcoming', label: 'Meeting booked', description: 'A future appointment is already set' },
    { key: 'payment', label: 'Payment open', description: 'Client still has a payment link to pay' },
    { key: 'completed', label: 'Closed records', description: 'Completed or cancelled clients' },
    { key: 'all', label: 'Every client', description: 'The full studio client list' },
  ];

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (zoomedImage) {
        setZoomedImage(null);
        return;
      }
      if (panel === 'appointment' && editingAppointment) {
        setPanel(null);
        resetAppointmentForm();
        return;
      }
      setSelectedId(null);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [editingAppointment, panel, zoomedImage]);

  const resetAppointmentForm = () => {
    setAppointmentForm({ type: 'consultation', date: localToday(), time: '10:00', duration_hours: 1, notes: '' });
    setEditingAppointment(null);
  };

  const openClient = (bookingId: string) => {
    setSelectedId(bookingId);
    setPanel(null);
    setMessage(null);
    setCreatedPayment(null);
    resetAppointmentForm();
  };

  const openAppointmentForm = (appointment?: Appointment) => {
    if (appointment) {
      setEditingAppointment(appointment);
      setAppointmentForm({
        type: appointment.type as typeof appointmentForm.type,
        date: appointment.date,
        time: appointment.time.substring(0, 5),
        duration_hours: Number(appointment.duration_hours),
        notes: appointment.notes || '',
      });
    } else {
      resetAppointmentForm();
    }
    setMessage(null);
    setPanel('appointment');
  };

  const submitAppointment = () => {
    if (!selected) return;
    startTransition(async () => {
      const result = editingAppointment
        ? await rescheduleAppointment(editingAppointment.id, appointmentForm)
        : await addAppointment(selected.id, appointmentForm);
      if (result.error) {
        setMessage({ tone: 'error', text: result.error });
        return;
      }
      setMessage({ tone: 'success', text: editingAppointment ? 'Appointment rescheduled.' : 'Appointment added.' });
      setPanel(null);
      resetAppointmentForm();
    });
  };

  const changeAppointmentStatus = (appointmentId: string, action: 'complete' | 'cancel') => {
    startTransition(async () => {
      const result = action === 'complete'
        ? await completeAppointment(appointmentId)
        : await cancelAppointment(appointmentId);
      setMessage(result.error
        ? { tone: 'error', text: result.error }
        : { tone: 'success', text: action === 'complete' ? 'Appointment completed.' : 'Appointment cancelled.' });
    });
  };

  const submitPayment = () => {
    if (!selected) return;
    startTransition(async () => {
      const result = await createPaymentRequest(selected.id, {
        description: paymentForm.description,
        amount: Number(paymentForm.amount),
        provider: paymentForm.provider,
        providerAmount: paymentForm.provider === 'PAYPAL' && paymentForm.providerAmount ? Number(paymentForm.providerAmount) : undefined,
        paymentKind: paymentForm.paymentKind,
        appointmentId: paymentForm.appointmentId || undefined,
      });
      if (result.error || !result.redirect_url) {
        setMessage({ tone: 'error', text: result.error || 'Could not create the payment link.' });
        return;
      }
      setCreatedPayment({ url: result.redirect_url, description: paymentForm.description, amount: Number(paymentForm.amount) });
      setMessage({
        tone: 'success',
        text: 'Payment link created. It is ready to share on WhatsApp.',
      });
      setPanel(null);
      setPaymentForm({ description: 'Tattoo session deposit', amount: '', provider: 'WISE', providerAmount: '', paymentKind: 'DEPOSIT', appointmentId: '' });
    });
  };

  const checkPaymentStatus = (paymentId: string) => {
    startTransition(async () => {
      const result = await refreshPaymentStatus(paymentId);
      setMessage(result.error
        ? { tone: 'error', text: result.error }
        : { tone: 'success', text: `Midtrans status refreshed: ${result.status?.toLowerCase()}.` });
    });
  };

  const reviewWise = (paymentId: string, decision: 'approve' | 'decline') => {
    startTransition(async () => {
      const result = await reviewWisePayment(paymentId, decision);
      setMessage(result.error ? { tone: 'error', text: result.error } : { tone: 'success', text: decision === 'approve' ? 'Wise payment approved. The remaining balance is updated.' : 'Wise payment declined. The balance remains unpaid.' });
    });
  };


  const updateClientStatus = (status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED') => {
    if (!selected) return;
    startTransition(async () => {
      const result = await setClientStatus(selected.id, status);
      if (result.error) setMessage({ tone: 'error', text: result.error });
      else {
        setMessage({ tone: 'success', text: status === 'ACTIVE' ? 'Client reopened.' : `Client marked ${status.toLowerCase()}.` });
        if (status !== 'ACTIVE') setSelectedId(null);
      }
    });
  };

  const shareCreatedPayment = createdPayment && selected
    ? whatsappUrl(selected.whatsapp, `Hi ${selected.name}, here is your Dotlinetattu payment link for ${createdPayment.description}: ${createdPayment.url}`)
    : '';

  return (
    <section aria-labelledby="studio-desk-title">
      <header className="mb-7 grid gap-5 border-b border-border pb-7 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-accent">Dotlinetattu · Studio desk</p>
          <h1 id="studio-desk-title" className="font-heading text-3xl text-primary md:text-5xl">One client record. Everything in one place.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-secondary md:text-base">Choose a list below, open a client, then set their next meeting or send a payment link. There are no stages to manage.</p>
        </div>
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-border bg-border text-center">
          <Metric label="Open" detail="current clients" value={bookings.filter((booking) => clientStatus(booking) === 'ACTIVE').length} />
          <Metric label="Booked" detail="meeting scheduled" value={bookings.filter((booking) => matchesFilter(booking, 'upcoming')).length} />
          <Metric label="To pay" detail="payment link open" value={bookings.reduce((total, booking) => total + pendingPaymentsFor(booking.id).length, 0)} />
        </div>
      </header>

      {!paymentsReady && (
        <div role="alert" className="mb-5 border border-amber-700 bg-amber-950 px-4 py-3 text-sm leading-6 text-amber-100">
          Payment history is not active yet. Run Supabase migration <strong>006_wise_paypal_payments.sql</strong> after the earlier migrations before creating payment requests.
        </div>
      )}

      <div className="mb-5 flex flex-col gap-3">
        <div className="order-1 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-label="Client filters">
          {filters.map((item) => {
            const count = bookings.filter((booking) => matchesFilter(booking, item.key)).length;
            return (
              <button key={item.key} type="button" onClick={() => setFilter(item.key)} aria-pressed={filter === item.key} className={`min-h-20 cursor-pointer border px-3 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${filter === item.key ? 'border-accent bg-accent text-white' : 'border-border bg-surface text-secondary hover:border-accent hover:text-primary'}`}>
                <span className="flex items-center justify-between gap-2 text-sm font-semibold"><span>{item.label}</span><span className="text-base tabular-nums opacity-80">{count}</span></span>
                <span className={`mt-1 block text-xs leading-4 ${filter === item.key ? 'text-white' : 'text-secondary'}`}>{item.description}</span>
              </button>
            );
          })}
        </div>
        <label className="relative order-2 block lg:max-w-xl">
          <span className="sr-only">Search clients</span>
          <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, WhatsApp, email, or placement" className={`${inputClass} pl-11`} />
        </label>
      </div>

      {filteredBookings.length === 0 ? (
        <div className="border border-dashed border-border bg-surface px-6 py-16 text-center">
          <Icon name="user" className="mx-auto mb-4 h-8 w-8 text-secondary" />
          <h2 className="font-heading text-xl text-primary">No clients here</h2>
          <p className="mt-2 text-sm text-secondary">Try another filter or search term.</p>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {filteredBookings.map((booking) => {
            const next = nextAppointment(booking.id);
            const pendingPayments = pendingPaymentsFor(booking.id);
            const status = clientStatus(booking);
            return (
              <article key={booking.id} className="group grid gap-5 border border-border bg-surface p-5 transition-colors hover:border-accent sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${status === 'ACTIVE' ? 'border-accent bg-accent px-3 text-white' : 'border-border text-secondary'}`}>{status.toLowerCase()}</span>
                    <span className="text-xs uppercase tracking-wider text-secondary">{booking.session_type} tattoo</span>
                  </div>
                  <h2 className="truncate font-heading text-2xl text-primary">{booking.name}</h2>
                  <p className="mt-1 truncate text-sm text-secondary">{booking.placement || 'Placement not specified'}</p>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    <span className="inline-flex items-center gap-2 text-primary"><Icon name="calendar" />{next ? `${formatDate(next.date)} · ${next.time.substring(0, 5)}` : 'No next appointment'}</span>
                    {pendingPayments.length > 0 && <span className="inline-flex items-center gap-2 text-amber-300"><Icon name="card" />{pendingPayments.length} awaiting payment</span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                  <a className={whatsappButton} href={whatsappUrl(booking.whatsapp)} target="_blank" rel="noreferrer"><WhatsAppIcon />WhatsApp</a>
                  <button type="button" className={primaryButton} onClick={() => openClient(booking.id)}>Open client<Icon name="chevron" /></button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 bg-black" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="client-drawer-title" className="ml-auto h-full w-full max-w-2xl overflow-y-auto border-l border-border bg-primary shadow-2xl">
            <div className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4 border-b border-border bg-primary px-4 py-3 md:px-6">
              <div className="min-w-0"><p className="text-xs uppercase tracking-wider text-secondary">Client record</p><h2 id="client-drawer-title" className="truncate font-heading text-xl text-primary">{selected.name}</h2></div>
              <button type="button" aria-label="Close client record" className={secondaryButton} onClick={() => setSelectedId(null)}><Icon name="close" className="h-5 w-5" /></button>
            </div>

            <div className="space-y-6 p-4 pb-20 md:p-6">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <a className={whatsappButton} href={whatsappUrl(selected.whatsapp)} target="_blank" rel="noreferrer"><WhatsAppIcon />WhatsApp</a>
                <button type="button" className={scheduleButton} onClick={() => openAppointmentForm()}><Icon name="calendar" />Add appointment</button>
                <button type="button" className={`${secondaryButton} col-span-2 border-amber-950 bg-amber-950 text-amber-100 hover:border-amber-800 hover:bg-amber-800 hover:text-white sm:col-span-1`} disabled={!paymentsReady} onClick={() => { setPanel('payment'); setMessage(null); }}><Icon name="card" />Request payment</button>
              </div>

              {message && <div role="status" className={`border px-4 py-3 text-sm ${message.tone === 'error' ? 'border-red-700 bg-red-950 text-red-100' : 'border-emerald-700 bg-emerald-950 text-emerald-100'}`}>{message.text}</div>}

              {paymentsReady && (() => {
                const summary = paymentSummaryFor(selected);
                return <section className="border border-accent bg-[#2b1b13] p-4" aria-label="Payment summary"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Payment summary</p><div className="mt-3 grid grid-cols-3 gap-3 text-sm"><div><p className="text-secondary">Final total</p><p className="mt-1 font-mono text-primary">{money(summary.finalTotal)}</p></div><div><p className="text-secondary">Confirmed</p><p className="mt-1 font-mono text-emerald-300">{money(summary.paid)}</p></div><div><p className="text-secondary">Remaining</p><p className="mt-1 font-mono font-semibold text-primary">{money(summary.remaining)}</p></div></div></section>;
              })()}

              {createdPayment && (
                <div className="border border-accent bg-[#2b1b13] p-4">
                  <p className="text-sm font-semibold text-primary">Payment link ready</p>
                  <p className="mt-1 text-sm text-secondary">{createdPayment.description} · {money(createdPayment.amount)}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <a className={whatsappButton} href={shareCreatedPayment} target="_blank" rel="noreferrer"><WhatsAppIcon />Send on WhatsApp</a>
                    <button type="button" className={secondaryButton} onClick={async () => { await navigator.clipboard.writeText(createdPayment.url); setMessage({ tone: 'success', text: 'Payment link copied.' }); }}>Copy link</button>
                  </div>
                </div>
              )}

              {panel === 'appointment' && !editingAppointment && (
                <ActionPanel title="Add appointment" onClose={() => { setPanel(null); resetAppointmentForm(); }}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Appointment type"><select className={inputClass} value={appointmentForm.type} onChange={(event) => setAppointmentForm({ ...appointmentForm, type: event.target.value as typeof appointmentForm.type })}><option value="consultation">Consultation</option><option value="design_review">Design / follow-up meeting</option><option value="tattoo_session">Tattoo session</option></select></Field>
                    <Field label="Duration"><select className={inputClass} value={appointmentForm.duration_hours} onChange={(event) => setAppointmentForm({ ...appointmentForm, duration_hours: Number(event.target.value) })}><option value={0.5}>30 minutes</option><option value={1}>1 hour</option><option value={2}>2 hours</option><option value={3}>3 hours</option><option value={4}>4 hours</option><option value={6}>6 hours</option><option value={8}>Full day · 8 hours</option></select></Field>
                    <aside className="sm:col-span-2 border border-accent bg-[#2b1b13] px-4 py-3" aria-live="polite">
                      <p className="text-sm font-semibold text-primary">{appointmentGuide.title}</p>
                      <p className="mt-1 text-sm leading-5 text-secondary">{appointmentGuide.description}</p>
                      <p className="mt-2 text-xs font-medium tracking-wide text-accent">{appointmentGuide.duration}</p>
                    </aside>
                    <Field label="Date"><input className={inputClass} type="date" value={appointmentForm.date} onChange={(event) => setAppointmentForm({ ...appointmentForm, date: event.target.value })} /></Field>
                    <Field label="Available time"><select className={inputClass} value={appointmentForm.time} disabled={availableTimes.length === 0} onChange={(event) => setAppointmentForm({ ...appointmentForm, time: event.target.value })}>{availableTimes.length === 0 ? <option value="">No available times</option> : availableTimes.map((time) => <option key={time} value={time}>{time}</option>)}</select><p className="mt-2 text-xs leading-5 text-secondary">Only times inside the opening hours and outside existing appointments or blocked periods appear here.</p></Field>
                    <div className="sm:col-span-2"><Field label="Private note · optional"><input className={inputClass} value={appointmentForm.notes} onChange={(event) => setAppointmentForm({ ...appointmentForm, notes: event.target.value })} placeholder="Design topic, address, or reminder" /></Field></div>
                  </div>
                  <button type="button" className={`${primaryButton} mt-5 w-full`} disabled={isPending || !appointmentForm.time} onClick={submitAppointment}>{isPending ? 'Saving…' : editingAppointment ? 'Save new time' : 'Add to calendar'}</button>
                </ActionPanel>
              )}

              {panel === 'payment' && (
                <ActionPanel title="Create payment request" onClose={() => setPanel(null)}>
                  <div className="space-y-4">
                    <Field label="What is this payment for?"><input className={inputClass} value={paymentForm.description} onChange={(event) => setPaymentForm({ ...paymentForm, description: event.target.value })} placeholder="Tattoo session deposit" /></Field>
                    <Field label="Amount · IDR"><input className={inputClass} type="number" min="1000" step="1000" inputMode="numeric" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} placeholder="2500000" /></Field>
                    <div className="grid gap-4 sm:grid-cols-2"><Field label="Payment method"><select className={inputClass} value={paymentForm.provider} onChange={(event) => setPaymentForm({ ...paymentForm, provider: event.target.value as 'WISE' | 'PAYPAL' })}><option value="WISE">Wise · manual transfer</option><option value="PAYPAL">PayPal · automatic checkout</option></select></Field><Field label="Payment type"><select className={inputClass} value={paymentForm.paymentKind} onChange={(event) => setPaymentForm({ ...paymentForm, paymentKind: event.target.value as typeof paymentForm.paymentKind })}><option value="DEPOSIT">Deposit</option><option value="BALANCE_PAYMENT">Balance payment</option><option value="ADDITIONAL_CHARGE">Additional charge · adds to total</option></select></Field></div>
                    {paymentForm.provider === 'PAYPAL' && <Field label="PayPal amount · USD"><input className={inputClass} type="number" min="0.01" step="0.01" inputMode="decimal" value={paymentForm.providerAmount} onChange={(event) => setPaymentForm({ ...paymentForm, providerAmount: event.target.value })} placeholder="Automatic from studio rate" /><p className="mt-2 text-xs leading-5 text-secondary">Optional. Leave blank to calculate automatically from the rate saved in Payment controls.</p></Field>}
                    <Field label="Linked appointment · optional"><select className={inputClass} value={paymentForm.appointmentId} onChange={(event) => setPaymentForm({ ...paymentForm, appointmentId: event.target.value })}><option value="">Not linked to one appointment</option>{appointmentsFor(selected.id).map((appointment) => <option key={appointment.id} value={appointment.id}>{APPOINTMENT_LABELS[appointment.type] || appointment.type} · {formatDate(appointment.date)}</option>)}</select></Field>
                    <p className="text-xs leading-5 text-secondary">Wise stays pending until you approve the transfer. PayPal is confirmed by PayPal after checkout. An additional charge increases the client&apos;s final total.</p>
                  </div>
                  <button type="button" className={`${primaryButton} mt-5 w-full`} disabled={isPending || !paymentForm.description || !paymentForm.amount} onClick={submitPayment}>{isPending ? 'Creating secure link…' : 'Create secure payment link'}</button>
                </ActionPanel>
              )}

              <section aria-labelledby="next-appointment-title">
                {(() => {
                  const allAppointments = appointmentsFor(selected.id);
                  const scheduled = allAppointments.filter((appointment) => appointment.status === 'SCHEDULED');
                  const history = allAppointments.filter((appointment) => appointment.status !== 'SCHEDULED');
                  return <>
                    <div className="mb-4 flex items-end justify-between gap-4 border-b border-border pb-3"><SectionTitle id="next-appointment-title" eyebrow="Schedule" title="Appointments" /><p className="mb-1 shrink-0 text-xs font-medium text-secondary">{scheduled.length ? `${scheduled.length} scheduled` : 'No upcoming slot'}</p></div>
                    {allAppointments.length === 0 ? <Empty text="No appointments yet. Add the next meeting when Jerry and the client agree on a time." /> : <>
                      {scheduled.length > 0 && <div className="relative space-y-3 border-l border-accent pl-4 before:absolute before:left-[-4px] before:top-0 before:h-2 before:w-2 before:rounded-full before:bg-accent">
                        {scheduled.map((appointment) => <article key={appointment.id} className="border border-border bg-surface p-4 shadow-sm">
                          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                            <div className="min-w-0"><p className="font-semibold text-primary">{APPOINTMENT_LABELS[appointment.type] || appointment.type}</p><p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-secondary"><span className="inline-flex items-center gap-2"><Icon name="calendar" />{formatDate(appointment.date)}</span><span aria-hidden="true">•</span><span className="inline-flex items-center gap-2"><Icon name="clock" />{appointmentTimeRange(appointment.time, appointment.duration_hours)}</span><span>· {appointment.duration_hours}h</span></p>{appointment.notes && <p className="mt-3 border-l-2 border-accent pl-3 text-sm leading-6 text-secondary">{appointment.notes}</p>}</div>
                            <div className="sm:col-span-2"><StatusPill status={appointment.status} className="block w-full text-center" /></div>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 sm:flex sm:justify-end"><button type="button" className={`${scheduleButton} col-span-2 sm:col-span-1`} disabled={isPending} onClick={() => openAppointmentForm(appointment)}>Reschedule</button><button type="button" className={`${primaryButton} bg-emerald-600 hover:bg-emerald-500`} disabled={isPending} onClick={() => changeAppointmentStatus(appointment.id, 'complete')}>Mark done</button><button type="button" className={dangerButton} disabled={isPending} onClick={() => changeAppointmentStatus(appointment.id, 'cancel')}>Cancel</button></div>
                        </article>)}
                      </div>}
                      {history.length > 0 && <details className="mt-4 border border-border bg-surface"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-medium text-secondary"><span>Appointment history</span><span>{history.length} record{history.length === 1 ? '' : 's'}</span></summary><div className="divide-y divide-border border-t border-border">{history.map((appointment) => <div key={appointment.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm"><div className="min-w-0"><p className="truncate font-medium text-secondary">{APPOINTMENT_LABELS[appointment.type] || appointment.type}</p><p className="mt-1 truncate text-xs text-secondary">{formatDate(appointment.date)} · {appointmentTimeRange(appointment.time, appointment.duration_hours)}</p></div><StatusPill status={appointment.status} /></div>)}</div></details>}
                    </>}
                  </>;
                })()}
              </section>

              <section aria-labelledby="payments-title">
                <SectionTitle id="payments-title" eyebrow="Money" title="Payment requests" />
                <div className="space-y-2">
                  {!paymentsReady ? <Empty text="Run migration 006 to activate Wise and PayPal payment requests." /> : paymentsFor(selected.id).length === 0 ? <Empty text="No payment requests yet." /> : paymentsFor(selected.id).map((payment) => {
                    const displayStatus = payment.status === 'PENDING' && selected.status === 'PAID' && payment.source === 'INITIAL_BOOKING' ? 'PAID' : payment.status;
                    return <div key={payment.id} className="grid gap-4 border border-border bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="min-w-0"><p className="break-words font-medium text-primary">{payment.description}</p><p className="mt-1 font-mono text-sm text-secondary">{money(payment.amount)}{payment.provider === 'PAYPAL' && payment.provider_amount ? ` · USD ${Number(payment.provider_amount).toFixed(2)}` : ''}</p><p className="mt-1 text-xs uppercase tracking-wider text-secondary">{payment.provider || 'MIDTRANS'} · {(payment.payment_kind || 'DEPOSIT').replaceAll('_', ' ')}</p>{payment.transfer_reference && <p className="mt-2 break-words text-xs text-secondary">Wise reference: {payment.transfer_reference}</p>}</div>
                      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:justify-end"><span className="col-span-2 sm:col-span-1"><StatusPill status={displayStatus} /></span>{displayStatus === 'PENDING' && payment.provider === 'MIDTRANS' && <button type="button" className={`${secondaryButton} w-full sm:w-auto`} disabled={isPending} onClick={() => checkPaymentStatus(payment.id)}>Refresh status</button>}{['WAITING_REVIEW', 'DECLINED'].includes(displayStatus) && payment.provider === 'WISE' && <><button type="button" className={`${primaryButton} w-full bg-emerald-600 hover:bg-emerald-500 sm:w-auto`} disabled={isPending} onClick={() => reviewWise(payment.id, 'approve')}>{displayStatus === 'DECLINED' ? 'Approve again' : 'Approve'}</button>{displayStatus === 'WAITING_REVIEW' && <button type="button" className={`${dangerButton} w-full sm:w-auto`} disabled={isPending} onClick={() => reviewWise(payment.id, 'decline')}>Decline</button>}</>}{['PENDING', 'WAITING_REVIEW'].includes(displayStatus) && payment.payment_link && <a className={`${whatsappButton} col-span-2 w-full sm:col-span-1 sm:w-auto`} href={whatsappUrl(selected.whatsapp, `Hi ${selected.name}, here is your Dotlinetattu payment link for ${payment.description}: ${payment.payment_link}`)} target="_blank" rel="noreferrer"><WhatsAppIcon />Share</a>}</div>
                    </div>;
                  })}
                </div>
              </section>

              <section aria-labelledby="request-title">
                <SectionTitle id="request-title" eyebrow="Client request" title="Tattoo details" />
                <dl className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border"><Detail label="Type" value={`${selected.session_type} tattoo`} /><Detail label="Placement" value={selected.placement || 'Not specified'} /><Detail label="WhatsApp" value={selected.whatsapp} /><Detail label="Email" value={selected.email || 'Not provided'} /></dl>
                {selected.description && <p className="border-x border-b border-border bg-surface p-4 text-sm leading-6 text-secondary">{selected.description}</p>}
                {(selected.design_url || selected.placement_url) && <div className="mt-3 grid grid-cols-2 gap-3">{selected.design_url && <ReferenceImage src={selected.design_url} label="Design reference" onOpen={() => setZoomedImage({ src: selected.design_url!, label: 'Design reference' })} />}{selected.placement_url && <ReferenceImage src={selected.placement_url} label="Placement photo" onOpen={() => setZoomedImage({ src: selected.placement_url!, label: 'Placement photo' })} />}</div>}
              </section>

              <section className="border-t border-border pt-5">
                <p className="mb-1 text-xs uppercase tracking-wider text-secondary">Close client record</p>
                <p className="mb-3 max-w-xl text-sm leading-6 text-secondary">Use <strong className="text-primary">Mark tattoo complete</strong> after the agreed tattoo work is finished. Use <strong className="text-primary">Cancel client</strong> only when the project will not continue.</p>
                {clientStatus(selected) === 'ACTIVE' ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><button type="button" className={`${primaryButton} bg-emerald-600 hover:bg-emerald-500`} disabled={isPending} onClick={() => updateClientStatus('COMPLETED')}>Mark tattoo complete</button><button type="button" className={dangerButton} disabled={isPending} onClick={() => updateClientStatus('CANCELLED')}>Cancel client</button></div> : <button type="button" className={`${primaryButton} w-full`} disabled={isPending} onClick={() => updateClientStatus('ACTIVE')}>Reopen client</button>}
              </section>
            </div>
          </div>
        </div>
      )}
      {panel === 'appointment' && editingAppointment && selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setPanel(null); resetAppointmentForm(); } }}>
          <section role="dialog" aria-modal="true" aria-labelledby="reschedule-title" className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto border border-accent bg-primary p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Schedule update</p><h3 id="reschedule-title" className="mt-1 font-heading text-2xl text-primary">Reschedule appointment</h3><p className="mt-2 text-sm text-secondary">Choose a new available time for {selected.name}.</p></div>
              <button type="button" aria-label="Close reschedule appointment" className={secondaryButton} onClick={() => { setPanel(null); resetAppointmentForm(); }}><Icon name="close" className="h-5 w-5" /></button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Appointment type"><select className={inputClass} value={appointmentForm.type} onChange={(event) => setAppointmentForm({ ...appointmentForm, type: event.target.value as typeof appointmentForm.type })}><option value="consultation">Consultation</option><option value="design_review">Design / follow-up meeting</option><option value="tattoo_session">Tattoo session</option></select></Field>
              <Field label="Duration"><select className={inputClass} value={appointmentForm.duration_hours} onChange={(event) => setAppointmentForm({ ...appointmentForm, duration_hours: Number(event.target.value) })}><option value={0.5}>30 minutes</option><option value={1}>1 hour</option><option value={2}>2 hours</option><option value={3}>3 hours</option><option value={4}>4 hours</option><option value={6}>6 hours</option><option value={8}>Full day · 8 hours</option></select></Field>
              <aside className="sm:col-span-2 border border-accent bg-[#2b1b13] px-4 py-3" aria-live="polite"><p className="text-sm font-semibold text-primary">{appointmentGuide.title}</p><p className="mt-1 text-sm leading-5 text-secondary">{appointmentGuide.description}</p></aside>
              <Field label="Date"><input className={inputClass} type="date" value={appointmentForm.date} onChange={(event) => setAppointmentForm({ ...appointmentForm, date: event.target.value })} /></Field>
              <Field label="Available time"><select className={inputClass} value={appointmentForm.time} disabled={availableTimes.length === 0} onChange={(event) => setAppointmentForm({ ...appointmentForm, time: event.target.value })}>{availableTimes.length === 0 ? <option value="">No available times</option> : availableTimes.map((time) => <option key={time} value={time}>{time}</option>)}</select><p className="mt-2 text-xs leading-5 text-secondary">Only valid studio slots are shown.</p></Field>
              <div className="sm:col-span-2"><Field label="Private note · optional"><input className={inputClass} value={appointmentForm.notes} onChange={(event) => setAppointmentForm({ ...appointmentForm, notes: event.target.value })} placeholder="Design topic, address, or reminder" /></Field></div>
            </div>
            <div className="mt-6 grid gap-2 sm:grid-cols-2"><button type="button" className={secondaryButton} onClick={() => { setPanel(null); resetAppointmentForm(); }}>Keep current time</button><button type="button" className={primaryButton} disabled={isPending || !appointmentForm.time} onClick={submitAppointment}>{isPending ? 'Saving…' : 'Save new time'}</button></div>
          </section>
        </div>
      )}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setZoomedImage(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="zoomed-image-title"
            className="relative flex h-full w-full max-w-6xl flex-col"
          >
            <div className="flex min-h-14 items-center justify-between gap-4 pb-3">
              <p id="zoomed-image-title" className="text-sm font-medium text-primary">
                {zoomedImage.label}
              </p>
              <button
                type="button"
                className={`${secondaryButton} border-white bg-black`}
                aria-label={`Close ${zoomedImage.label}`}
                onClick={() => setZoomedImage(null)}
              >
                <Icon name="close" className="h-5 w-5" />
                Close
              </button>
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden border border-white bg-black">
              <Image
                src={zoomedImage.src}
                alt={zoomedImage.label}
                fill
                sizes="100vw"
                unoptimized
                priority
                className="object-contain"
              />
            </div>
            <p className="pt-3 text-center text-xs text-secondary">Press Escape or click outside to close</p>
          </section>
        </div>
      )}
    </section>
  );
}

function Metric({ label, detail, value }: { label: string; detail: string; value: number }) {
  return <div className="min-w-20 bg-surface px-2 py-3 sm:px-3"><div className="font-heading text-2xl text-primary">{value}</div><div className="text-[10px] uppercase tracking-wider text-secondary">{label}</div><div className="mt-1 text-[9px] leading-3 text-secondary">{detail}</div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-secondary">{label}</span>{children}</label>;
}

function ActionPanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <section className="border border-accent bg-surface p-4 md:p-5"><div className="mb-5 flex items-center justify-between gap-4"><h3 className="font-heading text-xl text-primary">{title}</h3><button type="button" aria-label={`Close ${title}`} className={secondaryButton} onClick={onClose}><Icon name="close" /></button></div>{children}</section>;
}

function SectionTitle({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return <div className="mb-3"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">{eyebrow}</p><h3 id={id} className="mt-1 font-heading text-xl text-primary">{title}</h3></div>;
}

function StatusPill({ status, className = '' }: { status: string; className?: string }) {
  const style = status === 'PENDING'
    ? 'border-amber-700 bg-amber-950 text-amber-100'
    : status === 'SCHEDULED'
      ? 'border-sky-700 bg-sky-950 text-sky-100'
    : status === 'PAID' || status === 'COMPLETED'
      ? 'border-emerald-700 bg-emerald-950 text-emerald-100'
      : status === 'FAILED' || status === 'EXPIRED' || status === 'CANCELLED'
        ? 'border-red-700 bg-red-950 text-red-100'
        : 'border-border text-secondary';
  return <span className={`border bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${style} ${className}`}>{status.toLowerCase().replace('_', ' ')}</span>;
}

function Empty({ text }: { text: string }) {
  return <p className="border border-dashed border-border bg-surface px-4 py-6 text-center text-sm leading-6 text-secondary">{text}</p>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 bg-surface p-4"><dt className="text-[10px] uppercase tracking-wider text-secondary">{label}</dt><dd className="mt-1 break-words text-sm capitalize text-primary">{value}</dd></div>;
}

function ReferenceImage({ src, label, onOpen }: { src: string; label: string; onOpen: () => void }) {
  return (
    <figure className="overflow-hidden border border-border bg-surface">
      <button
        type="button"
        onClick={onOpen}
        className="group relative block aspect-square w-full cursor-zoom-in overflow-hidden bg-black text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
        aria-label={`Zoom ${label}`}
      >
        <Image
          src={src}
          alt={label}
          fill
          sizes="(max-width: 640px) 50vw, 320px"
          unoptimized
          className="object-contain transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <span className="absolute inset-x-0 bottom-0 bg-black px-3 py-2 text-xs font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
          Click to zoom
        </span>
      </button>
      <figcaption className="border-t border-border px-3 py-2 text-xs text-secondary">{label}</figcaption>
    </figure>
  );
}
