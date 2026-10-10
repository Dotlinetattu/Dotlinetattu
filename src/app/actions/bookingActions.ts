'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { DEFAULT_WEEKLY_HOURS, getStudioDateTime, normalizeWeeklyHours } from '@/lib/studio-hours';
import { expirePendingBookingHolds } from '@/lib/payment-holds';
import { bookingQuote } from '@/lib/pricing';

type BookingInput = {
  name: string;
  email: string;
  whatsapp: string;
  placement: string;
  description?: string;
  date: string;
  time: string;
  type: 'flash' | 'custom';
  size: string;
  design_url?: string | null;
  placement_url?: string | null;
};

function isReadOnlyCalendarPreview() {
  return process.env.NODE_ENV === 'development' && process.env.BOOKING_CALENDAR_PREVIEW === 'true';
}

async function loadBookedSlots() {
  // A local preview may read real availability, but must not expire or update
  // payment holds as a side effect of simply opening the calendar.
  if (!isReadOnlyCalendarPreview()) await expirePendingBookingHolds();
  // Queries the appointments table after releasing any expired initial payment hold.
  const { data, error } = await supabaseAdmin
    .from('appointments')
    .select('date, time, duration_hours, status')
    .eq('status', 'SCHEDULED');
    
  if (error) {
    console.error('Error fetching appointments:', error);
    // Fallback: try old bookings table for backwards compatibility
    const { data: fallback, error: fallbackError } = await supabaseAdmin
      .from('bookings')
      .select('booking_date, booking_time, status')
      .in('status', ['PENDING', 'PAID', 'CONFIRMED']);
    if (fallbackError) {
      console.error('Error fetching legacy bookings:', fallbackError);
      throw new Error('Could not check booking availability.');
    }
    return (fallback || []).map(b => ({ 
      date: b.booking_date, 
      time: b.booking_time, 
      duration_hours: 2, 
      status: b.status 
    }));
  }
  return data || [];
}

async function loadBlockedDates() {
  const { data, error } = await supabaseAdmin
    .from('blocked_dates')
    .select('date, start_time, end_time, reason');
    
  if (error) {
    console.error('Error fetching blocked dates:', error);
    throw new Error('Could not check blocked dates.');
  }
  return data || [];
}

async function loadOpenHours() {
  const { data, error } = await supabaseAdmin
    .from('studio_settings')
    .select('value')
    .eq('key', 'open_hours')
    .maybeSingle();
    
  if (error) {
    console.error('Error fetching studio opening hours:', error);
    throw new Error('Could not check studio opening hours.');
  }
  if (!data) {
    return DEFAULT_WEEKLY_HOURS;
  }
  return normalizeWeeklyHours(data.value);
}

export async function getBookingAvailability() {
  const [slots, blocked, hours] = await Promise.all([
    loadBookedSlots(),
    loadBlockedDates(),
    loadOpenHours(),
  ]);

  return { slots, blocked, hours };
}

