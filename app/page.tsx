'use client';

import { useMemo, useState } from 'react';
import { Disc3, Headphones, Heart, Home, ListMusic, Music2, Pause, Play, Search, SkipBack, SkipForward, Volume2, Waves } from 'lucide-react';
import { demoTracks } from '@/lib/music/demo-tracks';
import type { MusicProvider, Track } from '@/lib/music/types';
import { usePlayerStore } from '@/lib/music/player-store';

const providers: { id: MusicProvider | 'all'; label: string }[] = [
  { id: 'all', label: 'All music' }, { id: 'spotify', label: 'Spotify' },
  { id: 'apple', label: 'Apple Music' }, { id: 'youtube', label: 'YouTube Music' },
];

function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function ProviderBadge({ provider }: { provider: MusicProvider }) {
  return <span className={`provider provider-${provider}`}>{provider === 'apple' ? 'APPLE' : provider === 'youtube' ? 'YOUTUBE' : 'SPOTIFY'}</span>;
}

export default function HomePage() {
  const [activeProvider, setActiveProvider] = useState<MusicProvider | 'all'>('all');
  const [query, setQuery] = useState('');
  const { currentTrack, isPlaying, play, togglePlayback, playNext, playPrevious } = usePlayerStore();
  const tracks = useMemo(() => demoTracks.filter((track) => {
    const matchesProvider = activeProvider === 'all' || track.provider === activeProvider;
    const matchesSearch = `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(query.toLowerCase());
    return matchesProvider && matchesSearch;
  }), [activeProvider, query]);

  const startTrack = (track: Track) => play(track, demoTracks);

  return (
    <main className="relative min-h-screen overflow-hidden bg-ink pb-28">
      {currentTrack && <div className="ambient" style={{ backgroundImage: `url(${currentTrack.coverUrl})` }} />}
      <div className="ambient-fade" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1600px] gap-5 p-4 md:p-6">
        <aside className="glass hidden w-64 shrink-0 flex-col rounded-[28px] p-5 md:flex">
          <a href="#home" className="mb-12 flex items-center gap-3 px-2 text-xl font-semibold tracking-tight"><span className="brand-mark"><Waves size={19} /></span> sonder<span className="text-accent">.</span></a>
          <p className="side-label">YOUR SPACE</p>
          <nav className="mb-9 space-y-1">
            <a className="nav-item nav-active" href="#home"><Home size={17} />Listen now</a>
            <a className="nav-item" href="#library"><Disc3 size={17} />Library</a>
            <a className="nav-item" href="#playlists"><ListMusic size={17} />Playlists</a>
          </nav>
          <p className="side-label">YOUR SERVICES</p>
          <div className="space-y-1">
            {providers.slice(1).map((provider) => <button key={provider.id} onClick={() => setActiveProvider(provider.id as MusicProvider)} className={`service-item ${activeProvider === provider.id ? 'service-active' : ''}`}><span className={`service-dot dot-${provider.id}`} />{provider.label}</button>)}
          </div>
          <div className="mt-auto rounded-2xl border border-white/[.07] bg-white/[.035] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Headphones size={16} className="text-accent" />All in one place</div>
            <p className="text-xs leading-relaxed text-muted">Connect your music services to bring your favorites together.</p>
            <button className="mt-4 w-full rounded-xl bg-white/10 py-2 text-xs font-medium transition hover:bg-white/15">Connect a service</button>
          </div>
        </aside>

        <section id="home" className="min-w-0 flex-1">
          <header className="mb-8 flex items-center justify-between gap-4 pt-1 md:mb-12">
            <div className="relative w-full max-w-md"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" /><input aria-label="Search tracks" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search songs, artists, albums..." className="glass w-full rounded-full py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-white/20" /></div>
            <button aria-label="Favorites" className="glass hidden h-11 w-11 items-center justify-center rounded-full text-muted hover:text-white sm:flex"><Heart size={18} /></button>
          </header>

          <div className="mb-10 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="mb-3 text-xs font-semibold uppercase tracking-[.22em] text-accent">SATURDAY, YOUR WAY</p><h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-[-.045em] sm:text-5xl lg:text-6xl">A little more <span className="text-white/45">you</span> in every moment.</h1><p className="mt-4 max-w-lg text-sm leading-6 text-white/55">Your soundtrack, gathered from everywhere you listen.</p></div>
            <button onClick={() => tracks[0] && startTrack(tracks[0])} className="flex w-fit items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold shadow-lg shadow-accent/20 transition hover:brightness-110"><Play size={16} fill="currentColor" />Play something good</button>
          </div>

          <div className="mb-7 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold tracking-tight">Made for this moment</h2><p className="mt-1 text-sm text-muted">A few things we think you’ll love</p></div><div className="flex gap-1 rounded-full border border-white/[.07] bg-black/20 p-1">{providers.map((provider) => <button key={provider.id} onClick={() => setActiveProvider(provider.id)} className={`filter-pill ${activeProvider === provider.id ? 'filter-active' : ''}`}>{provider.label}</button>)}</div></div>

          <div className="glass overflow-hidden rounded-[24px]">
            <div className="hidden grid-cols-[minmax(220px,2fr)_minmax(120px,1fr)_110px_52px] gap-4 border-b border-white/[.07] px-5 py-3 text-[10px] font-semibold uppercase tracking-[.16em] text-muted/80 sm:grid"><span>Track</span><span>Collection</span><span>Service</span><span className="text-right">Time</span></div>
            {tracks.map((track, index) => {
              const selected = currentTrack?.id === track.id;
              return <button key={track.id} onClick={() => startTrack(track)} className={`track-row grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 text-left sm:grid-cols-[minmax(220px,2fr)_minmax(120px,1fr)_110px_52px] sm:px-5 ${selected ? 'track-selected' : ''}`}>
                <span className="flex min-w-0 items-center gap-3"><span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl cover-shadow"><img src={track.coverUrl} alt="" className="h-full w-full object-cover" />{selected && isPlaying && <span className="absolute inset-0 grid place-items-center bg-black/35"><span className="playing-bars"><i /><i /><i /></span></span>}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{track.title}</span><span className="mt-1 block truncate text-xs text-muted">{track.artist}</span></span></span>
                <span className="hidden truncate text-sm text-white/65 sm:block">{track.album}</span><span className="hidden sm:block"><ProviderBadge provider={track.provider} /></span><span className="hidden text-right text-xs tabular-nums text-muted sm:block">{formatDuration(track.durationMs)}</span>
                <span className="text-muted sm:hidden"><ProviderBadge provider={track.provider} /></span>
                <span className="sr-only">{index + 1}</span>
              </button>;
            })}
            {tracks.length === 0 && <div className="px-5 py-12 text-center text-sm text-muted">No tracks match that search. Try another title or service.</div>}
          </div>
          <p className="mt-4 text-center text-xs text-white/35">Demo library · Connect a provider to play your own music</p>
        </section>
      </div>

      <footer className="glass fixed inset-x-0 bottom-0 z-30 border-x-0 border-b-0 px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3 md:w-1/3"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/10">{currentTrack ? <img src={currentTrack.coverUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-white/30"><Music2 size={19} /></div>}</div><div className="min-w-0">{currentTrack ? <><p className="truncate text-sm font-medium">{currentTrack.title}</p><p className="truncate text-xs text-muted">{currentTrack.artist}</p></> : <><p className="text-sm font-medium">Nothing playing</p><p className="text-xs text-muted">Choose a track to get started</p></>}</div><button aria-label="Add to favorites" className="ml-1 hidden text-muted transition hover:text-accent sm:block"><Heart size={17} /></button></div>
          <div className="flex flex-1 flex-col items-center gap-2"><div className="flex items-center gap-5"><button aria-label="Previous track" onClick={playPrevious} className="text-white/55 transition hover:text-white"><SkipBack size={18} fill="currentColor" /></button><button aria-label={isPlaying ? 'Pause' : 'Play'} onClick={currentTrack ? togglePlayback : () => startTrack(demoTracks[0])} className="grid h-10 w-10 place-items-center rounded-full bg-white text-black transition hover:scale-105">{isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button><button aria-label="Next track" onClick={playNext} className="text-white/55 transition hover:text-white"><SkipForward size={18} fill="currentColor" /></button></div><div className="hidden w-full max-w-lg items-center gap-3 sm:flex"><span className="text-[10px] tabular-nums text-muted">0:00</span><div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[28%] rounded-full bg-accent" /></div><span className="text-[10px] tabular-nums text-muted">{currentTrack ? formatDuration(currentTrack.durationMs) : '0:00'}</span></div></div>
          <div className="hidden w-1/3 items-center justify-end gap-3 text-muted md:flex"><Volume2 size={17} /><input aria-label="Volume" type="range" min="0" max="100" defaultValue="70" className="range w-24" /></div>
        </div>
      </footer>
    </main>
  );
}
