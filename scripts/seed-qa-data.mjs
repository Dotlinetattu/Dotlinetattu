import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USER_EMAIL = 'qa.owner@example.com';
const USER_PHONE = '+6281234567890';
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

const tattooImages = [
  '/assets/Gallery/dotlinetattu_handpoke_tattoo_bali-klrlhsspxtuwbozl-2c4Ad1N23eO5zoWg.jpg',
  '/assets/Gallery/handpoke-tattoo-bali-dotlinetattu-10-r2el8hh0jzntmivg-YGG71UVQu8hnYG1f.jpg',
  '/assets/Gallery/handpoke-tattoo-bali-dotlinetattu-17-JRkSSHut1wMPg4J1.webp',
  '/assets/Gallery/handpoke-tattoo-bali-dotlinetattu-20-6B7LEVxri2IpWP3F.webp',
  '/assets/Gallery/handpoke-tattoo-bali-dotlinetattu-21-yaHHOuqmCsS0hG1g.webp',
  '/assets/Gallery/handpoke-tattoo-bali-dotlinetattu-22-BUN8FOAbCUzf2GaG.webp',
  '/assets/Gallery/handpoke-tattoo-bali-dotlinetattu-11-boq69p6nyskdz2kd-XUPXBaXpD0GuXd67.jpg',
  '/assets/Gallery/handpoke_tattoo_bali_dotlinetattu-2-iT9eQaZa9y0LQ6RN.webp',
];

const placementImages = [
  '/assets/qa/placement-forearm.png',
  '/assets/qa/placement-shoulder.png',
  '/assets/qa/placement-calf.png',
];

function localDate(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function countRows(table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) throw new Error(`Could not count ${table}: ${error.message}`);
  return count || 0;
}

async function deleteAll(table) {
  const { error } = await supabase.from(table).delete().neq('id', ZERO_UUID);
  if (error) throw new Error(`Could not clear ${table}: ${error.message}`);
}

function booking(index, values) {
  return {
    id: randomUUID(),
    name: values.name,
    email: values.email || `qa.client${index + 1}@example.com`,
    whatsapp: values.whatsapp || `+61400000${String(index + 1).padStart(3, '0')}`,
    booking_date: values.booking_date,
    booking_time: values.booking_time,
    session_type: values.session_type,
    placement: values.placement,
    description: values.description,
    price: values.price,
    deposit: values.deposit,
    status: values.status,
    stage: values.stage,
    admin_status: values.admin_status,
    payment_link: values.payment_link || null,
    design_url: tattooImages[index % tattooImages.length],
    placement_url: placementImages[index % placementImages.length],
    created_at: new Date(Date.now() - ((index + 1) * 86400000)).toISOString(),
  };
}

