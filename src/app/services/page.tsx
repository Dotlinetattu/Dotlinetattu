import Link from "next/link";
import { SERVICE_PRICES } from "@/lib/pricing";

export default function Services() {
  const sessionPackages = [
    { name: "Passing Session", desc: "For small, quick tattoos under 10cm.", duration: "1-2 hours", price: `IDR ${SERVICE_PRICES.custom.passing.toLocaleString("id-ID")} / $85` },
    { name: "Beginning Session", desc: "Perfect for medium-sized single pieces.", duration: "3 hours", price: `IDR ${SERVICE_PRICES.custom.beginning.toLocaleString("id-ID")} / $140` },
    { name: "Medium Session", desc: "Detailed work or multiple small pieces.", duration: "6 hours", price: `IDR ${SERVICE_PRICES.custom.medium_session.toLocaleString("id-ID")} / $310` },
    { name: "1 Day Session", desc: "Extensive custom work, half sleeves.", duration: "8 hours", price: `IDR ${SERVICE_PRICES.custom['1day'].toLocaleString("id-ID")} / $480` },
    { name: "2 Days Session", desc: "Full sleeves, large scale tribal pieces.", duration: "2 x 8 hours", price: `IDR ${SERVICE_PRICES.custom['2days'].toLocaleString("id-ID")} / $955` },
  ];

  return (
    <div className="pt-32 pb-24 w-full flex flex-col items-center">
      <div className="container mx-auto px-4 md:px-8 max-w-6xl">
        
        {/* Header */}
        <div className="text-center mb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <h3 className="text-accent font-heading tracking-widest text-sm uppercase mb-4">Investment</h3>
          <h1 className="text-4xl md:text-6xl font-heading font-bold text-primary uppercase tracking-wider mb-6">
            Tattoo Services
          </h1>
          <p className="text-secondary font-light max-w-2xl mx-auto">
            We value your time, skin, and our craft. <strong className="text-primary">Flash tattoos require a 50% deposit</strong>, while <strong className="text-primary">custom tattoos require a 10% deposit</strong> to secure the booking. The remaining balance can be paid through the studio&apos;s payment requests.
          </p>
        </div>

        {/* The Two Main Offerings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-24">
          
          {/* Custom Sessions */}
          <div className="glass-panel p-8 md:p-12 border border-border rounded-sm flex flex-col">
            <h2 className="text-3xl font-heading font-bold text-primary uppercase tracking-wide mb-2">
              Custom Sessions
            </h2>
            <p className="text-accent text-sm tracking-widest uppercase mb-8">Consultation Required</p>
            <p className="text-secondary font-light mb-8 flex-grow">
              Got an idea? We work with you to design a unique, personalized piece. Pricing is based on how much time the session takes. Minimum size recommended is 10cm to preserve detail over time.
            </p>
            
            <div className="flex flex-col gap-4 mb-10">
              {sessionPackages.map((pkg, idx) => (
                <div key={idx} className="flex justify-between items-end border-b border-border/50 pb-3">
                  <div>
                    <h4 className="font-heading font-bold text-primary text-lg">{pkg.name}</h4>
                    <p className="text-secondary text-sm">{pkg.duration} &bull; {pkg.desc}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-accent font-medium">{pkg.price}</span>
                  </div>
                </div>
              ))}
            </div>

            <Link 
              href="/booking" 
              className="w-full text-center px-6 py-4 bg-accent hover:bg-accent-hover text-white transition-all font-heading font-bold tracking-widest uppercase text-sm rounded-sm"
            >
              Consult via WhatsApp
            </Link>
          </div>

          {/* Flash Tattoos */}
          <div className="glass-panel p-8 md:p-12 border border-border rounded-sm flex flex-col">
            <h2 className="text-3xl font-heading font-bold text-primary uppercase tracking-wide mb-2">
              Flash Tattoos
            </h2>
            <p className="text-accent text-sm tracking-widest uppercase mb-8">Instant Booking</p>
            <p className="text-secondary font-light mb-8 flex-grow">
              Choose from Jerry's exclusive book of pre-designed authentic tribal flashes. Pricing is fixed based on size. No consultation needed—just pick your design, book your slot, and get inked.
            </p>

            <div className="bg-surface/50 p-6 border border-border/50 rounded-sm mb-10">
              <h4 className="font-heading font-bold text-primary text-lg mb-4">Estimated Flash Pricing</h4>
              <ul className="space-y-4">
                <li className="flex justify-between text-secondary">
                  <span>Small (10-15cm)</span>
                  <span className="font-mono text-accent">~ IDR 1.500.000 / $85</span>
                </li>
                <li className="flex justify-between text-secondary">
                  <span>Medium (15-20cm)</span>
                  <span className="font-mono text-accent">~ IDR 2.500.000 / $140</span>
                </li>
                <li className="flex justify-between text-secondary">
                  <span>Large (20cm+)</span>
                  <span className="font-mono text-accent">~ IDR 4.000.000+ / $225+</span>
                </li>
              </ul>
              <p className="text-text-tertiary text-xs mt-6 italic">
                * Prices are estimates. Exact price is calculated during checkout.
              </p>
            </div>

            <Link 
              href="/booking" 
              className="w-full text-center px-6 py-4 bg-surface border border-surface text-accent hover:bg-accent hover:border-accent hover:text-white transition-all font-heading font-bold tracking-widest uppercase text-sm rounded-sm"
            >
              Book Flash Tattoo
            </Link>
          </div>

        </div>

      </div>
    </div>
  );
}
