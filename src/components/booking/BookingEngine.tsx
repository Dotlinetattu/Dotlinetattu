"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getBookedSlots, getBlockedDates, getOpenHours, createBooking } from "@/app/actions/bookingActions";
import { createInitialPaymentRequest } from "@/app/actions/paymentActions";
import ZoomableImage from "@/components/ui/ZoomableImage";
import { bookingSlotsForDay, DEFAULT_WEEKLY_HOURS, timeToMinutes, WEEK_DAYS, type WeeklyHours } from "@/lib/studio-hours";
import { CUSTOM_DEPOSIT_PERCENT, FLASH_DEPOSIT_PERCENT, SERVICE_PRICES, calculateDeposit } from "@/lib/pricing";

type FlowType = "flash" | "custom";
type Step = "warning" | "form" | "calendar" | "checkout" | "success";

const STORAGE_KEY = "dotlinetattu_booking_draft";

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
  const studioWhatsapp = (process.env.NEXT_PUBLIC_STUDIO_WHATSAPP || '').replace(/[^0-9]/g, '');
  const whatsappUrl = (message: string) => `https://wa.me/${studioWhatsapp}?text=${encodeURIComponent(message)}`;

  // All state starts with defaults — localStorage will hydrate them after mount
  const [hydrated, setHydrated] = useState(false);
  const [type, setType] = useState<FlowType>(initialType);
  const [step, setStep] = useState<Step>(initialType === "flash" ? "warning" : "form");
  const [isLoading, setIsLoading] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<any[]>([]);
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  const [openHours, setOpenHours] = useState<WeeklyHours>(DEFAULT_WEEKLY_HOURS);
  const [bookingId, setBookingId] = useState<string>("");
  const [countryCode, setCountryCode] = useState("+62");
  const [countryQuery, setCountryQuery] = useState("");
  const checkoutInProgress = useRef(false);
  const [paymentProvider, setPaymentProvider] = useState<'WISE' | 'PAYPAL'>('WISE');

  const [calMonth, setCalMonth] = useState<number>(now.getMonth());
  const [calYear, setCalYear] = useState<number>(now.getFullYear());

  // Fetch booked slots
  useEffect(() => {
    async function fetchSlots() {
      const [slots, blocked, hours] = await Promise.all([
        getBookedSlots(),
        getBlockedDates(),
        getOpenHours()
      ]);
      setBookedSlots(slots);
      setBlockedDates(blocked);
      setOpenHours(hours);
    }
    fetchSlots();
    const refreshInterval = window.setInterval(fetchSlots, 60_000);
    return () => window.clearInterval(refreshInterval);
  }, []);

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
        if (draft.selectedDate) setSelectedDate(draft.selectedDate);
        if (draft.selectedTime) setSelectedTime(draft.selectedTime);
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
    formData.placementImage !== null && 
    formData.referenceImage !== null;

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

  const handleCheckout = async () => {
    if (checkoutInProgress.current) return;
    checkoutInProgress.current = true;
    setIsLoading(true);
    try {
      let designUrl = null;
      let placementUrl = null;

      // Upload Reference Image
      if (formData.referenceImage) {
        const uploadData = new FormData();
        uploadData.append('file', formData.referenceImage);
        const res = await fetch('/api/upload', { method: 'POST', body: uploadData });
        if (res.ok) {
          const json = await res.json();
          designUrl = json.secure_url;
        }
      }

      // Upload Placement Image
      if (formData.placementImage) {
        const uploadData = new FormData();
        uploadData.append('file', formData.placementImage);
        const res = await fetch('/api/upload', { method: 'POST', body: uploadData });
        if (res.ok) {
          const json = await res.json();
          placementUrl = json.secure_url;
        }
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
      alert("Failed to create booking. Please try again.");
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
                    "https://res.cloudinary.com/workstation-/image/upload/v1788876470/handtapping-tattoo-bali-dotlinetattu-FuI3cCjPQQpIbAk2.webp",
                    "https://res.cloudinary.com/workstation-/image/upload/v1788876467/handpoke-tattoo-bali-dotlinetattu-22-BUN8FOAbCUzf2GaG.webp",
                    "https://res.cloudinary.com/workstation-/image/upload/v1788876470/handpoke-tattoo-bali-dotlinetattu-23-foY3o9o4aQcNgnE3.webp",
                    "https://res.cloudinary.com/workstation-/image/upload/v1788876433/dotlinetattu_handpoke_bali-2-Rkt9nssE7W3zqbvl.webp",
                    "https://res.cloudinary.com/workstation-/image/upload/v1788876467/handpoke-tattoo-bali-dotlinetattu-21-yaHHOuqmCsS0hG1g.webp",
                    "https://res.cloudinary.com/workstation-/image/upload/v1788876439/handpoke_tattoo_bali_dotlinetattu-2-iT9eQaZa9y0LQ6RN.webp",
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
                    "Modern design styles cannot be achieved with traditional hand tapping."
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
                    Reference Image <span className="text-red-500">*</span>
                  </label>
                  <p className="text-secondary/60 text-xs font-sans mb-3">Upload a screenshot of the flash or your custom idea.</p>
                  <label className={`w-full border-2 border-dashed p-6 text-center flex flex-col items-center justify-center transition-colors cursor-pointer rounded-sm ${formData.referenceImage ? 'border-accent bg-accent/5 text-accent' : 'border-border text-secondary hover:border-accent bg-primary/50'}`}>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, "referenceImage")} />
                    <svg className="w-8 h-8 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="font-sans text-sm">{formData.referenceImage ? formData.referenceImage.name : "Click to upload"}</span>
                  </label>
                </div>

                {/* Placement Image */}
                <div>
                  <label className="block text-secondary font-sans text-xs tracking-widest uppercase mb-2">
                    Body Placement Photo <span className="text-red-500">*</span>
                  </label>
                  <p className="text-secondary/60 text-xs font-sans mb-3">Upload a photo of the body part where you want the tattoo.</p>
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
                    Pay Deposit & Book
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: CALENDAR */}
        {step === "calendar" && (
          <div className="animate-in fade-in slide-in-from-right-4">
            <h2 className="font-heading text-3xl text-primary mb-2">
              {type === "flash" ? "Pick Tattoo Date" : "Pick Consultation Date"}
            </h2>
            <p className="text-secondary font-sans text-sm mb-8">
              {type === "flash" 
                ? "Select an available slot for your tattoo session." 
                : "Select an offline consultation date (Must be 3-4 days before your desired tattoo day)."}
            </p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Dynamic Calendar */}
              <div className="bg-primary border border-border p-6 rounded-sm">
                {/* Month navigation */}
                <div className="flex justify-between items-center mb-6">
                  <button
                    onClick={() => {
                      const d = new Date(calYear, calMonth - 1, 1);
                      setCalMonth(d.getMonth());
                      setCalYear(d.getFullYear());
                      setSelectedDate("");
                      setSelectedTime("");
                    }}
                    className="text-secondary hover:text-accent px-2 py-1 text-lg transition-colors"
                  >
                    ←
                  </button>
                  <span className="font-heading text-xl text-primary">
                    {new Date(calYear, calMonth).toLocaleString("en-US", { month: "long", year: "numeric" })}
                  </span>
                  <button
                    onClick={() => {
                      const d = new Date(calYear, calMonth + 1, 1);
                      setCalMonth(d.getMonth());
                      setCalYear(d.getFullYear());
                      setSelectedDate("");
                      setSelectedTime("");
                    }}
                    className="text-secondary hover:text-accent px-2 py-1 text-lg transition-colors"
                  >
                    →
                  </button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
                    <div key={d} className="text-secondary/50 text-xs font-sans uppercase tracking-widest py-1">{d}</div>
                  ))}
                </div>

                {/* Day grid — with correct start offset */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Empty cells for days before 1st */}
                  {Array.from({ length: new Date(calYear, calMonth, 1).getDay() }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}

                  {/* Actual days */}
                  {Array.from({ length: new Date(calYear, calMonth + 1, 0).getDate() }).map((_, i) => {
                    const day = i + 1;
                    const mm = String(calMonth + 1).padStart(2, "0");
                    const dd = String(day).padStart(2, "0");
                    const dateStr = `${calYear}-${mm}-${dd}`;

                    const today = new Date();
                    today.setHours(0,0,0,0);
                    const thisDay = new Date(calYear, calMonth, day);
                    const isPast = thisDay < today;
                    const dayKey = WEEK_DAYS[thisDay.getDay()].key;
                    const dayHours = openHours[dayKey];
                    const availableSlots = bookingSlotsForDay(dayHours);

                    const slotsForDay = bookedSlots.filter(s => s.date === dateStr);
                    const totalDailySlots = availableSlots.length;
                    
                    const blocksForDay = blockedDates.filter(b => b.date === dateStr);
                    const isFullDayBlocked = blocksForDay.some(b => !b.start_time);
                    const partialBlocks = blocksForDay.filter(b => b.start_time && b.end_time);
                    const unavailableSlots = availableSlots.filter((slot) => {
                      const slotStart = timeToMinutes(slot);
                      const slotEnd = slotStart + 60;
                      const overlapsAppointment = slotsForDay.some((appointment) => {
                        const appointmentStart = timeToMinutes(appointment.time);
                        const appointmentEnd = appointmentStart + (Number(appointment.duration_hours || 1) * 60);
                        return slotStart < appointmentEnd && slotEnd > appointmentStart;
                      });
                      const overlapsBlock = partialBlocks.some((block) => (
                        slotStart < timeToMinutes(block.end_time) && slotEnd > timeToMinutes(block.start_time)
                      ));
                      return overlapsAppointment || overlapsBlock;
                    }).length;

                    const isFullyBooked = dayHours.open && totalDailySlots > 0 && unavailableSlots >= totalDailySlots;
                    
                    const isDisabled = isPast || !dayHours.open || isFullDayBlocked || isFullyBooked;
                    const isSelected = selectedDate === dateStr;

                    return (
                      <button
                        key={dateStr}
                        disabled={isDisabled}
                        onClick={() => { setSelectedDate(dateStr); setSelectedTime(""); }}
                        className={`
                          aspect-square flex flex-col items-center justify-center font-sans text-sm transition-all relative
                          ${isDisabled
                            ? "text-secondary/20 cursor-not-allowed"
                            : isSelected
                              ? "bg-accent text-white"
                              : "text-primary hover:bg-accent/20 hover:text-white cursor-pointer"
                          }
                        `}
                      >
                        <span>{day}</span>
                        {isFullDayBlocked && (
                          <span className="text-[8px] uppercase tracking-wider text-red-500/50 mt-0.5 hidden md:block">Blocked</span>
                        )}
                        {!dayHours.open && !isFullDayBlocked && (
                          <span className="mt-0.5 hidden text-[8px] uppercase tracking-wider text-secondary/50 md:block">Closed</span>
                        )}
                        {!isDisabled && !isFullDayBlocked && (slotsForDay.length > 0 || partialBlocks.length > 0) && (
                          <div className="absolute bottom-1 flex gap-0.5">
                            {slotsForDay.map((_, idx) => (
                              <div key={`booked-${idx}`} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-accent'}`} />
                            ))}
                            {Array.from({length: Math.min(partialBlocks.length, 3)}).map((_, idx) => (
                              <div key={`blocked-${idx}`} className="w-1 h-1 rounded-full bg-red-500/50" />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Slots */}
              <div>
                <h4 className="font-heading text-xl text-primary mb-4">Available Times</h4>
                {selectedDate ? (
                  <div className="grid grid-cols-2 gap-3">
                    {(() => {
                      const selectedDay = new Date(`${selectedDate}T00:00:00`);
                      const dayKey = WEEK_DAYS[selectedDay.getDay()].key;
                      const slots = bookingSlotsForDay(openHours[dayKey]);
                      
                      return slots.map(time => {
                        const slotStart = timeToMinutes(time);
                        const slotEnd = slotStart + 60;
                        const isTimeBooked = bookedSlots.some(s => {
                          if (s.date !== selectedDate) return false;
                          const appointmentStart = timeToMinutes(s.time);
                          const appointmentEnd = appointmentStart + (Number(s.duration_hours || 1) * 60);
                          return slotStart < appointmentEnd && slotEnd > appointmentStart;
                        });
                        
                        const blockRecord = blockedDates.find(b => {
                          if (b.date !== selectedDate) return false;
                          if (!b.start_time) return true; // Full day block
                          
                          const blockStart = timeToMinutes(b.start_time);
                          const blockEnd = timeToMinutes(b.end_time);
                          return slotStart < blockEnd && slotEnd > blockStart;
                        });

                        const isTimeBlocked = !!blockRecord;
                        const isTimeDisabled = isTimeBooked || isTimeBlocked;
                        
                        const [hourText, minuteText] = time.split(':');
                        const hour = parseInt(hourText);
                        const ampm = hour >= 12 ? 'PM' : 'AM';
                        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
                        const displayTime = `${displayHour.toString().padStart(2, '0')}:${minuteText} ${ampm}`;
                        
                        let blockText = "(Blocked)";
                        if (isTimeBlocked && blockRecord.reason) {
                          blockText = `(Blocked: ${blockRecord.reason})`;
                        }
                        
                        return (
                          <button
                            key={time}
                            disabled={isTimeDisabled}
                            onClick={() => setSelectedTime(time)}
                            className={`
                              py-3 border text-sm font-sans transition-all rounded-sm
                              ${isTimeDisabled
                                ? "border-border bg-surface text-secondary/30 cursor-not-allowed"
                                : selectedTime === time
                                  ? "border-accent bg-accent/10 text-accent"
                                  : "border-border bg-primary text-secondary hover:border-accent hover:text-primary"
                              }
                            `}
                          >
                            {displayTime} {isTimeBooked && "(Booked)"} {isTimeBlocked && !isTimeBooked && blockText}
                          </button>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center border border-dashed border-border bg-primary/50 text-secondary font-sans text-sm p-8 text-center rounded-sm">
                    Select a date first to see available time slots.
                  </div>
                )}
              </div>
            </div>

            <div className="pt-10 flex justify-between">
              <button 
                onClick={() => setStep("form")}
                className="px-6 py-4 text-secondary hover:text-primary font-sans tracking-widest uppercase text-xs font-bold transition-all"
              >
                ← Back
              </button>
              <button 
                onClick={() => setStep("checkout")}
                disabled={!selectedDate || !selectedTime}
                className={`px-8 py-4 font-sans tracking-widest uppercase text-xs font-bold rounded-sm transition-all ${(!selectedDate || !selectedTime) ? "bg-surface text-secondary/50 cursor-not-allowed" : "bg-accent hover:bg-accent-hover text-white"}`}
              >
                Proceed to Deposit
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
              <p className="text-secondary font-sans text-xs font-bold uppercase tracking-[0.18em]">Choose payment method</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setPaymentProvider('WISE')} className={`min-h-24 border p-4 text-left transition-colors ${paymentProvider === 'WISE' ? 'border-[#2b1b13] bg-[#2b1b13] text-primary' : 'border-surface bg-surface text-secondary hover:border-[#2a1b14] hover:bg-[#2a1b14]'}`}><span className="block font-semibold">Wise transfer</span><span className="mt-1 block text-xs leading-5">Manual transfer with clear instructions. The studio confirms it after review.</span></button>
                <button type="button" onClick={() => setPaymentProvider('PAYPAL')} className={`min-h-24 border p-4 text-left transition-colors ${paymentProvider === 'PAYPAL' ? 'border-[#003f6b] bg-[#003f6b] text-primary' : 'border-surface bg-surface text-secondary hover:border-[#003f6b] hover:bg-[#003f6b] hover:text-white'}`}><span className="block font-semibold">PayPal</span><span className="mt-1 block text-xs leading-5">Secure online checkout. Payment is confirmed automatically by PayPal.</span></button>
              </div>
              {paymentProvider === 'PAYPAL' && <p className="mt-4 text-xs leading-5 text-secondary">PayPal shows the USD amount before payment. The studio controls the exchange rate, so you never need to calculate it yourself.</p>}
            </div>

            <div className="flex flex-col gap-4">
              <button 
                onClick={handleCheckout}
                disabled={isLoading}
                className={`w-full py-4 font-sans tracking-widest uppercase text-xs font-bold transition-all ${isLoading ? 'bg-surface text-secondary cursor-not-allowed' : 'bg-accent hover:bg-accent-hover text-white'}`}
              >
                {isLoading ? "Creating payment link..." : paymentProvider === 'PAYPAL' ? "Continue to PayPal" : "Get Wise transfer instructions"}
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

