'use client';

import { useCallback, useEffect, useState } from 'react';
import { Apple, Check, ExternalLink, LoaderCircle, Music2, X } from 'lucide-react';
import type { ProviderType } from '@/types/music';

type ConnectionStatus = Record<ProviderType, { connected: boolean; expiresAt: number | null }>;
const initialStatus: ConnectionStatus = {
  spotify: { connected: false, expiresAt: null }, apple: { connected: false, expiresAt: null }, youtube: { connected: false, expiresAt: null },
};

interface MusicKitUser {
  authorize(): Promise<string>;
}
interface MusicKitWindow extends Window {
  MusicKit?: { configure(options: { developerToken: string; app: { name: string; build: string } }): MusicKitUser; getInstance?(): MusicKitUser };
}

const providers: Array<{ id: ProviderType; name: string; detail: string }> = [
  { id: 'spotify', name: 'Spotify', detail: 'Your saved playlists and Spotify playback.' },
  { id: 'apple', name: 'Apple Music', detail: 'Your Apple Music library and playlists.' },
  { id: 'youtube', name: 'YouTube Music', detail: 'Playlists from your Google account.' },
];

export default function ProviderConnect({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState<ProviderType | null>(null);
  const [message, setMessage] = useState('');

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/status', { cache: 'no-store' });
      if (response.ok) setStatus(await response.json() as ConnectionStatus);
    } catch { setMessage('Could not load connection status.'); }
  }, []);

  useEffect(() => { void refreshStatus(); }, [refreshStatus]);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onClose]);

  const connectApple = async () => {
    setBusy('apple'); setMessage('');
    try {
      const win = window as MusicKitWindow;
      if (!win.MusicKit) {
        await new Promise<void>((resolve, reject) => {
          const script = document.getElementById('apple-musickit-js') as HTMLScriptElement | null ?? document.createElement('script');
          script.addEventListener('load', () => resolve(), { once: true });
          script.addEventListener('error', () => reject(new Error('MusicKit could not be loaded.')), { once: true });
          if (!script.src) { script.id = 'apple-musickit-js'; script.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js'; script.async = true; document.head.appendChild(script); }
        });
      }
      const tokenResponse = await fetch('/api/apple-token', { cache: 'no-store' });
      if (!tokenResponse.ok) throw new Error('Apple Music credentials are not configured on the server.');
      const { token } = await tokenResponse.json() as { token: string };
      const musicKit = (window as MusicKitWindow).MusicKit;
      if (!musicKit) throw new Error('MusicKit is unavailable.');
      const instance = musicKit.getInstance?.() ?? musicKit.configure({ developerToken: token, app: { name: 'Sonder', build: '1.0.0' } });
      const musicUserToken = await instance.authorize();
      const response = await fetch('/api/auth/apple', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ musicUserToken }) });
      if (!response.ok) throw new Error('Could not securely save Apple Music authorization.');
      await refreshStatus();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Apple Music connection failed.'); }
    finally { setBusy(null); }
  };

  const disconnect = async (provider: ProviderType) => {
    setBusy(provider); setMessage('');
    try {
      const response = await fetch(`/api/auth/${provider}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not disconnect this provider.');
      await refreshStatus();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Disconnect failed.'); }
    finally { setBusy(null); }
  };

  if (!open) return null;
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="provider-connect-title" className="glass w-full max-w-xl rounded-[28px] p-5 shadow-2xl sm:p-7">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[.2em] text-[#fa4b78]">Your services</p><h2 id="provider-connect-title" className="text-2xl font-semibold">Provider connections</h2><p className="mt-2 text-sm text-white/45">Authorize services to bring your libraries together.</p></div>
        <button type="button" onClick={onClose} aria-label="Close provider connections" className="rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white"><X size={18} /></button>
      </header>
      <div className="space-y-3">
        {providers.map((provider) => {
          const connected = status[provider.id].connected;
          return <article key={provider.id} className="flex items-center gap-3 rounded-2xl border border-white/[.07] bg-black/15 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[.07] text-white/75">{provider.id === 'apple' ? <Apple size={19} /> : provider.id === 'youtube' ? <span className="text-sm font-bold text-red-400">▶</span> : <Music2 size={19} className="text-emerald-300" />}</span>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-medium">{provider.name}</h3><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] ${connected ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/[.06] text-white/45'}`}>{connected && <Check size={11} />}{connected ? 'Connected' : 'Disconnected'}</span></div><p className="mt-1 text-xs text-white/40">{provider.detail}</p></div>
            {connected ? <button type="button" disabled={busy !== null} onClick={() => void disconnect(provider.id)} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 hover:bg-white/10 disabled:opacity-40">{busy === provider.id ? <LoaderCircle size={15} className="animate-spin" /> : 'Disconnect'}</button> : provider.id === 'apple' ? <button type="button" disabled={busy !== null} onClick={() => void connectApple()} className="rounded-xl bg-white px-3 py-2 text-xs font-medium text-black hover:bg-white/90 disabled:opacity-40">{busy === 'apple' ? <LoaderCircle size={15} className="animate-spin" /> : 'Connect'}</button> : <a href={`/api/auth/${provider.id}`} aria-disabled={busy !== null} onClick={() => setBusy(provider.id)} className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-medium text-black hover:bg-white/90">Connect <ExternalLink size={12} /></a>}
          </article>;
        })}
      </div>
      {message && <p className="mt-4 rounded-xl border border-red-300/15 bg-red-300/5 p-3 text-xs text-red-200" role="alert">{message}</p>}
      <p className="mt-5 text-[11px] leading-relaxed text-white/35">Provider access is stored in an encrypted, HTTP-only session cookie. You can disconnect any service here at any time.</p>
      <button type="button" onClick={onClose} className="mt-5 w-full rounded-xl bg-white/10 py-3 text-sm text-white/75 hover:bg-white/[.14]">Done</button>
    </section>
  </div>;
}