const bookings = [
  booking(0, {
    name: 'Bintang Aprilian · QA owner', email: USER_EMAIL, whatsapp: USER_PHONE,
    booking_date: localDate(4), booking_time: '10:00:00', session_type: 'custom', placement: 'Inner forearm',
    description: 'Fine-line Balinese botanical composition with a small temple-flower detail. Needs consultation before final sizing.',
    price: 3500000, deposit: 350000, status: 'PENDING', stage: 'CONSULTATION_BOOKED', admin_status: 'ACTIVE',
  }),
  booking(1, {
    name: 'Maya Thompson', booking_date: localDate(2), booking_time: '11:00:00', session_type: 'custom', placement: 'Right shoulder blade',
    description: 'Custom ornamental sun motif, approximately 14 cm. Client wants to compare two line-weight options.',
    price: 4800000, deposit: 500000, status: 'PENDING', stage: 'CONSULTATION_BOOKED', admin_status: 'ACTIVE',
    payment_link: 'https://example.com/qa/payment/pending-consultation',
  }),
  booking(2, {
    name: 'Liam O’Connor', booking_date: localDate(5), booking_time: '13:00:00', session_type: 'flash', placement: 'Outer calf',
    description: 'Selected handpoke tiger flash, 11 cm, black ink. Deposit received and tattoo session confirmed.',
    price: 2500000, deposit: 1250000, status: 'PAID', stage: 'SESSION_SCHEDULED', admin_status: 'ACTIVE',
  }),
  booking(3, {
    name: 'Ayu Maharani', email: USER_EMAIL, whatsapp: USER_PHONE,
    booking_date: localDate(7), booking_time: '15:00:00', session_type: 'custom', placement: 'Upper back',
    description: 'Symmetrical sacred-geometry piece. Initial consultation complete; design review is the next meeting.',
    price: 6500000, deposit: 650000, status: 'PENDING', stage: 'DESIGN_REVIEW', admin_status: 'ACTIVE',
  }),
  booking(4, {
    name: 'Noah Williams', booking_date: localDate(-3), booking_time: '10:00:00', session_type: 'flash', placement: 'Left forearm',
    description: 'Small botanical flash. Previous appointment was cancelled; client has not selected a replacement date.',
    price: 1750000, deposit: 875000, status: 'CANCELLED', stage: 'CANCELLED', admin_status: 'ACTIVE',
  }),
  booking(5, {
    name: 'Sofia Rossi', booking_date: localDate(-14), booking_time: '12:00:00', session_type: 'custom', placement: 'Shoulder blade',
    description: 'Completed ornamental handpoke session. Healing check completed with no touch-up required.',
    price: 5200000, deposit: 1000000, status: 'PAID', stage: 'COMPLETED', admin_status: 'COMPLETED',
  }),
  booking(6, {
    name: 'Daniel Kim', booking_date: localDate(-8), booking_time: '14:00:00', session_type: 'custom', placement: 'Outer calf',
    description: 'Large custom piece cancelled before design work began. Payment request was cancelled as well.',
    price: 7500000, deposit: 750000, status: 'CANCELLED', stage: 'CANCELLED', admin_status: 'CANCELLED',
  }),
  booking(7, {
    name: 'Emma Laurent', booking_date: localDate(9), booking_time: '16:00:00', session_type: 'flash', placement: 'Inner forearm',
    description: 'Tattoo session completed; short follow-up appointment scheduled to assess one fine-line section.',
    price: 2250000, deposit: 1125000, status: 'PAID', stage: 'SESSION_SCHEDULED', admin_status: 'ACTIVE',
  }),
];

const byName = Object.fromEntries(bookings.map((item) => [item.name, item.id]));

const appointments = [
  { booking_id: byName['Maya Thompson'], type: 'consultation', date: localDate(2), time: '11:00:00', duration_hours: 1, status: 'SCHEDULED', notes: 'First consultation: concept, placement, size, and budget.' },
  { booking_id: byName['Liam O’Connor'], type: 'tattoo_session', date: localDate(5), time: '13:00:00', duration_hours: 3, status: 'SCHEDULED', notes: 'Confirmed flash tattoo session; deposit paid.' },
  { booking_id: byName['Ayu Maharani'], type: 'consultation', date: localDate(-4), time: '10:00:00', duration_hours: 1, status: 'COMPLETED', notes: 'Initial concept and placement approved.' },
  { booking_id: byName['Ayu Maharani'], type: 'design_review', date: localDate(7), time: '15:00:00', duration_hours: 1, status: 'SCHEDULED', notes: 'Review two stencil variations and confirm line weight.' },
  { booking_id: byName['Noah Williams'], type: 'consultation', date: localDate(-3), time: '10:00:00', duration_hours: 1, status: 'CANCELLED', notes: 'Client cancelled through WhatsApp.' },
  { booking_id: byName['Sofia Rossi'], type: 'tattoo_session', date: localDate(-14), time: '12:00:00', duration_hours: 4, status: 'COMPLETED', notes: 'Tattoo completed successfully.' },
  { booking_id: byName['Daniel Kim'], type: 'design_review', date: localDate(-8), time: '14:00:00', duration_hours: 1, status: 'CANCELLED', notes: 'Project cancelled before design review.' },
  { booking_id: byName['Emma Laurent'], type: 'tattoo_session', date: localDate(-7), time: '12:00:00', duration_hours: 3, status: 'COMPLETED', notes: 'Tattoo session completed.' },
  { booking_id: byName['Emma Laurent'], type: 'design_review', date: localDate(9), time: '16:00:00', duration_hours: 0.5, status: 'SCHEDULED', notes: 'Healing and fine-line follow-up check.' },
];

function payment(bookingId, index, values) {
  return {
    booking_id: bookingId,
    description: values.description,
    amount: values.amount,
    status: values.status,
    source: values.source || 'ADMIN_REQUEST',
    midtrans_order_id: `QA-${values.status}-${Date.now()}-${index}`,
    payment_link: values.payment_link || `https://example.com/qa/payment/${values.status.toLowerCase()}-${index}`,
    paid_at: values.status === 'PAID' ? new Date(Date.now() - (index * 86400000)).toISOString() : null,
  };
}

