'use client';

import { useEffect, useMemo, useState } from 'react';
import { Disc3, Music2, Play, Search as SearchIcon, Youtube } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { usePlayerStore } from '@/store/usePlayerStore';
import type { ProviderType, Track } from '@/types/music';

const filters: Array<{ id: ProviderType | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'spotify', label: 'Spotify' },
  { id: 'apple', label: 'Apple Music' },
  { id: 'youtube', label: 'YouTube' },
];

function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function SourceIcon({ provider }: { provider: ProviderType }) {
  if (provider === 'youtube') return <Youtube size={14} />;
  if (provider === 'apple') return <Disc3 size={14} />;
  return <Music2 size={14} />;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [provider, setProvider] = useState<ProviderType | 'all'>('all');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [mockedProviders, setMockedProviders] = useState<ProviderType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const play = usePlayerStore((state) => state.play);
  const activeTrack = usePlayerStore((state) => state.activeTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery) {
      setTracks([]);
      setMockedProviders([]);
      setLoading(false);
      setError('');
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { tracks?: Track[]; mockedProviders?: ProviderType[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? 'Search failed. Please try again.');
        setTracks(data.tracks ?? []);
        setMockedProviders(data.mockedProviders ?? []);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Search failed. Please try again.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debouncedQuery]);

  const visibleTracks = useMemo(() => provider === 'all' ? tracks : tracks.filter((track) => track.provider === provider), [provider, tracks]);
  const hasMockResults = mockedProviders.length > 0;

  return <AppShell>
    <section className="min-h-full" id="search">
      <header className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[.2em] text-[#fa4b78]">Your music, everywhere</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Search</h1>
        <p className="mt-2 text-sm text-white/45">Find tracks across your connected music services.</p>
      </header>

      <label className="relative block max-w-2xl">
        <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
        <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Songs, artists, albums..." aria-label="Search songs, artists, and albums" className="w-full rounded-2xl border border-white/[.09] bg-black/25 py-4 pl-12 pr-4 text-sm outline-none transition placeholder:text-white/35 focus:border-white/20 focus:bg-black/35" />
      </label>

      <div className="mt-6 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by provider">
        {filters.map((filter) => <button key={filter.id} type="button" onClick={() => setProvider(filter.id)} aria-pressed={provider === filter.id} className={`rounded-full border px-4 py-2 text-xs transition ${provider === filter.id ? 'border-white/20 bg-white/10 text-white' : 'border-white/[.07] bg-black/10 text-white/50 hover:bg-white/[.06] hover:text-white'}`}>{filter.label}</button>)}
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-white/75">{debouncedQuery ? `Results for “${debouncedQuery}”` : 'Start searching to find your next favorite'}</h2>
        {loading && <span className="text-xs text-white/40" role="status">Searching…</span>}
      </div>
      {hasMockResults && <p className="mt-2 text-xs text-white/40">Demo catalog is being used for {mockedProviders.map((item) => item === 'apple' ? 'Apple Music' : item === 'youtube' ? 'YouTube' : 'Spotify').join(', ')} while those services are unavailable.</p>}
      {error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200" role="alert">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/[.07] bg-black/15">
        <div className="hidden grid-cols-[minmax(220px,2fr)_minmax(120px,1fr)_110px_60px] gap-4 border-b border-white/[.07] px-5 py-3 text-[10px] font-semibold uppercase tracking-[.16em] text-white/35 sm:grid"><span>Track</span><span>Album</span><span>Source</span><span className="text-right">Time</span></div>
        {visibleTracks.map((track) => {
          const selected = activeTrack?.id === track.id;
          return <button key={track.id} type="button" onClick={() => play(track, visibleTracks)} className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[.04] px-4 py-3 text-left transition hover:bg-white/[.04] sm:grid-cols-[minmax(220px,2fr)_minmax(120px,1fr)_110px_60px] sm:gap-4 sm:px-5 ${selected ? 'bg-white/[.045]' : ''}`}>
            <span className="flex min-w-0 items-center gap-3"><span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/[.06]">{track.coverUrl ? <img src={track.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-white/30"><Music2 size={18} /></span>}{selected && isPlaying && <span className="absolute inset-0 grid place-items-center bg-black/40 text-[#fa4b78]">♫</span>}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{track.title}</span><span className="mt-1 block truncate text-xs text-white/45">{track.artist}</span></span></span>
            <span className="hidden truncate text-sm text-white/55 sm:block">{track.album}</span>
            <span className="hidden items-center gap-2 text-xs capitalize text-white/50 sm:flex"><SourceIcon provider={track.provider} />{track.provider === 'apple' ? 'Apple Music' : track.provider === 'youtube' ? 'YouTube' : 'Spotify'}</span>
            <span className="flex items-center justify-end gap-2 text-xs tabular-nums text-white/45"><span className="sm:hidden"><SourceIcon provider={track.provider} /></span>{track.durationMs ? formatDuration(track.durationMs) : '—'}</span>
          </button>;
        })}
        {!loading && debouncedQuery && !error && visibleTracks.length === 0 && <div className="px-5 py-12 text-center text-sm text-white/45">No tracks found for this provider. Try another filter or search term.</div>}
        {!debouncedQuery && !loading && <div className="px-5 py-12 text-center text-sm text-white/40">Search results will appear here as you type.</div>}
      </div>
    </section>
  </AppShell>;
}
