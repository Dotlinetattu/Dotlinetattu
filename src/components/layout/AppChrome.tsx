"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import EnterOverlay from "@/components/layout/EnterOverlay";
import StudioAudioProvider from '@/components/layout/StudioAudio';

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  if (isAdmin) return <>{children}</>;

  return (
    <StudioAudioProvider>
      {pathname === "/" && <EnterOverlay />}
      <Navbar />
      <main className="flex-1 flex flex-col">{children}</main>
      <Footer />
      <WhatsAppButton />
    </StudioAudioProvider>
  );
}
