"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getBookingAvailability, createBooking } from "@/app/actions/bookingActions";
import { createInitialPaymentRequest } from "@/app/actions/paymentActions";
import ZoomableImage from "@/components/ui/ZoomableImage";
import { bookingSlotsForDay, DEFAULT_WEEKLY_HOURS, getStudioDateTime, timeToMinutes, WEEK_DAYS, type WeeklyHours } from "@/lib/studio-hours";
import { CUSTOM_DEPOSIT_PERCENT, FLASH_DEPOSIT_PERCENT, SERVICE_PRICES, calculateDeposit } from "@/lib/pricing";

type FlowType = "flash" | "custom";
type Step = "warning" | "form" | "calendar" | "checkout" | "success";
type AvailabilityState = "loading" | "ready" | "error";
type CalendarDayStatus = "checking" | "error" | "past" | "closed" | "blocked" | "fully-booked" | "unavailable" | "no-slots" | "limited" | "available";

type ScheduledAppointment = {
  date: string;
  time: string;
  duration_hours?: number | null;
  status?: string;
};

type BlockedDate = {
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  reason?: string | null;
};

type CalendarSlotAvailability = {
  time: string;
  booked: boolean;
  blocked: boolean;
  blockReason: string | null;
};

function getCalendarSlots(
  date: string,
  hours: WeeklyHours[keyof WeeklyHours],
  durationHours: number,
  appointments: ScheduledAppointment[],
  blocks: BlockedDate[],
  studioDate: string,
  studioMinutes: number,
): CalendarSlotAvailability[] {
  if (!hours.open) return [];

  const dayAppointments = appointments.filter((appointment) => appointment.date === date);
  const dayBlocks = blocks.filter((block) => block.date === date);
  const closingMinute = timeToMinutes(hours.end);

  return bookingSlotsForDay(hours)
    .filter((time) => timeToMinutes(time) + durationHours * 60 <= closingMinute)
    .filter((time) => date !== studioDate || timeToMinutes(time) > studioMinutes)
    .map((time) => {
      const slotStart = timeToMinutes(time);
      const slotEnd = slotStart + durationHours * 60;
      const booked = dayAppointments.some((appointment) => {
        const appointmentStart = timeToMinutes(appointment.time);
        const appointmentEnd = appointmentStart + (Number(appointment.duration_hours || 1) * 60);
        return slotStart < appointmentEnd && slotEnd > appointmentStart;
      });
      const block = dayBlocks.find((item) => {
        if (!item.start_time || !item.end_time) return true;
        return slotStart < timeToMinutes(item.end_time) && slotEnd > timeToMinutes(item.start_time);
      });

      return {
        time,
        booked,
        blocked: Boolean(block),
        blockReason: block?.reason || null,
      };
    });
}

const STORAGE_KEY = "dotlinetattu_booking_draft";

const CALENDAR_DAY_STYLES: Record<CalendarDayStatus, string> = {
  checking: "border-border/70 bg-primary text-secondary/50",
  error: "border-border/70 bg-primary text-secondary/50",
  past: "border-border/40 bg-primary/70 text-secondary/70 opacity-40",
  closed: "border-border/60 bg-surface/70 text-secondary/45",
  blocked: "border-border/60 bg-surface/70 text-secondary/45",
  "fully-booked": "border-accent/30 bg-accent/5 text-secondary/60",
  unavailable: "border-border/60 bg-surface/70 text-secondary/45",
  "no-slots": "border-border/60 bg-surface/70 text-secondary/45",
  limited: "border-accent/50 bg-accent/10 text-primary hover:border-accent hover:bg-accent/20",
  available: "border-border bg-primary text-primary hover:border-accent hover:bg-accent/10",
};

