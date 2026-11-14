'use client';

import { useMemo, useState } from 'react';
import { Headphones, Heart, Play, Search } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { demoTracks } from '@/lib/music/demo-tracks';
import type { ProviderType, Track } from '@/types/music';
import { usePlayerStore } from '@/store/usePlayerStore';

const providers: { id: ProviderType | 'all'; label: string }[] = [
  { id: 'all', label: 'All music' }, { id: 'spotify', label: 'Spotify' },
  { id: 'apple', label: 'Apple Music' }, { id: 'youtube', label: 'YouTube Music' },
];

function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function HomePage() {
  const [activeFilter, setActiveFilter] = useState<ProviderType | 'all'>('all');
  const [query, setQuery] = useState('');
  const play = usePlayerStore((state) => state.play);
  const activeTrack = usePlayerStore((state) => state.activeTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const setActiveProvider = usePlayerStore((state) => state.setActiveProvider);
  const tracks = useMemo(() => demoTracks.filter((track) => {
    const matchesProvider = activeFilter === 'all' || track.provider === activeFilter;
    const matchesSearch = `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(query.toLowerCase());
    return matchesProvider && matchesSearch;
  }), [activeFilter, query]);
  const startTrack = (track: Track) => play(track, demoTracks);

  return <AppShell>
    <section id="home" className="min-h-full">
      <header className="mb-8 flex items-center justify-between gap-4 md:mb-12">
        <div id="search" className="relative w-full max-w-md"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" /><input aria-label="Search tracks" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search songs, artists, albums..." className="w-full rounded-full border border-white/[.08] bg-black/20 py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-white/35 focus:border-white/20" /></div>
        <button aria-label="Favorites" className="hidden h-11 w-11 items-center justify-center rounded-full border border-white/[.08] text-white/45 hover:text-white sm:flex"><Heart size={18} /></button>
      </header>

      <div className="mb-10 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="mb-3 text-xs font-semibold uppercase tracking-[.22em] text-[#fa4b78]">A soundtrack for you</p><h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-[-.045em] sm:text-5xl lg:text-6xl">A little more <span className="text-white/45">you</span> in every moment.</h1><p className="mt-4 max-w-lg text-sm leading-6 text-white/55">Your soundtrack, gathered from everywhere you listen.</p></div>
        <button onClick={() => tracks[0] && startTrack(tracks[0])} className="flex w-fit items-center gap-2 rounded-full bg-[#fa4b78] px-5 py-3 text-sm font-semibold shadow-lg shadow-[#fa4b78]/20 transition hover:brightness-110"><Play size={16} fill="currentColor" />Play something good</button>
      </div>

      <section id="library" className="scroll-mt-6">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold tracking-tight">Made for this moment</h2><p className="mt-1 text-sm text-white/45">A few things we think you’ll love</p></div><div className="flex gap-1 rounded-full border border-white/[.07] bg-black/20 p-1">{providers.map((provider) => <button key={provider.id} onClick={() => { setActiveFilter(provider.id); setActiveProvider(provider.id === 'all' ? null : provider.id); }} className={`rounded-full px-3 py-2 text-xs transition ${activeFilter === provider.id ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white'}`}>{provider.label}</button>)}</div></div>
        <div className="overflow-hidden rounded-[24px] border border-white/[.07] bg-black/15">
          <div className="hidden grid-cols-[minmax(220px,2fr)_minmax(120px,1fr)_110px_52px] gap-4 border-b border-white/[.07] px-5 py-3 text-[10px] font-semibold uppercase tracking-[.16em] text-white/35 sm:grid"><span>Track</span><span>Collection</span><span>Service</span><span className="text-right">Time</span></div>
          {tracks.map((track) => {
            const selected = activeTrack?.id === track.id;
            return <button key={track.id} onClick={() => startTrack(track)} className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-white/[.04] px-4 py-3 text-left transition hover:bg-white/[.04] sm:grid-cols-[minmax(220px,2fr)_minmax(120px,1fr)_110px_52px] sm:px-5 ${selected ? 'bg-white/[.045]' : ''}`}>
              <span className="flex min-w-0 items-center gap-3"><span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl shadow-lg"><img src={track.coverUrl} alt="" className="h-full w-full object-cover" />{selected && isPlaying && <span className="absolute inset-0 grid place-items-center bg-black/35"><span className="text-xs text-[#fa4b78]">♫</span></span>}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{track.title}</span><span className="mt-1 block truncate text-xs text-white/45">{track.artist}</span></span></span>
              <span className="hidden truncate text-sm text-white/60 sm:block">{track.album}</span><span className="hidden text-xs uppercase tracking-wider text-white/40 sm:block">{track.provider}</span><span className="hidden text-right text-xs tabular-nums text-white/40 sm:block">{formatDuration(track.durationMs)}</span><span className="text-white/40 sm:hidden">{track.provider}</span>
            </button>;
          })}
          {tracks.length === 0 && <div className="px-5 py-12 text-center text-sm text-white/45">No tracks match that search. Try another title or service.</div>}
        </div>
      </section>

      <section id="connections" className="mt-12 scroll-mt-6 rounded-[24px] border border-white/[.07] bg-white/[.025] p-5 sm:p-7">
        <div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#fa4b78]/15 text-[#fa4b78]"><Headphones size={20} /></span><div><h2 className="text-lg font-semibold">Provider connections</h2><p className="mt-1 max-w-xl text-sm leading-6 text-white/45">Connect Spotify, Apple Music, and YouTube Music to bring your libraries together. Provider authorization can be configured when credentials are available.</p></div></div>
        <div className="mt-5 flex flex-wrap gap-2">{providers.slice(1).map(({ id, label }) => <span key={id} className="rounded-full border border-white/[.08] px-3 py-1.5 text-xs text-white/55">{label} · Not connected</span>)}</div>
      </section>
    </section>
  </AppShell>;
}
