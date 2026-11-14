'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

type ToastDetail = { id: number; message: string; tone?: 'info' | 'warning' };
const TOAST_EVENT = 'sonder:playback-toast';

export function showPlaybackToast(message: string, tone: ToastDetail['tone'] = 'warning') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<Omit<ToastDetail, 'id'>>(TOAST_EVENT, { detail: { message, tone } }));
}

export default function PlaybackToastHost() {
  const [toast, setToast] = useState<ToastDetail | null>(null);

  useEffect(() => {
    let nextId = 0;
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<Omit<ToastDetail, 'id'>>).detail;
      if (!detail?.message) return;
      const id = ++nextId;
      setToast({ ...detail, id });
      window.setTimeout(() => setToast((current) => current?.id === id ? null : current), 5200);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  if (!toast) return null;
  return <div className="fixed right-4 top-4 z-[100] w-[min(420px,calc(100vw-32px))]" aria-live="polite" aria-atomic="true">
    <div role="status" className={`glass flex items-start gap-3 rounded-2xl p-4 shadow-2xl ${toast.tone === 'info' ? 'border-sky-300/20' : 'border-amber-300/25'}`}>
      <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${toast.tone === 'info' ? 'bg-sky-300' : 'bg-amber-300'}`} />
      <p className="flex-1 text-sm leading-5 text-white/85">{toast.message}</p>
      <button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)} className="rounded-md p-1 text-white/45 hover:bg-white/10 hover:text-white"><X size={15} /></button>
    </div>
  </div>;
}