export async function createBooking(bookingData: BookingInput) {
  if (isReadOnlyCalendarPreview()) {
    throw new Error('Booking submissions are disabled in the local calendar preview.');
  }
  await expirePendingBookingHolds();
  const quote = bookingQuote(bookingData.type, bookingData.size);
  if (!quote) throw new Error('Choose a valid tattoo size or consultation option.');
  if (!bookingData.name.trim() || !bookingData.email.trim() || !bookingData.whatsapp.trim() || !bookingData.placement.trim()) {
    throw new Error('Complete your name, email, WhatsApp number, and placement before booking.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bookingData.email.trim())) {
    throw new Error('Enter a valid email address.');
  }
  if (bookingData.name.trim().length > 120 || bookingData.placement.trim().length > 240 || (bookingData.description || '').length > 2_000) {
    throw new Error('One or more booking details are too long.');
  }

  const isCustom = bookingData.type === 'custom';
  const stage = isCustom ? 'CONSULTATION_BOOKED' : 'SESSION_SCHEDULED';
  const requestedDuration = isCustom ? 1 : 2;

  const requestedDate = new Date(`${bookingData.date}T12:00:00`);
  if (Number.isNaN(requestedDate.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(bookingData.date) || requestedDate.toISOString().slice(0, 10) !== bookingData.date) {
    throw new Error('Choose a valid booking date.');
  }
  if (!/^\d{2}:\d{2}$/.test(bookingData.time)) {
    throw new Error('Choose a valid booking time.');
  }
  const [requestedHour, requestedMinute] = bookingData.time.split(':').map(Number);
  if (!Number.isInteger(requestedHour) || !Number.isInteger(requestedMinute) || requestedHour < 0 || requestedHour > 23 || requestedMinute < 0 || requestedMinute > 59) {
    throw new Error('Choose a valid booking time.');
  }
  const requestedStart = (requestedHour * 60) + requestedMinute;
  const requestedEnd = requestedStart + (requestedDuration * 60);
  const studioNow = getStudioDateTime();
  if (bookingData.date < studioNow.date || (bookingData.date === studioNow.date && requestedStart <= studioNow.minutes)) {
    throw new Error('Choose a future booking date and time in Bali.');
  }

  const [{ data: openHoursSetting }, { data: dateBlocks, error: blocksError }] = await Promise.all([
    supabaseAdmin.from('studio_settings').select('value').eq('key', 'open_hours').maybeSingle(),
    supabaseAdmin.from('blocked_dates').select('start_time, end_time').eq('date', bookingData.date),
  ]);
  if (blocksError) throw new Error('Could not check studio availability.');
  const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][requestedDate.getDay()] as keyof ReturnType<typeof normalizeWeeklyHours>;
  const hours = normalizeWeeklyHours(openHoursSetting?.value)[dayKey];
  const toMinutes = (time: string) => {
    const [hoursText, minutesText] = time.split(':').map(Number);
    return (hoursText * 60) + (minutesText || 0);
  };
  if (!hours.open || requestedStart < toMinutes(hours.start) || requestedEnd > toMinutes(hours.end)) {
    throw new Error('Choose a time within the studio opening hours.');
  }
  const overlaps = (start: number, end: number) => requestedStart < end && requestedEnd > start;
  if ((dateBlocks || []).some((block) => !block.start_time || !block.end_time || overlaps(toMinutes(block.start_time), toMinutes(block.end_time)))) {
    throw new Error('That date or time is unavailable. Choose another slot.');
  }

  const { data: scheduledAppointments, error: availabilityError } = await supabaseAdmin
    .from('appointments')
    .select('time, duration_hours')
    .eq('date', bookingData.date)
    .eq('status', 'SCHEDULED');
  if (availabilityError) throw new Error('Could not check studio availability.');

  const overlapsExisting = (scheduledAppointments || []).some((appointment) => {
    const [hour, minute] = appointment.time.split(':').map(Number);
    const start = (hour * 60) + (minute || 0);
    const end = start + (Number(appointment.duration_hours || 1) * 60);
    return requestedStart < end && requestedEnd > start;
  });
  if (overlapsExisting) throw new Error('That time was just booked. Please choose another available time.');

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .insert([
      {
        name: bookingData.name,
        email: bookingData.email,
        whatsapp: bookingData.whatsapp,
        booking_date: bookingData.date,
        booking_time: bookingData.time,
        session_type: bookingData.type,
        placement: bookingData.placement || 'TBD',
        description: bookingData.description || '',
        price: quote.total,
        deposit: quote.deposit,
        status: 'PENDING',
        stage: stage,
        payment_link: null,
        design_url: bookingData.design_url || null,
        placement_url: bookingData.placement_url || null,
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating booking:', error);
    throw new Error(error.message);
  }

  // Auto-create appointment to block the calendar slot
  const appointmentType = isCustom ? 'consultation' : 'tattoo_session';
  const defaultDuration = requestedDuration; // consultation = 1hr, flash tattoo = 2hr

  const { error: apptError } = await supabaseAdmin
    .from('appointments')
    .insert([
      {
        booking_id: data.id,
        type: appointmentType,
        date: bookingData.date,
        time: bookingData.time,
        duration_hours: defaultDuration,
        status: 'SCHEDULED',
        notes: isCustom ? 'Initial consultation' : 'Flash tattoo session',
      }
    ]);

  if (apptError) {
    await supabaseAdmin.from('bookings').delete().eq('id', data.id).eq('status', 'PENDING');
    throw new Error('Could not reserve that appointment time. Please choose another slot.');
  }

  return data;
}
