'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Expand, ListMusic, LoaderCircle, Minimize2, Music2, Pause, Play, X } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import type { Track } from '@/types/music';

type Tab = 'queue' | 'lyrics' | 'visualizer';
type LyricLine = { timeMs: number; text: string };

function parseLrc(value: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const row of value.split(/\r?\n/)) {
    const match = row.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)$/);
    if (!match) continue;
    const fraction = (match[3] ?? '0').padEnd(3, '0').slice(0, 3);
    lines.push({ timeMs: (Number(match[1]) * 60 + Number(match[2])) * 1000 + Number(fraction), text: match[4].trim() });
  }
  return lines;
}

function formatDuration(ms: number) {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function SourceLabel({ track }: { track: Track }) {
  const name = track.provider === 'apple' ? 'Apple Music' : track.provider === 'youtube' ? 'YouTube' : 'Spotify';
  return <span className="rounded-full bg-white/[.07] px-2 py-1 text-[9px] uppercase tracking-wider text-white/45">{name}</span>;
}

export default function NowPlayingView({ open, onClose, track, isPlaying, progress }: {
  open: boolean;
  onClose: () => void;
  track: Track | null;
  isPlaying: boolean;
  progress: number;
}) {
  const [tab, setTab] = useState<Tab>('queue');
  const [expanded, setExpanded] = useState(false);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState('');
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsError, setLyricsError] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const activeLineRef = useRef<HTMLParagraphElement>(null);
  const activeTrack = usePlayerStore((state) => state.activeTrack);
  const queue = usePlayerStore((state) => state.playbackQueue);
  const play = usePlayerStore((state) => state.play);
  const reorderQueue = usePlayerStore((state) => state.reorderQueue);
  const activeIndex = useMemo(() => queue.findIndex((item) => item.id === activeTrack?.id), [activeTrack?.id, queue]);
  const highlightedLine = useMemo(() => {
    let index = -1;
    for (let i = 0; i < lyrics.length; i += 1) {
      if (lyrics[i].timeMs <= progress) index = i;
      else break;
    }
    return index;
  }, [lyrics, progress]);

  useEffect(() => {
    if (!open || !track) return;
    const controller = new AbortController();
    setLyrics([]); setPlainLyrics(''); setLyricsError(''); setLyricsLoading(true);
    const params = new URLSearchParams({ title: track.title, artist: track.artist, duration: String(Math.round(track.durationMs / 1000)) });
    fetch(`/api/lyrics?${params}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json() as { syncedLyrics?: string | null; plainLyrics?: string | null; error?: string };
        if (!response.ok) throw new Error(data.error ?? 'Lyrics could not be loaded.');
        if (data.syncedLyrics) setLyrics(parseLrc(data.syncedLyrics));
        setPlainLyrics(data.plainLyrics ?? '');
        if (!data.syncedLyrics && !data.plainLyrics) setLyricsError('No lyrics are available for this track.');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLyricsError(error instanceof Error ? error.message : 'Lyrics could not be loaded.');
      })
      .finally(() => { if (!controller.signal.aborted) setLyricsLoading(false); });
    return () => controller.abort();
  }, [open, track?.id, track?.title, track?.artist, track?.durationMs]);

  useEffect(() => {
    activeLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightedLine, tab]);
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setExpanded(false); onClose(); } };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;
  const tabs: Array<{ id: Tab; label: string; icon: typeof ListMusic }> = [
    { id: 'queue', label: 'Up Next', icon: ListMusic },
    { id: 'lyrics', label: 'Lyrics', icon: Music2 },
    { id: 'visualizer', label: 'Visualizer', icon: Expand },
  ];

  return <div className="fixed inset-0 z-[70]">
    <button aria-label="Close now playing" className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
    <section role="dialog" aria-modal="true" aria-label="Now Playing" className={`now-playing-panel glass absolute right-0 top-0 flex h-full w-full flex-col overflow-hidden border-y-0 border-r-0 shadow-2xl transition-all duration-300 ${expanded ? 'max-w-none' : 'max-w-[620px]'}`}>
      <header className="flex shrink-0 items-center justify-between border-b border-white/[.07] px-5 py-4 sm:px-7">
        <div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#fa4b78]">Now Playing</p><p className="mt-1 text-xs text-white/40">{track ? `${track.provider} · ${isPlaying ? 'Playing' : 'Paused'}` : 'Nothing selected'}</p></div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? 'Use drawer view' : 'Expand full screen'} className="hidden rounded-full p-2 text-white/55 hover:bg-white/10 hover:text-white sm:block">{expanded ? <Minimize2 size={17} /> : <Expand size={17} />}</button>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-white/55 hover:bg-white/10 hover:text-white"><X size={18} /></button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-8 sm:px-7">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center py-7 sm:py-9">
          <div className="now-playing-art relative aspect-square w-[min(68vw,330px)] overflow-hidden rounded-[26px] bg-white/[.06] shadow-[0_24px_70px_rgba(0,0,0,.45)] sm:w-[min(48vh,360px)]">
            {track?.coverUrl ? <img src={track.coverUrl} alt={`${track.album} cover`} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-white/25"><Music2 size={52} /></div>}
          </div>
          <div className="mt-5 flex w-full max-w-[420px] items-center justify-between gap-4">
            <div className="min-w-0"><h2 className="truncate text-lg font-semibold">{track?.title ?? 'Nothing playing'}</h2><p className="mt-1 truncate text-sm text-white/50">{track?.artist ?? 'Choose a track to begin'}</p></div>
            {track && <SourceLabel track={track} />}
          </div>
        </div>

        <div className="sticky top-0 z-10 -mx-5 border-y border-white/[.07] bg-[#101119]/90 px-5 backdrop-blur-xl sm:-mx-7 sm:px-7">
          <div className="mx-auto flex max-w-2xl gap-2" role="tablist" aria-label="Now Playing views">
            {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-xs transition ${tab === id ? 'border-[#fa4b78] text-white' : 'border-transparent text-white/45 hover:text-white/80'}`}><Icon size={15} />{label}</button>)}
          </div>
        </div>

        <div className="mx-auto w-full max-w-2xl flex-1 py-5">
          {tab === 'queue' && <section aria-label="Up Next queue">
            <div className="mb-4 flex items-end justify-between"><div><h3 className="text-base font-semibold">Up Next</h3><p className="mt-1 text-xs text-white/40">Drag tracks to reorder · mixed providers supported</p></div><span className="text-xs text-white/35">{queue.length} tracks</span></div>
            {queue.length === 0 ? <p className="rounded-2xl border border-white/[.07] p-6 text-center text-sm text-white/40">Your queue is empty.</p> : <ol className="space-y-1">
              {queue.map((item, index) => {
                const current = item.id === activeTrack?.id;
                return <li key={`${item.provider}:${item.id}`} draggable onDragStart={(event) => { setDragIndex(index); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index)); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const from = dragIndex ?? Number(event.dataTransfer.getData('text/plain')); reorderQueue(from, index); setDragIndex(null); }} onDragEnd={() => setDragIndex(null)} className={`group flex items-center gap-3 rounded-xl px-2 py-2 transition ${current ? 'bg-white/[.07]' : 'hover:bg-white/[.04]'} ${dragIndex === index ? 'opacity-40' : ''}`}>
                  <span className="w-5 text-center text-[10px] text-white/30">{current && isPlaying ? '♫' : index + 1}</span>
                  <button type="button" onClick={() => play(item, queue)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white/[.07]">{item.coverUrl ? <img src={item.coverUrl} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center"><Music2 size={15} /></span>}</span>
                    <span className="min-w-0 flex-1"><span className={`block truncate text-sm ${current ? 'font-medium text-[#fa4b78]' : 'text-white/85'}`}>{item.title}</span><span className="mt-0.5 block truncate text-xs text-white/40">{item.artist}</span></span>
                  </button>
                  <SourceLabel track={item} />
                  <span className="hidden w-9 text-right text-[10px] tabular-nums text-white/35 sm:block">{formatDuration(item.durationMs)}</span>
                  <div className="flex flex-col opacity-50 transition group-hover:opacity-100"><button type="button" aria-label={`Move ${item.title} up`} disabled={index === 0} onClick={() => reorderQueue(index, index - 1)} className="rounded p-0.5 hover:bg-white/10 disabled:opacity-20"><ArrowUp size={13} /></button><button type="button" aria-label={`Move ${item.title} down`} disabled={index === queue.length - 1} onClick={() => reorderQueue(index, index + 1)} className="rounded p-0.5 hover:bg-white/10 disabled:opacity-20"><ArrowDown size={13} /></button></div>
                </li>;
              })}
            </ol>}
            <p className="mt-5 border-t border-white/[.06] pt-4 text-xs text-white/35">{activeIndex >= 0 ? `${Math.max(0, queue.length - activeIndex - 1)} tracks after the current song` : 'Queue your favorite tracks from any connected service.'}</p>
          </section>}

          {tab === 'lyrics' && <section aria-label="Synced lyrics" className="min-h-[250px]">
            <div className="mb-5"><h3 className="text-base font-semibold">Synced Lyrics</h3><p className="mt-1 text-xs text-white/40">Lyrics provided by LRCLIB</p></div>
            {lyricsLoading && <div className="flex items-center gap-2 py-8 text-sm text-white/45"><LoaderCircle size={16} className="animate-spin" />Finding lyrics…</div>}
            {!lyricsLoading && lyricsError && <p className="rounded-2xl border border-white/[.07] px-5 py-8 text-center text-sm text-white/40">{lyricsError}</p>}
            {!lyricsLoading && lyrics.length > 0 && <div className="lyrics-scroll max-h-[45vh] overflow-y-auto py-[18vh] text-center">{lyrics.map((line, index) => <p key={`${line.timeMs}-${index}`} ref={index === highlightedLine ? activeLineRef : null} className={`lyrics-line py-2 text-lg font-medium transition-all duration-300 ${index === highlightedLine ? 'scale-105 text-white' : 'text-white/30'}`}>{line.text || '♪'}</p>)}</div>}
            {!lyricsLoading && !lyricsError && lyrics.length === 0 && plainLyrics && <pre className="whitespace-pre-wrap py-4 text-center text-base leading-8 text-white/70">{plainLyrics}</pre>}
          </section>}

          {tab === 'visualizer' && <section className="flex min-h-[280px] flex-col items-center justify-center text-center">
            <h3 className="text-base font-semibold">Audio Visualizer</h3><p className="mt-1 text-xs text-white/40">A subtle listening pulse</p>
            <div className={`visualizer-large mt-12 ${isPlaying ? 'is-playing' : ''}`} aria-label={isPlaying ? 'Visualizer active' : 'Visualizer paused'} role="img">{Array.from({ length: 42 }, (_, index) => <i key={index} style={{ '--bar-index': index } as React.CSSProperties} />)}</div>
            <p className="mt-10 max-w-sm text-xs leading-5 text-white/35">Animation is visual feedback only; actual audio analysis depends on the provider playback SDK.</p>
          </section>}
        </div>
      </div>
      <div className="sr-only" aria-live="polite">{track ? `Now playing ${track.title} by ${track.artist}` : 'No track playing'}</div>
    </section>
  </div>;
}