const COUNTRY_CALLING_CODES = [
  { code: "+62", country: "Indonesia", flag: "🇮🇩" },
  { code: "+61", country: "Australia", flag: "🇦🇺" },
  { code: "+65", country: "Singapore", flag: "🇸🇬" },
  { code: "+60", country: "Malaysia", flag: "🇲🇾" },
  { code: "+1", country: "United States & Canada", flag: "🇺🇸" },
  { code: "+44", country: "United Kingdom", flag: "🇬🇧" },
  { code: "+91", country: "India", flag: "🇮🇳" },
  { code: "+81", country: "Japan", flag: "🇯🇵" },
  { code: "+82", country: "South Korea", flag: "🇰🇷" },
  { code: "+86", country: "China", flag: "🇨🇳" },
  { code: "+64", country: "New Zealand", flag: "🇳🇿" },
  { code: "+66", country: "Thailand", flag: "🇹🇭" },
  { code: "+63", country: "Philippines", flag: "🇵🇭" },
  { code: "+84", country: "Vietnam", flag: "🇻🇳" },
  { code: "+852", country: "Hong Kong", flag: "🇭🇰" },
  { code: "+886", country: "Taiwan", flag: "🇹🇼" },
  { code: "+971", country: "United Arab Emirates", flag: "🇦🇪" },
  { code: "+966", country: "Saudi Arabia", flag: "🇸🇦" },
  { code: "+27", country: "South Africa", flag: "🇿🇦" },
  { code: "+31", country: "Netherlands", flag: "🇳🇱" },
  { code: "+32", country: "Belgium", flag: "🇧🇪" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+34", country: "Spain", flag: "🇪🇸" },
  { code: "+39", country: "Italy", flag: "🇮🇹" },
  { code: "+41", country: "Switzerland", flag: "🇨🇭" },
  { code: "+43", country: "Austria", flag: "🇦🇹" },
  { code: "+45", country: "Denmark", flag: "🇩🇰" },
  { code: "+46", country: "Sweden", flag: "🇸🇪" },
  { code: "+47", country: "Norway", flag: "🇳🇴" },
  { code: "+48", country: "Poland", flag: "🇵🇱" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+52", country: "Mexico", flag: "🇲🇽" },
  { code: "+54", country: "Argentina", flag: "🇦🇷" },
  { code: "+55", country: "Brazil", flag: "🇧🇷" },
  { code: "+56", country: "Chile", flag: "🇨🇱" },
  { code: "+57", country: "Colombia", flag: "🇨🇴" },
  { code: "+351", country: "Portugal", flag: "🇵🇹" },
  { code: "+353", country: "Ireland", flag: "🇮🇪" },
  { code: "+358", country: "Finland", flag: "🇫🇮" },
  { code: "+380", country: "Ukraine", flag: "🇺🇦" },
  { code: "+972", country: "Israel", flag: "🇮🇱" },
] as const;

function splitPhoneNumber(value: string) {
  const matchedCode = [...COUNTRY_CALLING_CODES]
    .sort((a, b) => b.code.length - a.code.length)
    .find(({ code }) => value.startsWith(code));

  return matchedCode
    ? { countryCode: matchedCode.code, localNumber: value.slice(matchedCode.code.length).trim() }
    : { countryCode: "+62", localNumber: value };
}

interface BookingEngineProps {
  initialType: FlowType;
}

export default function BookingEngine({ initialType }: BookingEngineProps) {
  const now = new Date();
  const studioNow = getStudioDateTime(now);
  const isReadOnlyCalendarPreview = process.env.NODE_ENV === "development"
    && process.env.NEXT_PUBLIC_BOOKING_CALENDAR_PREVIEW === "true";
  const studioWhatsapp = (process.env.NEXT_PUBLIC_STUDIO_WHATSAPP || '').replace(/[^0-9]/g, '');
  const whatsappUrl = (message: string) => `https://wa.me/${studioWhatsapp}?text=${encodeURIComponent(message)}`;

  // All state starts with defaults — localStorage will hydrate them after mount
  const [hydrated, setHydrated] = useState(false);
  const [type, setType] = useState<FlowType>(initialType);
  const [step, setStep] = useState<Step>(initialType === "flash" ? "warning" : "form");
  const [isLoading, setIsLoading] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<ScheduledAppointment[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [openHours, setOpenHours] = useState<WeeklyHours>(DEFAULT_WEEKLY_HOURS);
  const [availabilityState, setAvailabilityState] = useState<AvailabilityState>("loading");
  const [availabilityRetry, setAvailabilityRetry] = useState(0);
  const [bookingId, setBookingId] = useState<string>("");
  const [countryCode, setCountryCode] = useState("+62");
  const [countryQuery, setCountryQuery] = useState("");
  const checkoutInProgress = useRef(false);
  const paymentProvider = 'PAYPAL' as const;

  const [calMonth, setCalMonth] = useState<number>(Number(studioNow.date.slice(5, 7)) - 1);
  const [calYear, setCalYear] = useState<number>(Number(studioNow.date.slice(0, 4)));

  // Keep the availability UI fail-closed: users must not choose a date until
  // bookings, blocked periods, and studio hours have been checked.
  useEffect(() => {
    let active = true;
    let isFetching = false;

    async function fetchSlots() {
      if (isFetching) return;
      isFetching = true;

      try {
        const { slots, blocked, hours } = await getBookingAvailability();
        if (!active) return;
        setBookedSlots(slots);
        setBlockedDates(blocked);
        setOpenHours(hours);
        setAvailabilityState("ready");
      } catch (error) {
        if (!active) return;
        console.error("Could not load booking availability:", error);
        setAvailabilityState("error");
      } finally {
        isFetching = false;
      }
    }

    void fetchSlots();
    const refreshInterval = window.setInterval(() => void fetchSlots(), 60_000);
    return () => {
      active = false;
      window.clearInterval(refreshInterval);
    };
  }, [availabilityRetry]);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    whatsapp: "",
    placementText: "",
    placementImage: null as File | null,
    size: "medium",
    referenceImage: null as File | null,
  });

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");

  // HYDRATE from localStorage after mount (runs only in browser, after SSR)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.type) setType(draft.type);
        if (draft.step) setStep(draft.step);
        if (draft.calMonth != null) setCalMonth(draft.calMonth);
        if (draft.calYear != null) setCalYear(draft.calYear);
        if (typeof draft.selectedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(draft.selectedDate)) setSelectedDate(draft.selectedDate);
        if (typeof draft.selectedTime === "string" && /^\d{2}:\d{2}$/.test(draft.selectedTime)) setSelectedTime(draft.selectedTime);
        if (draft.form) {
          const savedPhone = splitPhoneNumber(draft.form.whatsapp ?? "");
          setCountryCode(savedPhone.countryCode);
          setFormData(prev => ({
            ...prev,
            name: draft.form.name ?? "",
            email: draft.form.email ?? "",
            whatsapp: savedPhone.localNumber,
            placementText: draft.form.placementText ?? "",
            size: draft.form.size ?? "medium",
          }));
        }
      }
    } catch {}
    setHydrated(true);
  }, []); // runs once on mount

  // PERSIST to localStorage on every state change (after hydration)
  useEffect(() => {
    if (!hydrated) return; // don't overwrite with empty values before hydration
    if (step === "success") {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const draft = {
      type, step, calMonth, calYear, selectedDate, selectedTime,
      form: {
        name: formData.name,
        email: formData.email,
        whatsapp: `${countryCode}${formData.whatsapp.replace(/\D/g, '').replace(/^0/, '')}`,
        placementText: formData.placementText,
        size: formData.size,
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [hydrated, type, step, calMonth, calYear, selectedDate, selectedTime, formData, countryCode]);



  // Sync default size when type changes
  useEffect(() => {
    if (type === "custom" && ["small", "medium", "large"].includes(formData.size)) {
      setFormData(prev => ({ ...prev, size: "passing" }));
    } else if (type === "flash" && !["small", "medium", "large"].includes(formData.size)) {
      setFormData(prev => ({ ...prev, size: "medium" }));
    }
  }, [type]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: "placementImage" | "referenceImage") => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, [fieldName]: e.target.files[0] });
    }
  };

  const isEmailFormatValid = formData.email === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
  const localWhatsappDigits = formData.whatsapp.replace(/\D/g, '').replace(/^0/, '');
  const whatsappDigits = `${countryCode}${localWhatsappDigits}`.replace(/\D/g, '');
  const isWhatsappFormatValid = formData.whatsapp === "" || (whatsappDigits.length >= 8 && whatsappDigits.length <= 15);

  const isFormValid = 
    formData.name.trim().length >= 2 && 
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) && 
    whatsappDigits.length >= 8 && whatsappDigits.length <= 15 &&
    formData.placementText.trim().length >= 2 && 
    (isReadOnlyCalendarPreview || (formData.placementImage !== null && formData.referenceImage !== null));

  // Pricing Logic
  const calculatePrice = () => {
    if (type === "flash") {
      if (formData.size === "small") return { total: SERVICE_PRICES.flash.small, deposit: calculateDeposit(SERVICE_PRICES.flash.small, FLASH_DEPOSIT_PERCENT), depositPercent: `${FLASH_DEPOSIT_PERCENT}%` };
      if (formData.size === "medium") return { total: SERVICE_PRICES.flash.medium, deposit: calculateDeposit(SERVICE_PRICES.flash.medium, FLASH_DEPOSIT_PERCENT), depositPercent: `${FLASH_DEPOSIT_PERCENT}%` };
      if (formData.size === "large") return { total: SERVICE_PRICES.flash.large, deposit: calculateDeposit(SERVICE_PRICES.flash.large, FLASH_DEPOSIT_PERCENT), depositPercent: `${FLASH_DEPOSIT_PERCENT}%` };
    } else {
      // Custom session pricing
      if (formData.size === "passing") return { total: SERVICE_PRICES.custom.passing, deposit: calculateDeposit(SERVICE_PRICES.custom.passing, CUSTOM_DEPOSIT_PERCENT), depositPercent: `${CUSTOM_DEPOSIT_PERCENT}%` };
      if (formData.size === "beginning") return { total: SERVICE_PRICES.custom.beginning, deposit: calculateDeposit(SERVICE_PRICES.custom.beginning, CUSTOM_DEPOSIT_PERCENT), depositPercent: `${CUSTOM_DEPOSIT_PERCENT}%` };
      if (formData.size === "medium_session") return { total: SERVICE_PRICES.custom.medium_session, deposit: calculateDeposit(SERVICE_PRICES.custom.medium_session, CUSTOM_DEPOSIT_PERCENT), depositPercent: `${CUSTOM_DEPOSIT_PERCENT}%` };
      if (formData.size === "1day") return { total: SERVICE_PRICES.custom['1day'], deposit: calculateDeposit(SERVICE_PRICES.custom['1day'], CUSTOM_DEPOSIT_PERCENT), depositPercent: `${CUSTOM_DEPOSIT_PERCENT}%` };
      if (formData.size === "2days") return { total: SERVICE_PRICES.custom['2days'], deposit: calculateDeposit(SERVICE_PRICES.custom['2days'], CUSTOM_DEPOSIT_PERCENT), depositPercent: `${CUSTOM_DEPOSIT_PERCENT}%` };
    }
    return { total: 0, deposit: 0, depositPercent: "0%" };
  };

  const priceInfo = calculatePrice();
  const formattedBookingDate = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : selectedDate;
  const formattedBookingTime = selectedTime
    ? (() => {
        const [hourText, minuteText] = selectedTime.split(":");
        const hour = Number(hourText);
        if (Number.isNaN(hour)) return selectedTime;
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minuteText} ${hour >= 12 ? "PM" : "AM"}`;
      })()
    : selectedTime;
  const bookingDurationHours = type === "flash" ? 2 : 1;
  const selectedDateSlots = selectedDate
    ? getCalendarSlots(selectedDate, openHours[WEEK_DAYS[new Date(`${selectedDate}T00:00:00`).getDay()].key], bookingDurationHours, bookedSlots, blockedDates, studioNow.date, studioNow.minutes)
    : [];
  const selectedDateOpenSlots = selectedDateSlots.filter((slot) => !slot.booked && !slot.blocked);
  const selectedSlot = selectedDateSlots.find((slot) => slot.time === selectedTime);
  const canProceedToDeposit = availabilityState === "ready"
    && Boolean(selectedDate)
    && selectedDate >= studioNow.date
    && Boolean(selectedSlot)
    && !selectedSlot?.booked
    && !selectedSlot?.blocked;

  const daysInCalendarMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstWeekdayOfMonth = new Date(calYear, calMonth, 1).getDay();
  const calendarDays = Array.from({ length: daysInCalendarMonth }, (_, index) => {
    const day = index + 1;
    const date = new Date(calYear, calMonth, day);
    const dateString = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayHours = openHours[WEEK_DAYS[date.getDay()].key];
    const slots = getCalendarSlots(dateString, dayHours, bookingDurationHours, bookedSlots, blockedDates, studioNow.date, studioNow.minutes);
    const openSlots = slots.filter((slot) => !slot.booked && !slot.blocked).length;
    const bookedSlotCount = slots.filter((slot) => slot.booked).length;
    const blockedSlotCount = slots.filter((slot) => slot.blocked && !slot.booked).length;
    const hasFullDayBlock = blockedDates.some((block) => block.date === dateString && (!block.start_time || !block.end_time));
    const isPast = dateString < studioNow.date;

    let status: CalendarDayStatus;
    if (isPast) status = "past";
    else if (availabilityState === "loading") status = "checking";
    else if (availabilityState === "error") status = "error";
    else if (!dayHours.open) status = "closed";
    else if (hasFullDayBlock) status = "blocked";
    else if (slots.length === 0) status = "no-slots";
    else if (openSlots === 0 && bookedSlotCount > 0 && blockedSlotCount === 0) status = "fully-booked";
    else if (openSlots === 0) status = "unavailable";
    else if (bookedSlotCount > 0 || blockedSlotCount > 0) status = "limited";
    else status = "available";

    const shortStatus: Record<CalendarDayStatus, string> = {
      checking: "Checking",
      error: "Retry",
      past: "Past",
      closed: "Closed",
      blocked: "Blocked",
      "fully-booked": "Full",
      unavailable: "None",
      "no-slots": "No slots",
      limited: `${openSlots} left`,
      available: "Open",
    };
    const statusDescription: Record<CalendarDayStatus, string> = {
      checking: "availability is being checked",
      error: "availability could not be checked",
      past: "in the past",
      closed: "the studio is closed",
      blocked: "the studio is unavailable",
      "fully-booked": "all bookable times are already booked",
      unavailable: "no bookable times are available",
      "no-slots": `no ${bookingDurationHours}-hour start times fit this day`,
      limited: `${openSlots} of ${slots.length} start times are still available`,
      available: `all ${slots.length} start times are available`,
    };

    return {
      day,
      dateString,
      dateLabel: date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
      isToday: dateString === studioNow.date,
      openSlots,
      slots,
      status,
      shortStatus: shortStatus[status],
      statusDescription: status === "no-slots" && dateString === studioNow.date
        ? "no future booking times remain today"
        : statusDescription[status],
    };
  });
  const selectedDateStatus = calendarDays.find((date) => date.dateString === selectedDate)?.status;
  const isSelectedDateBookable = availabilityState === "ready" && (selectedDateStatus === "available" || selectedDateStatus === "limited");
  const openDateCount = calendarDays.filter((date) => date.status === "available" || date.status === "limited").length;
  const isCurrentMonth = calYear === Number(studioNow.date.slice(0, 4)) && calMonth === Number(studioNow.date.slice(5, 7)) - 1;
  const monthLabel = new Date(calYear, calMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const handleCheckout = async () => {
    if (isReadOnlyCalendarPreview) {
      alert('Read-only preview: booking, payments, and image uploads are disabled.');
      return;
    }
    if (checkoutInProgress.current) return;
    checkoutInProgress.current = true;
    setIsLoading(true);
    try {
      // Drafts from an older deployment can contain a display value such as
      // "10:00 AM" instead of the canonical HH:mm value used by the server.
      // Require a fresh calendar selection before uploading files or reserving a slot.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate) || !/^\d{2}:\d{2}$/.test(selectedTime)) {
        throw new Error('Choose an available booking date and time from the calendar before continuing.');
      }

      let designUrl = null;
      let placementUrl = null;

      // Upload Reference Image
      if (formData.referenceImage) {
        const uploadData = new FormData();
        uploadData.append('file', formData.referenceImage);
        const res = await fetch('/api/upload', { method: 'POST', body: uploadData });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.url) {
          throw new Error(json.error || 'Reference image upload failed. Please try again.');
        }
        designUrl = json.url;
      }

      // Upload Placement Image
      if (formData.placementImage) {
        const uploadData = new FormData();
        uploadData.append('file', formData.placementImage);
        const res = await fetch('/api/upload', { method: 'POST', body: uploadData });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.url) {
          throw new Error(json.error || 'Body placement photo upload failed. Please try again.');
        }
        placementUrl = json.url;
      }

      const result = await createBooking({
        name: formData.name,
        email: formData.email,
        whatsapp: `${countryCode}${localWhatsappDigits}`,
        placement: formData.placementText,
        description: "",
        date: selectedDate,
        time: selectedTime,
        type: type,
        size: formData.size,
        design_url: designUrl,
        placement_url: placementUrl
      });
      
      setBookingId(result.id);
      localStorage.removeItem(STORAGE_KEY); // clear draft on success

      const payment = await createInitialPaymentRequest(result.id, {
        description: type === 'custom' ? 'Initial consultation deposit' : 'Initial tattoo deposit',
        amount: priceInfo.deposit,
        provider: paymentProvider,
      });
      if ('error' in payment || !payment.redirect_url) throw new Error(payment.error || 'Could not create the secure payment link.');
      window.location.assign(payment.redirect_url);
    } catch (err) {
      checkoutInProgress.current = false;
      alert(err instanceof Error ? err.message : "Failed to create booking. Please try again.");
      console.error(err);
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-surface/50 border border-border rounded-lg overflow-hidden relative">
      
      {/* Type Selector (Only if not in success state) */}
      {step !== "success" && (
        <div className="flex border-b border-border">
          <button
            onClick={() => { setType("flash"); setStep("warning"); }}
            className={`flex-1 py-4 text-sm font-sans tracking-widest uppercase font-semibold transition-colors ${type === "flash" ? "bg-accent text-white" : "text-secondary hover:text-primary"}`}
          >
            Flash Tattoo
          </button>
          <button
            onClick={() => { setType("custom"); setStep("form"); }}
            className={`flex-1 py-4 text-sm font-sans tracking-widest uppercase font-semibold transition-colors ${type === "custom" ? "bg-accent text-white" : "text-secondary hover:text-primary"}`}
          >
            Custom Tattoo
          </button>
        </div>
      )}

      <div className="p-6 md:p-10">
        {/* STEP 1: WARNING (Flash Only) */}
        {step === "warning" && type === "flash" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 flex flex-col items-center text-center">

            {/* Minimal divider line instead of neon icon */}
            <div className="w-12 h-px bg-accent/60 mb-8" />

            <h2 className="font-heading text-3xl text-primary mb-4">Before You Continue</h2>
            <p className="text-secondary font-sans leading-relaxed mb-10 max-w-xl">
              Hand tapping is a raw, ancient technique — rooted in tradition, not precision machinery. 
              It carries its own character. Please read carefully before proceeding.
            </p>

            {/* Comparison — earthy, no neon */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px w-full max-w-4xl mb-10 text-left border border-border/50 bg-border/30">
              
              {/* CAN DO — with real photos */}
              <div className="bg-surface p-7">
                <p className="font-sans text-xs tracking-[0.2em] uppercase text-accent mb-5">Works well for</p>
                
                {/* Photo grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-6">
                  {[
                    "/assets/Gallery/handtapping-tattoo-bali-dotlinetattu-FuI3cCjPQQpIbAk2.webp",
                    "/assets/Gallery/handpoke-tattoo-bali-dotlinetattu-22-BUN8FOAbCUzf2GaG.webp",
                    "/assets/Gallery/handpoke-tattoo-bali-dotlinetattu-23-foY3o9o4aQcNgnE3.webp",
                    "/assets/Gallery/dotlinetattu_handpoke_bali-2-Rkt9nssE7W3zqbvl.webp",
                    "/assets/Gallery/handpoke-tattoo-bali-dotlinetattu-21-yaHHOuqmCsS0hG1g.webp",
                    "/assets/Gallery/handpoke_tattoo_bali_dotlinetattu-2-iT9eQaZa9y0LQ6RN.webp",
                  ].map((src, i) => (
                    <div key={i} className="aspect-square overflow-hidden relative group">
                      <ZoomableImage
                        src={src}
                        alt="Hand tapping tattoo example"
                        fill
                        sizes="(max-width: 768px) 33vw, 15vw"
                        className="object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-500"
                      />
                    </div>
                  ))}
                </div>

                <ul className="space-y-3 text-secondary font-sans text-sm leading-relaxed">
                  <li className="flex items-start gap-3">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-accent/70 shrink-0 block" />
                    Tribal & traditional patterns
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-accent/70 shrink-0 block" />
                    Bold, raw, organic linework
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-accent/70 shrink-0 block" />
                    Simple geometric shapes
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-accent/70 shrink-0 block" />
                    Ancient symbols and motifs
                  </li>
                </ul>
              </div>
              
              {/* CANNOT DO — no photos, illustrated with texture */}
              <div className="bg-[#0d0d0d] p-7 border-l border-border/40">
                <p className="font-sans text-xs tracking-[0.2em] uppercase text-[#7a6a5a] mb-5">Not suitable for</p>
                <div className="bg-accent/10 border border-accent/20 p-5 mb-6 rounded-sm relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent/50"></div>
                  <p className="text-accent/90 font-sans text-sm leading-relaxed italic relative z-10">
                    &ldquo;Modern design styles cannot be achieved with traditional hand tapping.&rdquo;
                  </p>
                </div>

                <ul className="space-y-3 text-secondary/60 font-sans text-sm leading-relaxed">
                  <li className="flex items-start gap-3">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#7a6a5a] shrink-0 block" />
                    Hyper-realistic portraits
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#7a6a5a] shrink-0 block" />
                    Fine-line or micro-realism
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#7a6a5a] shrink-0 block" />
                    Perfectly straight machine-like lines
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#7a6a5a] shrink-0 block" />
                    Overly intricate or crowded details
                  </li>
                </ul>
              </div>
            </div>

            <p className="text-secondary/40 font-sans text-xs leading-relaxed mb-8 max-w-lg italic">
              Designs above 20cm or with high complexity may require an offline consultation first.
            </p>
            <button 
              onClick={() => setStep("form")}
              className="px-10 py-4 bg-accent hover:bg-accent-hover text-white font-sans tracking-widest uppercase text-xs font-bold transition-all"
            >
              I Understand — Continue
            </button>
          </div>
        )}

        {/* STEP 2: FORM */}
        {step === "form" && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            {isReadOnlyCalendarPreview && (
              <p className="mb-5 border border-accent/40 bg-accent/5 px-4 py-3 text-sm leading-relaxed text-secondary" role="note">
                Read-only preview: enter sample details to test the calendar. Photos, bookings, and payments are disabled here.
              </p>
            )}
            <h2 className="font-heading text-3xl text-primary mb-6">
              {type === "flash" ? "Your Details" : "Tattoo Idea & Placement"}
            </h2>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-secondary font-sans text-xs tracking-widest uppercase mb-2">Full Name <span className="text-red-500">*</span></label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} className={`w-full bg-primary border px-4 py-3 text-primary focus:border-accent outline-none font-sans ${formData.name !== "" && formData.name.trim().length < 2 ? 'border-red-500/50' : 'border-border'}`} placeholder="John Doe" />
                  {formData.name !== "" && formData.name.trim().length < 2 && <p className="text-red-400/80 text-xs mt-1">Name is too short.</p>}
                </div>
                <div>
                  <label className="block text-secondary font-sans text-xs tracking-widest uppercase mb-2">WhatsApp Number <span className="text-red-500">*</span></label>
                  <div className={`grid grid-cols-[5rem_minmax(0,1fr)] overflow-hidden border bg-primary transition-colors focus-within:border-accent sm:grid-cols-[6rem_minmax(0,1fr)] ${!isWhatsappFormatValid ? 'border-red-500/50' : 'border-border'}`}>
                    <label className="sr-only" htmlFor="country-code">Country / region calling code</label>
                    <input
                      id="country-code"
                      value={countryQuery || countryCode}
                      onFocus={() => setCountryQuery("")}
                      onChange={(event) => {
                        const value = event.target.value;
                        const match = COUNTRY_CALLING_CODES.find(({ code }) => code === value);
                        setCountryQuery(match ? "" : value);
                        if (match) setCountryCode(match.code);
                      }}
                      list="country-code-options"
                      inputMode="search"
                      autoComplete="tel-country-code"
                      className="min-h-14 w-full border-r border-border bg-surface px-3 text-sm text-primary outline-none focus:bg-surface/80 sm:px-4"
                      aria-label="Search country or region calling code"
                      placeholder="Search country or +62"
                    />
                    <datalist id="country-code-options">
                      {COUNTRY_CALLING_CODES.map(({ code, country, flag }) => (
                        <option key={`${country}-${code}`} value={code} label={`${flag} ${country}`} />
                      ))}
                    </datalist>
                    <label className="sr-only" htmlFor="whatsapp-number">WhatsApp number without country code</label>
                    <input
                      id="whatsapp-number"
                      type="tel"
                      name="whatsapp"
                      value={formData.whatsapp}
                      onChange={handleInputChange}
                      inputMode="tel"
                      autoComplete="tel-national"
                      className="min-h-14 w-full bg-primary px-4 text-primary outline-none placeholder:text-secondary/50"
                      placeholder="812 3456 7890"
                    />
                  </div>
                  {!isWhatsappFormatValid && <p className="text-red-400/80 text-xs mt-1">Enter a valid phone number (8–15 digits including the country code).</p>}
                </div>
              </div>
              
              <div>
                <label className="block text-secondary font-sans text-xs tracking-widest uppercase mb-2">Email Address <span className="text-red-500">*</span></label>
                <input type="email" name="email" value={formData.email} onChange={handleInputChange} className={`w-full bg-primary border px-4 py-3 text-primary focus:border-accent outline-none font-sans ${!isEmailFormatValid ? 'border-red-500/50' : 'border-border'}`} placeholder="john@example.com" />
                {!isEmailFormatValid && <p className="text-red-400/80 text-xs mt-1">Enter a valid email address.</p>}
              </div>

              <div className="flex flex-col gap-8">
                <div>
                  <label className="block text-secondary font-sans text-xs tracking-widest uppercase mb-2">Body Placement Area <span className="text-red-500">*</span></label>
                  <input type="text" name="placementText" value={formData.placementText} onChange={handleInputChange} className={`w-full bg-primary border px-4 py-3 text-primary focus:border-accent outline-none font-sans ${formData.placementText !== "" && formData.placementText.trim().length < 2 ? 'border-red-500/50' : 'border-border'}`} placeholder="e.g. Left Forearm" />
                  {formData.placementText !== "" && formData.placementText.trim().length < 2 && <p className="text-red-400/80 text-xs mt-1">Please specify the placement area.</p>}
                </div>

                <div>
                  <label className="block text-secondary font-sans text-xs tracking-widest uppercase mb-2">
                    {type === "flash" ? "Approximate Size" : "Session Duration"} <span className="text-red-500">*</span>
                  </label>
                  
                  {type === "flash" ? (
                    <select name="size" value={formData.size} onChange={handleInputChange} className="w-full bg-primary border border-border px-4 py-3 text-primary focus:border-accent outline-none font-sans">
                      <option value="small">
                        Small (10cm - 15cm) • {String("IDR 1.500.000").split('').map(c => c + '\u0336').join('')} IDR 750.000 (DP)
                      </option>
                      <option value="medium">
                        Medium (15cm - 20cm) • {String("IDR 2.500.000").split('').map(c => c + '\u0336').join('')} IDR 1.250.000 (DP)
                      </option>
                      <option value="large">
                        Large (20cm+) • {String("IDR 4.000.000").split('').map(c => c + '\u0336').join('')} IDR 2.000.000 (DP)
                      </option>
                    </select>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { id: "passing", title: "Passing Session", desc: "1-2 hours • Small, quick tattoos under 10cm.", price: "IDR 1.500.000", tag: "Same-day consultation" },
                          { id: "beginning", title: "Beginning Session", desc: "3 hours • Medium-sized single pieces.", price: "IDR 2.500.000", tag: "Prior consultation recommended" },
                          { id: "medium_session", title: "Medium Session", desc: "6 hours • Detailed work or multiple small pieces.", price: "IDR 5.500.000", tag: "Prior consultation required" },
                          { id: "1day", title: "1 Day Session", desc: "8 hours • Extensive custom work, half sleeves.", price: "IDR 8.500.000", tag: "Prior consultation required" },
                          { id: "2days", title: "2 Days Session", desc: "2 × 8 hours • Full sleeves, large scale tribal.", price: "IDR 17.000.000", tag: "Prior consultation required" },
                        ].map(session => (
                          <label 
                            key={session.id} 
                            className={`flex items-start gap-3 p-3 lg:p-4 border rounded-sm cursor-pointer transition-colors ${formData.size === session.id ? 'border-accent bg-accent/5' : 'border-border bg-primary/30 hover:border-accent/50'}`}
                            onClick={() => setFormData({ ...formData, size: session.id })}
                          >
                            <div className={`mt-1 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${formData.size === session.id ? 'border-accent' : 'border-secondary/50'}`}>
                              {formData.size === session.id && <div className="w-2 h-2 bg-accent rounded-full" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex flex-col mb-1.5 gap-0.5">
                                <span className="font-heading text-primary font-bold leading-tight text-sm lg:text-base">{session.title}</span>
                                <span className="font-sans text-accent text-xs font-bold">{session.price}</span>
                              </div>
                              <span className="text-secondary/70 font-sans text-xs leading-snug block mb-2">{session.desc}</span>
                              <span className={`inline-block font-sans text-[9px] tracking-wider uppercase px-2 py-1 rounded bg-black/40 ${session.id === 'passing' ? 'text-green-400' : 'text-amber-400'}`}>
                                {session.tag}
                              </span>
                            </div>
                          </label>
                        ))}
                      </div>
                      
                      {/* Consultation notice */}
                      <div className="bg-accent/10 border border-accent/20 p-5 rounded-sm relative overflow-hidden mt-2">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent/50"></div>
                        <p className="text-accent/90 font-sans text-xs leading-relaxed pl-2">
                          <strong>📋 Note:</strong> Starting from <strong>Medium Session</strong> and above, prior consultation is highly recommended before booking. For <strong>Passing Session</strong>, consultation can be done on the same day (similar to Flash Tattoo).
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border mt-4">
                {/* Reference Image */}
                <div>
                  <label className="block text-secondary font-sans text-xs tracking-widest uppercase mb-2">
                    Reference Image {isReadOnlyCalendarPreview ? <span className="text-secondary/60">(skipped in preview)</span> : <span className="text-red-500">*</span>}
                  </label>
                  <p className="text-secondary/60 text-xs font-sans mb-3">{isReadOnlyCalendarPreview ? "Photo uploads are disabled in this preview." : "Upload a screenshot of the flash or your custom idea."}</p>
                  <label className={`w-full border-2 border-dashed p-6 text-center flex flex-col items-center justify-center transition-colors cursor-pointer rounded-sm ${formData.referenceImage ? 'border-accent bg-accent/5 text-accent' : 'border-border text-secondary hover:border-accent bg-primary/50'}`}>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, "referenceImage")} />
                    <svg className="w-8 h-8 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="font-sans text-sm">{formData.referenceImage ? formData.referenceImage.name : "Click to upload"}</span>
                  </label>
                </div>

                {/* Placement Image */}
                <div>
                  <label className="block text-secondary font-sans text-xs tracking-widest uppercase mb-2">
                    Body Placement Photo {isReadOnlyCalendarPreview ? <span className="text-secondary/60">(skipped in preview)</span> : <span className="text-red-500">*</span>}
                  </label>
                  <p className="text-secondary/60 text-xs font-sans mb-3">{isReadOnlyCalendarPreview ? "Photo uploads are disabled in this preview." : "Upload a photo of the body part where you want the tattoo."}</p>
                  <label className={`w-full border-2 border-dashed p-6 text-center flex flex-col items-center justify-center transition-colors cursor-pointer rounded-sm ${formData.placementImage ? 'border-accent bg-accent/5 text-accent' : 'border-border text-secondary hover:border-accent bg-primary/50'}`}>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, "placementImage")} />
                    <svg className="w-8 h-8 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span className="font-sans text-sm">{formData.placementImage ? formData.placementImage.name : "Click to upload"}</span>
                  </label>
                </div>
              </div>

              <div className="mt-8 p-6 border-t border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <h4 className="font-sans tracking-[0.2em] uppercase text-xs font-semibold text-accent mb-2">Summary</h4>
                  {type === "flash" ? (
                    <p className="text-secondary font-sans text-sm">
                      Estimated Total: <span className="line-through decoration-primary/50 text-primary/70">IDR {priceInfo.total.toLocaleString("id-ID")}</span>
                      <span className="mx-3 text-border hidden md:inline">|</span>
                      <span className="block md:inline mt-1 md:mt-0 text-primary">Deposit to pay today: <strong>IDR {priceInfo.deposit.toLocaleString("id-ID")}</strong></span>
                    </p>
                  ) : (
                    <p className="text-secondary font-sans text-sm">
                      Session Total: <span className="text-primary">IDR {priceInfo.total.toLocaleString("id-ID")}</span>
                      <span className="mx-3 text-border hidden md:inline">|</span>
                      <span className="block md:inline mt-1 md:mt-0 text-primary">Deposit to pay today: <strong>IDR {priceInfo.deposit.toLocaleString("id-ID")} ({CUSTOM_DEPOSIT_PERCENT}%)</strong></span>
                    </p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row w-full md:w-auto gap-4 shrink-0">
                  {type === "custom" && studioWhatsapp.length >= 8 && (
                    <button 
                      onClick={() => {
                        const text = `Hi, I'm interested in a custom tattoo.\n\nName: ${formData.name}\nEmail: ${formData.email}\nPlacement: ${formData.placementText}\nSession: ${formData.size}\n\nI have some questions before booking.`;
                        window.open(whatsappUrl(text), '_blank');
                      }}
                      disabled={!isFormValid}
                      className={`w-full sm:w-auto px-6 py-4 font-sans tracking-widest uppercase text-xs font-bold rounded-sm transition-all border ${isFormValid ? 'border-surface bg-surface text-accent hover:border-accent hover:bg-accent hover:text-white' : 'border-zinc-900 bg-zinc-900 text-zinc-500 cursor-not-allowed'}`}
                    >
                      Ask on WhatsApp
                    </button>
                  )}
                  <button 
                    onClick={() => setStep("calendar")}
                    disabled={!isFormValid}
                    className={`w-full sm:w-auto px-6 py-4 font-sans tracking-widest uppercase text-xs font-bold rounded-sm transition-all ${isFormValid ? 'bg-accent hover:bg-accent-hover text-white' : 'border border-zinc-900 bg-zinc-900 text-zinc-500 cursor-not-allowed'}`}
                  >
                    Choose date &amp; time
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: CALENDAR */}
        {step === "calendar" && (
          <div className="animate-in fade-in slide-in-from-right-4">
            <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-2 font-sans text-[10px] font-semibold uppercase tracking-[0.24em] text-accent">Booking calendar</p>
                <h2 className="font-heading text-3xl text-primary">
                  {type === "flash" ? "Choose your tattoo date" : "Choose your consultation date"}
                </h2>
                <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-secondary">
                  {type === "flash"
                    ? "See which days have room for a two-hour tattoo session."
                    : "Choose an open time for your one-hour offline consultation. Your tattoo session will be scheduled after the consultation."}
                </p>
              </div>
              <div className="shrink-0 border-l-2 border-accent/70 pl-4 text-xs leading-5 text-secondary/80">
                <span className="block text-primary">{bookingDurationHours}-hour appointment</span>
                <span>Bali local time (WITA)</span>
              </div>
            </div>

            <div className="mb-6 flex flex-col gap-3 border border-border bg-primary/70 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between" role="status" aria-live="polite">
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${availabilityState === "ready" ? "bg-emerald-500" : availabilityState === "error" ? "bg-red-400" : "animate-pulse bg-accent"}`} aria-hidden="true" />
                <span className="text-secondary">
                  {availabilityState === "loading" && "Checking bookings and studio hours…"}
                  {availabilityState === "ready" && "Availability is current. It refreshes automatically every minute."}
                  {availabilityState === "error" && "We couldn’t load live availability. Dates and times are disabled until this is fixed."}
                </span>
              </div>
              {availabilityState === "error" && (
                <button
                  type="button"
                  onClick={() => {
                    setAvailabilityState("loading");
                    setAvailabilityRetry((retry) => retry + 1);
                  }}
                  className="min-h-10 border border-border px-4 text-xs font-semibold uppercase tracking-widest text-primary transition-colors hover:border-accent hover:text-accent"
                >
                  Try again
                </button>
              )}
            </div>

            {isReadOnlyCalendarPreview && (
              <p className="mb-6 border border-accent/40 bg-accent/5 px-4 py-3 text-sm leading-relaxed text-secondary" role="note">
                Read-only preview: showing current studio availability. Bookings and payments cannot be submitted here.
              </p>
            )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
              <section aria-label="Choose a booking date" className="border border-border bg-primary p-4 sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    aria-label="Previous month"
                    disabled={isCurrentMonth}
                    onClick={() => {
                      const date = new Date(calYear, calMonth - 1, 1);
                      setCalMonth(date.getMonth());
                      setCalYear(date.getFullYear());
                      setSelectedDate("");
                      setSelectedTime("");
                    }}
                    className="inline-flex h-10 w-10 items-center justify-center border border-border text-lg text-secondary transition-colors hover:border-accent hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <span aria-hidden="true">←</span>
                  </button>
                  <div className="text-center">
                    <h3 className="font-heading text-xl text-primary">{monthLabel}</h3>
                    <p className="mt-1 text-xs text-secondary/70">
                      {availabilityState === "ready" ? `${openDateCount} ${openDateCount === 1 ? "day" : "days"} with times available` : "Calendar availability"}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Next month"
                    onClick={() => {
                      const date = new Date(calYear, calMonth + 1, 1);
                      setCalMonth(date.getMonth());
                      setCalYear(date.getFullYear());
                      setSelectedDate("");
                      setSelectedTime("");
                    }}
                    className="inline-flex h-10 w-10 items-center justify-center border border-border text-lg text-secondary transition-colors hover:border-accent hover:text-primary"
                  >
                    <span aria-hidden="true">→</span>
                  </button>
                </div>

                <div className="mb-2 grid grid-cols-7 gap-1 text-center" aria-hidden="true">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="py-2 text-[10px] font-semibold uppercase tracking-wider text-secondary/60">{day}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1.5" role="group" aria-label={`${monthLabel} dates`}>
                  {Array.from({ length: firstWeekdayOfMonth }, (_, index) => (
                    <div key={`empty-${index}`} className="min-h-[4.25rem]" aria-hidden="true" />
                  ))}
                  {calendarDays.map((date) => {
                    const isSelectable = availabilityState === "ready" && (date.status === "available" || date.status === "limited");
                    const isSelected = selectedDate === date.dateString && isSelectable;
                    return (
                      <button
                        key={date.dateString}
                        type="button"
                        disabled={!isSelectable}
                        aria-label={`${date.dateLabel}: ${date.statusDescription}`}
                        aria-pressed={isSelected}
                        title={`${date.dateLabel}: ${date.statusDescription}`}
                        onClick={() => {
                          setSelectedDate(date.dateString);
                          setSelectedTime("");
                        }}
                        className={`relative flex min-h-[4.25rem] flex-col items-center justify-center gap-0.5 border px-0.5 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed ${isSelected ? "border-accent bg-accent text-white" : CALENDAR_DAY_STYLES[date.status]} ${date.isToday && !isSelected ? "ring-1 ring-inset ring-accent/70" : ""}`}
                      >
                        <span className="text-sm font-semibold leading-none">{date.day}</span>
                        <span className={`max-w-full truncate text-[8px] leading-tight sm:text-[9px] ${isSelected ? "text-white/85" : "opacity-80"}`}>
                          {date.shortStatus}
                        </span>
                        {date.status === "limited" && !isSelected && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 border-t border-border pt-4">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary/60">Date key</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-secondary">
                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 border border-border bg-primary" aria-hidden="true" /> Open</span>
                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 border border-accent/50 bg-accent/20" aria-hidden="true" /> Limited</span>
                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 border border-accent/30 bg-accent/5" aria-hidden="true" /> Fully booked</span>
                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 border border-border bg-surface" aria-hidden="true" /> Closed / unavailable</span>
                  </div>
                    <p className="mt-3 text-[11px] leading-5 text-secondary/55">Past dates can’t be selected. A day marked Limited still has bookable times.</p>
                </div>
              </section>

              <section aria-label="Choose an available time" className="flex min-h-[23rem] flex-col border border-border bg-primary p-4 sm:p-6">
                <div className="mb-5 border-b border-border pb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Step 2</p>
                  <h3 className="mt-1 font-heading text-xl text-primary">Choose a time</h3>
                  {selectedDate && isSelectedDateBookable ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-primary">{new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
                      <span className="text-xs text-secondary">
                        {availabilityState === "ready" ? `${selectedDateOpenSlots.length} of ${selectedDateSlots.length} times available` : "Checking times…"}
                      </span>
                    </div>
                  ) : selectedDate && availabilityState === "ready" ? (
                    <p className="mt-3 text-sm text-amber-200/80">That date is no longer available. Choose another date from the calendar.</p>
                  ) : (
                    <p className="mt-2 text-sm text-secondary">Select an open date to see its times.</p>
                  )}
                </div>

                {availabilityState === "loading" ? (
                  <div className="flex flex-1 items-center justify-center border border-dashed border-border p-6 text-center text-sm text-secondary" role="status">
                    Checking the studio calendar…
                  </div>
                ) : availabilityState === "error" ? (
                  <div className="flex flex-1 items-center justify-center border border-dashed border-border p-6 text-center text-sm leading-6 text-secondary" role="alert">
                    Live availability is unavailable. Please try again before choosing a date.
                  </div>
                ) : !selectedDate ? (
                  <div className="flex flex-1 items-center justify-center border border-dashed border-border p-6 text-center text-sm leading-6 text-secondary/75">
                    Choose a date marked Open or Limited. Booked times won’t be selectable.
                  </div>
                ) : !isSelectedDateBookable ? (
                  <div className="flex flex-1 items-center justify-center border border-dashed border-border p-6 text-center text-sm leading-6 text-secondary/75">
                    This date is closed, full, or no longer available. Select another day to see its times.
                  </div>
                ) : selectedDateSlots.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center border border-dashed border-border p-6 text-center text-sm leading-6 text-secondary/75">
                    There are no {bookingDurationHours}-hour start times on this day. Please choose another date.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {selectedDateSlots.map((slot) => {
                      const isUnavailable = slot.booked || slot.blocked;
                      const [hourText, minuteText] = slot.time.split(":");
                      const hour = Number(hourText);
                      const displayHour = hour % 12 || 12;
                      const displayTime = `${displayHour}:${minuteText} ${hour >= 12 ? "PM" : "AM"}`;
                      const status = slot.booked ? "Booked" : slot.blocked ? (slot.blockReason || "Unavailable") : "Available";
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={isUnavailable}
                          aria-label={`${displayTime}, ${status.toLowerCase()}`}
                          aria-pressed={selectedTime === slot.time}
                          title={status}
                          onClick={() => setSelectedTime(slot.time)}
                          className={`flex min-h-14 items-center justify-between gap-2 border px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed ${isUnavailable ? "border-border/70 bg-surface/70 text-secondary/50" : selectedTime === slot.time ? "border-accent bg-accent/10 text-accent" : "border-border text-primary hover:border-accent hover:bg-accent/5"}`}
                        >
                          <span className="text-sm font-semibold">{displayTime}</span>
                          <span className={`text-[9px] font-semibold uppercase tracking-wider ${slot.booked ? "text-secondary/55" : slot.blocked ? "text-secondary/65" : selectedTime === slot.time ? "text-accent" : "text-emerald-400"}`}>
                            {status}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {availabilityState === "ready" && selectedDate && selectedDateSlots.length > 0 && (
                  <p className="mt-4 text-[11px] leading-5 text-secondary/55">Unavailable times are already booked or blocked by the studio. Customer and booking details are never shown here.</p>
                )}
              </section>
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setStep("form")}
                className="min-h-12 px-5 text-left text-xs font-bold uppercase tracking-widest text-secondary transition-colors hover:text-primary"
              >
                ← Back to details
              </button>
              <button
                type="button"
                onClick={() => setStep("checkout")}
                disabled={!canProceedToDeposit}
                className={`min-h-12 px-7 text-xs font-bold uppercase tracking-widest transition-colors ${canProceedToDeposit ? "bg-accent text-white hover:bg-accent-hover" : "cursor-not-allowed bg-surface text-secondary/50"}`}
              >
                Continue to deposit
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: CHECKOUT (Mock) */}
        {step === "checkout" && (
          <div className="animate-in fade-in slide-in-from-right-4 max-w-xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="font-heading text-3xl text-primary mb-2">Deposit Summary</h2>
              <p className="text-secondary font-sans text-sm">Review your booking details before paying.</p>
            </div>

            {isReadOnlyCalendarPreview && (
              <p className="mb-6 border border-accent/40 bg-accent/5 px-4 py-3 text-sm leading-relaxed text-secondary" role="note">
                Read-only preview: no booking, photo upload, or payment will be submitted.
              </p>
            )}

            <div className="bg-primary border border-border p-5 sm:p-8 rounded-sm mb-8 space-y-5">
              <div className="flex items-baseline justify-between gap-6 border-b border-border pb-4">
                <span className="text-secondary font-sans text-xs uppercase tracking-[0.18em]">Type</span>
                <span className="text-primary font-heading uppercase text-right">{type} Tattoo</span>
              </div>
              <div className="border-b border-border pb-5">
                <span className="block text-secondary font-sans text-xs uppercase tracking-[0.18em]">Date &amp; time</span>
                <span className="mt-2 block border-l-2 border-accent pl-4 text-primary font-heading text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                  {formattedBookingDate}<span className="mx-2 text-accent">@</span>{formattedBookingTime}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-6 pt-1">
                <span className="text-secondary font-sans text-xs font-bold uppercase tracking-[0.12em]">Deposit due ({type === "flash" ? FLASH_DEPOSIT_PERCENT : CUSTOM_DEPOSIT_PERCENT}%)</span>
                <span className="text-accent font-heading font-bold text-xl text-right sm:text-2xl">IDR {priceInfo.deposit.toLocaleString()}</span>
              </div>
              {type === "flash" && (
                <p className="text-secondary/60 text-xs text-right italic">
                  Remaining 50% payable later.
                </p>
              )}
              {type === "custom" && (
                <p className="text-secondary/60 text-xs text-right italic">
                  Remaining 90% payable later, through additional deposits or the final payment.
                </p>
              )}
            </div>

            <div className="mb-8 border border-border bg-primary p-5 sm:p-6">
              <p className="text-secondary font-sans text-xs font-bold uppercase tracking-[0.18em]">Payment method</p>
              <div className="mt-4 min-h-24 border border-[#003f6b] bg-[#003f6b] p-4 text-left text-primary"><span className="block font-semibold">PayPal</span><span className="mt-1 block text-xs leading-5">Secure online checkout. Payment is confirmed automatically by PayPal.</span></div>
              <p className="mt-4 text-xs leading-5 text-secondary">PayPal shows the USD amount before payment. The studio controls the exchange rate, so you never need to calculate it yourself.</p>
            </div>

            <div className="flex flex-col gap-4">
              <button 
                onClick={handleCheckout}
                disabled={isLoading || isReadOnlyCalendarPreview}
                className={`w-full py-4 font-sans tracking-widest uppercase text-xs font-bold transition-all ${isLoading || isReadOnlyCalendarPreview ? 'bg-surface text-secondary cursor-not-allowed' : 'bg-accent hover:bg-accent-hover text-white'}`}
              >
                {isReadOnlyCalendarPreview ? "Payment disabled in preview" : isLoading ? "Creating payment link..." : "Continue to PayPal"}
              </button>
              <button 
                onClick={() => setStep("calendar")}
                disabled={isLoading}
                className="w-full py-4 text-secondary hover:text-primary font-sans tracking-widest uppercase text-xs font-bold transition-all"
              >
                Go Back
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: SUCCESS */}
        {step === "success" && (
          <div className="animate-in fade-in duration-500 flex flex-col items-center text-center py-10">

            {/* Minimal accent line instead of neon circle */}
            <div className="w-12 h-px bg-accent mb-8" />

            <h2 className="font-heading text-4xl text-primary mb-4">
              {type === "custom" ? "Consultation Booked" : "Booking Confirmed"}
            </h2>
            <p className="text-secondary font-sans leading-relaxed mb-10 max-w-lg">
              {type === "custom" ? (
                <>Your consultation on <strong className="text-primary">{formattedBookingDate} at {formattedBookingTime}</strong> is secured. During this meeting, we will discuss your design, estimate the final price, and schedule your tattoo session.</>
              ) : (
                <>Your slot on <strong className="text-primary">{formattedBookingDate} at {formattedBookingTime}</strong> is secured. We will be in touch shortly.</>
              )}
            </p>
            
            <div className="border border-border/50 bg-surface p-8 w-full max-w-md mb-10 text-left">
              <p className="font-sans text-xs tracking-[0.2em] uppercase text-accent mb-3">Next Step</p>
              <p className="text-secondary font-sans text-sm leading-relaxed mb-6">
                {type === "custom"
                  ? "Message Jerry on WhatsApp to share your initial design ideas before the consultation."
                  : "Drop Jerry a message on WhatsApp to confirm your design details."
                }
              </p>
              {studioWhatsapp.length >= 8 && <a
                href={whatsappUrl(`Hello Jerry! I just booked a ${type === "custom" ? "consultation" : "flash tattoo"} on ${selectedDate} at ${selectedTime}. My name is ${formData.name}. Order ID: ${bookingId}`)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-3 w-full py-4 bg-accent hover:bg-accent-hover text-white font-sans tracking-widest uppercase text-xs font-bold transition-all"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Message Jerry on WhatsApp
              </a>}
            </div>

            <Link href="/" className="text-secondary/50 hover:text-secondary font-sans text-xs tracking-widest uppercase transition-colors">
              Return to Homepage
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}

