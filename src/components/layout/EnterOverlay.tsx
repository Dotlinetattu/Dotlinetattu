"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useStudioAudio } from './StudioAudio';

export default function EnterOverlay() {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);
  const { startMusic } = useStudioAudio();

  useEffect(() => {
    // Force scroll to top on mount
    window.scrollTo(0, 0);

    // Disable scrolling when overlay is visible initially
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      // Re-enable scrolling on cleanup if component is completely destroyed
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, []); // Empty dependency array so it doesn't re-run when state changes

  const handleEnter = () => {
    void startMusic();
    
    setIsFading(true);
    // Allow animation to finish before removing from DOM
    setTimeout(() => {
      setIsVisible(false);
      document.body.style.overflow = ""; // Re-enable scroll
      document.documentElement.style.overflow = "";
    }, 1000); 
  };

  return (
    <>
      {/* OVERLAY SCREEN */}
      {isVisible && (
        <div 
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#070707] text-white transition-opacity duration-1000 ${
            isFading ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(184,92,56,0.05)_0%,transparent_70%)]"></div>
          
          <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-1000">
            
            {/* Logo & Title */}
            <div className="flex flex-col items-center mb-12">
              <div className="relative w-40 h-40 md:w-56 md:h-56 mb-6">
                <Image 
                  src="https://res.cloudinary.com/workstation-/image/upload/v1788875981/Dotlinetattu/Logo_Dotlinetattu.avif"
                  alt="Dotlinetattu Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <h1 className="font-heading text-3xl md:text-5xl tracking-widest uppercase text-primary glow-text">
                Dotlinetattu
              </h1>
            </div>

            <button 
              onClick={handleEnter}
              className="group relative px-10 py-4 overflow-hidden rounded-sm border border-transparent bg-transparent hover:border-accent hover:bg-accent transition-colors duration-500"
            >
              <div className="absolute inset-0 bg-accent/10 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-500 ease-in-out"></div>
              <span className="relative z-10 font-sans tracking-[0.3em] uppercase text-sm group-hover:text-accent transition-colors duration-500">
                Enter Studio
              </span>
            </button>
            
            <div className="mt-8 flex items-center gap-3 text-secondary/60">
              <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
              <span className="font-sans text-xs tracking-widest uppercase">Sound On</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
