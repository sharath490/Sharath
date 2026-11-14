'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Disc3, Headphones, Home, Library, Music2, Pause, Play,
  Repeat, Search, Settings2, Shuffle, SkipBack, SkipForward, Volume2, Waves,
} from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import PlaybackEngine from '@/components/player/PlaybackEngine';

const navigation = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Search', href: '/search', icon: Search },
  { label: 'Unified Library', href: '/#library', icon: Library },
  { label: 'Provider Connections', href: '/#connections', icon: Settings2 },
];

function formatTime(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState('#home');
  const {
    activeTrack, isPlaying, progress, volume, shuffle, repeat,
    togglePlayback, playNext, playPrevious, seek, setVolume, toggleShuffle, cycleRepeat,
  } = usePlayerStore();
  const duration = activeTrack?.durationMs ?? 0;

  return (
    <div className="relative h-dvh overflow-hidden bg-[#08090d] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_55%_0%,rgba(120,74,112,.2),transparent_55%)]" />
      <div className="relative mx-auto flex h-full max-w-[1680px] gap-5 p-3 pb-28 sm:p-5 sm:pb-28 lg:p-6 lg:pb-28">
        <aside className="glass hidden w-[260px] shrink-0 flex-col rounded-[28px] p-5 md:flex">
          <a href="/" className="mb-12 flex items-center gap-3 px-2 text-xl font-semibold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#fa4b78] text-white"><Waves size={19} /></span>
            sonder<span className="text-[#fa4b78]">.</span>
          </a>
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[.2em] text-white/35">Your space</p>
          <nav className="space-y-1" aria-label="Main navigation">
            {navigation.map(({ label, href, icon: Icon }) => {
              const selected = label === 'Home' ? pathname === '/' : label === 'Search' ? pathname === '/search' : activeSection === href.slice(1);
              return <a key={href} href={href} onClick={() => setActiveSection(href.startsWith('/#') ? href.slice(1) : '#home')} aria-current={selected ? 'page' : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${selected ? 'bg-white/10 text-white' : 'text-white/55 hover:bg-white/[.06] hover:text-white'}`}>
                <Icon size={17} />{label}
              </a>;
            })}
          </nav>
          <div className="mt-auto rounded-2xl border border-white/[.07] bg-white/[.035] p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Headphones size={16} className="text-[#fa4b78]" />One home for your music</div>
            <p className="text-xs leading-relaxed text-white/45">Connect your services to bring your listening together.</p>
            <a href="/#connections" onClick={() => setActiveSection('#connections')} className="mt-4 block rounded-xl bg-white/10 py-2 text-center text-xs font-medium transition hover:bg-white/15">Connect a service</a>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass mb-3 flex shrink-0 items-center justify-between rounded-2xl px-4 py-3 md:hidden">
            <a href="/" className="flex items-center gap-2 font-semibold"><Waves size={18} className="text-[#fa4b78]" />sonder<span className="text-[#fa4b78]">.</span></a>
            <a href="/search" aria-label="Search" className="rounded-full p-2 text-white/60 hover:bg-white/10"><Search size={18} /></a>
          </header>
          <main className="glass min-h-0 flex-1 overflow-y-auto rounded-[24px] p-4 sm:rounded-[28px] sm:p-7 lg:p-10">
            {children}
          </main>
        </div>
      </div>

      <nav className="glass fixed inset-x-0 bottom-[84px] z-20 flex justify-around border-x-0 px-2 py-2 md:hidden" aria-label="Mobile navigation">
        {navigation.map(({ label, href, icon: Icon }) => {
          const selected = label === 'Home' ? pathname === '/' : label === 'Search' ? pathname === '/search' : activeSection === href.slice(1);
          return <a key={href} href={href} onClick={() => setActiveSection(href.startsWith('/#') ? href.slice(1) : '#home')} aria-label={label} aria-current={selected ? 'page' : undefined} className={`flex flex-col items-center gap-1 px-2 py-1 text-[10px] ${selected ? 'text-[#fa4b78]' : 'text-white/50'}`}><Icon size={17} />{label === 'Unified Library' ? 'Library' : label === 'Provider Connections' ? 'Services' : label}</a>;
        })}
      </nav>

      <PlaybackEngine />
      <footer className="glass fixed inset-x-0 bottom-0 z-30 border-x-0 border-b-0 px-3 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 md:w-1/3">
            <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/10 sm:h-12 sm:w-12">
              {activeTrack ? <img src={activeTrack.coverUrl} alt="" className="h-full w-full object-cover" /> : <Disc3 size={19} className="text-white/35" />}
            </div>
            <div className="min-w-0">{activeTrack ? <><p className="truncate text-sm font-medium">{activeTrack.title}</p><p className="truncate text-xs text-white/45">{activeTrack.artist}</p></> : <><p className="text-sm font-medium">Nothing playing</p><p className="text-xs text-white/45">Choose a track to begin</p></>}</div>
            {activeTrack && <span className="hidden rounded-full bg-white/[.07] px-2 py-1 text-[9px] uppercase tracking-wider text-white/50 lg:inline">{activeTrack.provider}</span>}
          </div>
          <div className="flex flex-1 flex-col items-center gap-2">
            <div className="flex items-center gap-3 sm:gap-5">
              <button onClick={toggleShuffle} aria-label="Toggle shuffle" aria-pressed={shuffle} className={`hidden transition hover:text-white sm:block ${shuffle ? 'text-[#fa4b78]' : 'text-white/45'}`}><Shuffle size={16} /></button>
              <button onClick={playPrevious} aria-label="Previous track" className="text-white/65 hover:text-white"><SkipBack size={18} fill="currentColor" /></button>
              <button onClick={togglePlayback} disabled={!activeTrack} aria-label={isPlaying ? 'Pause' : 'Play'} className="grid h-9 w-9 place-items-center rounded-full bg-white text-black transition hover:scale-105 disabled:opacity-40 sm:h-10 sm:w-10">{isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button>
              <button onClick={playNext} aria-label="Next track" className="text-white/65 hover:text-white"><SkipForward size={18} fill="currentColor" /></button>
              <button onClick={cycleRepeat} aria-label={`Repeat ${repeat}`} aria-pressed={repeat !== 'off'} className={`hidden transition hover:text-white sm:block ${repeat !== 'off' ? 'text-[#fa4b78]' : 'text-white/45'}`}><Repeat size={16} /><span className="sr-only">{repeat}</span></button>
            </div>
            <div className="hidden w-full max-w-lg items-center gap-3 sm:flex">
              <span className="w-9 text-right text-[10px] tabular-nums text-white/40">{formatTime(progress)}</span>
              <input aria-label="Playback progress" type="range" min={0} max={Math.max(duration, 1)} value={Math.min(progress, duration)} onChange={(event) => seek(Number(event.target.value))} disabled={!activeTrack} className="h-1 w-full cursor-pointer accent-[#fa4b78] disabled:cursor-default" />
              <span className="w-9 text-[10px] tabular-nums text-white/40">{formatTime(duration)}</span>
            </div>
          </div>
          <div className="hidden w-1/3 items-center justify-end gap-3 text-white/50 md:flex"><Volume2 size={17} /><input aria-label="Volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="w-24 cursor-pointer accent-[#fa4b78]" /></div>
        </div>
      </footer>
    </div>
  );
}
