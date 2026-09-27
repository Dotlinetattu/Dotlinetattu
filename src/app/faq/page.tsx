"use client";
import { useState } from "react";

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      question: "Do you only do Handpoke tattoos?",
      answer: "While we specialize in traditional Handpoke techniques (originating from Mentawai traditions), we also offer modern Machine tattoos for specific styles or client preferences."
    },
    {
      question: "What is the minimum tattoo size?",
      answer: "We have a strict minimum size policy of 10cm. Traditional handpoke requires space for the ink to settle and breathe. Tattoos smaller than 10cm tend to blur over time and lose their artistic integrity."
    },
    {
      question: "How long can a single session last?",
      answer: "Based on medical advice, a single tattoo session cannot exceed 6 hours. Enduring pain for longer than 6 hours can cause the body to go into shock, leading to weakness, fainting, or fever. Your safety is our priority."
    },
    {
      question: "How does the payment and booking work?",
      answer: "Flash tattoos require a 50% deposit and custom tattoos require a 10% deposit via our website to secure the booking. The remaining balance is arranged through the studio&apos;s payment requests."
    },
    {
      question: "Can I bring friends to my session?",
      answer: "Our studio is a focused, intimate space designed for a calm and focused tattoo experience. While you may bring one person for support, we ask that you avoid bringing large groups so the artist can concentrate fully on your piece."
    }
  ];

  return (
    <div className="pt-32 pb-24 w-full flex flex-col items-center min-h-screen">
      <div className="container mx-auto px-4 md:px-8 max-w-4xl relative z-10">
        
        {/* Header */}
        <div className="text-center mb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <h3 className="text-accent font-heading tracking-widest text-sm uppercase mb-4 glow-text">Need to know</h3>
          <h1 className="text-4xl md:text-6xl font-heading font-bold text-primary uppercase tracking-wider mb-6">
            FAQ & Info
          </h1>
          <div className="w-16 h-1 bg-accent mx-auto mb-6"></div>
          <p className="text-secondary font-light text-lg">
            Everything you need to know before stepping into Dotlinetattu.
          </p>
        </div>

        {/* FAQ List */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div 
              key={idx} 
              className={`glass-panel border transition-all duration-500 rounded-sm overflow-hidden cursor-pointer ${
                openIdx === idx ? "border-accent/50" : "border-border hover:border-accent/30"
              }`}
              onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
            >
              <div className="p-6 md:p-8 flex items-center justify-between">
                <h3 className={`font-heading font-bold text-lg md:text-xl uppercase tracking-wide flex gap-4 transition-colors ${openIdx === idx ? 'text-primary' : 'text-secondary'}`}>
                  <span className="text-accent">0{idx + 1}.</span>
                  {faq.question}
                </h3>
                <div className={`transform transition-transform duration-500 text-accent ${openIdx === idx ? "rotate-45" : "rotate-0"}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
              </div>
              
              <div 
                className={`transition-all duration-500 ease-in-out px-6 md:px-8 ${
                  openIdx === idx ? "max-h-48 pb-8 opacity-100" : "max-h-0 pb-0 opacity-0"
                }`}
              >
                <p className="text-secondary font-light leading-relaxed md:pl-10 text-base md:text-lg">
                  {faq.answer}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