const payments = [
  payment(byName['Maya Thompson'], 1, { description: 'Initial consultation deposit', amount: 500000, status: 'PENDING', source: 'INITIAL_BOOKING' }),
  payment(byName['Liam O’Connor'], 2, { description: 'Flash tattoo deposit', amount: 1250000, status: 'PAID', source: 'INITIAL_BOOKING' }),
  payment(byName['Ayu Maharani'], 3, { description: 'Design preparation deposit', amount: 650000, status: 'EXPIRED' }),
  payment(byName['Noah Williams'], 4, { description: 'Flash tattoo deposit', amount: 875000, status: 'FAILED', source: 'INITIAL_BOOKING' }),
  payment(byName['Sofia Rossi'], 5, { description: 'Tattoo session balance', amount: 4200000, status: 'PAID' }),
  payment(byName['Daniel Kim'], 6, { description: 'Custom tattoo deposit', amount: 750000, status: 'CANCELLED', source: 'INITIAL_BOOKING' }),
  payment(byName['Emma Laurent'], 7, { description: 'Flash tattoo deposit', amount: 1125000, status: 'PAID', source: 'INITIAL_BOOKING' }),
  payment(byName['Bintang Aprilian · QA owner'], 8, { description: 'Consultation reservation', amount: 150000, status: 'PENDING' }),
];

const weeklyHours = {
  sunday: { open: false, start: '10:00', end: '18:00' },
  monday: { open: true, start: '10:00', end: '18:00' },
  tuesday: { open: true, start: '10:00', end: '18:00' },
  wednesday: { open: true, start: '12:00', end: '20:00' },
  thursday: { open: true, start: '10:00', end: '18:00' },
  friday: { open: true, start: '10:00', end: '19:00' },
  saturday: { open: true, start: '11:00', end: '17:00' },
};

const before = Object.fromEntries(await Promise.all(
  ['bookings', 'appointments', 'payments', 'blocked_dates'].map(async (table) => [table, await countRows(table)]),
));

await deleteAll('payments');
await deleteAll('appointments');
await deleteAll('bookings');
await deleteAll('blocked_dates');

const { error: bookingsError } = await supabase.from('bookings').insert(bookings);
if (bookingsError) throw new Error(`Could not seed bookings: ${bookingsError.message}`);

const { error: appointmentsError } = await supabase.from('appointments').insert(appointments);
if (appointmentsError) throw new Error(`Could not seed appointments: ${appointmentsError.message}`);

const { error: paymentsError } = await supabase.from('payments').insert(payments);
if (paymentsError) throw new Error(`Could not seed payments: ${paymentsError.message}`);

const blockedDates = [
  { date: localDate(12), start_time: null, end_time: null, reason: 'QA full-day holiday example' },
  { date: localDate(15), start_time: '13:00', end_time: '15:00', reason: 'QA private studio break example' },
];
const { error: blocksError } = await supabase.from('blocked_dates').insert(blockedDates);
if (blocksError) throw new Error(`Could not seed blocked dates: ${blocksError.message}`);

const { error: settingsError } = await supabase
  .from('studio_settings')
  .upsert({ key: 'open_hours', value: weeklyHours }, { onConflict: 'key' });
if (settingsError) throw new Error(`Could not seed weekly hours: ${settingsError.message}`);

const after = Object.fromEntries(await Promise.all(
  ['bookings', 'appointments', 'payments', 'blocked_dates'].map(async (table) => [table, await countRows(table)]),
));

const { data: appointmentRows, error: appointmentReadError } = await supabase
  .from('appointments')
  .select('type,status');
if (appointmentReadError) throw new Error(appointmentReadError.message);

const { data: paymentRows, error: paymentReadError } = await supabase
  .from('payments')
  .select('status');
if (paymentReadError) throw new Error(paymentReadError.message);

console.log(JSON.stringify({
  before,
  after,
  coverage: {
    adminStatuses: [...new Set(bookings.map((item) => item.admin_status))].sort(),
    bookingStatuses: [...new Set(bookings.map((item) => item.status))].sort(),
    appointmentTypes: [...new Set(appointmentRows.map((item) => item.type))].sort(),
    appointmentStatuses: [...new Set(appointmentRows.map((item) => item.status))].sort(),
    paymentStatuses: [...new Set(paymentRows.map((item) => item.status))].sort(),
    imagePairs: bookings.filter((item) => item.design_url && item.placement_url).length,
    userContactRecords: bookings.filter((item) => item.email === USER_EMAIL && item.whatsapp === USER_PHONE).length,
  },
}, null, 2));
