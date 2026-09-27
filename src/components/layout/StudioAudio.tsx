'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';

const MUSIC_URL = 'https://res.cloudinary.com/workstation-/video/upload/v1788876268/bg-music.wav';
const MUSIC_ENABLED_KEY = 'dotlinetattu-music-enabled';

type StudioAudioValue = {
  isPlaying: boolean;
  hasEntered: boolean;
  startMusic: () => Promise<void>;
  toggleMusic: () => Promise<void>;
};

const StudioAudioContext = createContext<StudioAudioValue | null>(null);

export function useStudioAudio() {
  const context = useContext(StudioAudioContext);
  if (!context) throw new Error('useStudioAudio must be used inside StudioAudioProvider.');
  return context;
}

function SoundIcon({ muted }: { muted: boolean }) {
  return muted ? <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15Z" /><path d="m17 7-10 10" strokeLinecap="round" strokeWidth={2} /></svg> : <svg className="h-5 w-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 0 1 0 7.072m2.828-9.9a9 9 0 0 1 0 12.728M5.586 15H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15Z" /></svg>;
}

export default function StudioAudioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);

  const startMusic = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      await audio.play();
      localStorage.setItem(MUSIC_ENABLED_KEY, 'true');
      setHasEntered(true);
      setIsPlaying(true);
    } catch {
      // Browsers may require a user gesture after a full page load.
      setHasEntered(true);
      setIsPlaying(false);
    }
  };

  const toggleMusic = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      localStorage.setItem(MUSIC_ENABLED_KEY, 'false');
      setIsPlaying(false);
      return;
    }
    await startMusic();
  };

  useEffect(() => {
    const audio = new Audio(MUSIC_URL);
    audio.loop = true;
    audio.volume = 0.3;
    audioRef.current = audio;

    if (localStorage.getItem(MUSIC_ENABLED_KEY) === 'true') {
      setHasEntered(true);
      void startMusic();
    }

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  return <StudioAudioContext.Provider value={{ isPlaying, hasEntered, startMusic, toggleMusic }}>
    {children}
    {hasEntered && <button onClick={() => void toggleMusic()} className="fixed bottom-6 left-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-surface bg-surface text-accent transition-all duration-300 hover:border-[#2a1b14] hover:bg-[#2a1b14]" title={isPlaying ? 'Mute music' : 'Play music'} aria-label={isPlaying ? 'Mute music' : 'Play music'}><SoundIcon muted={!isPlaying} /></button>}
  </StudioAudioContext.Provider>;
}
