'use client';

import { create } from 'zustand';
import type { ProviderType, RepeatMode, Track } from '@/types/music';

interface PlayerState {
  activeTrack: Track | null;
  playbackQueue: Track[];
  isPlaying: boolean;
  progress: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  activeProvider: ProviderType | null;
  play: (track: Track, queue?: Track[]) => void;
  togglePlayback: () => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setProgress: (progressMs: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  seek: (progressMs: number) => void;
  setVolume: (volume: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setActiveProvider: (provider: ProviderType | null) => void;
  setQueue: (queue: Track[]) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  activeTrack: null,
  playbackQueue: [],
  isPlaying: false,
  progress: 0,
  volume: 0.7,
  shuffle: false,
  repeat: 'off',
  activeProvider: null,

  play: (track, queue) => set((state) => ({
    activeTrack: track,
    playbackQueue: queue ?? (state.playbackQueue.length ? state.playbackQueue : [track]),
    isPlaying: true,
    progress: 0,
    activeProvider: track.provider,
  })),
  togglePlayback: () => {
    const { activeTrack, isPlaying } = get();
    if (activeTrack) set({ isPlaying: !isPlaying });
  },
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setProgress: (progress) => {
    const duration = get().activeTrack?.durationMs ?? Number.MAX_SAFE_INTEGER;
    set({ progress: Math.max(0, Math.min(progress, duration)) });
  },
  playNext: () => {
    const { activeTrack, playbackQueue, shuffle, repeat } = get();
    if (!activeTrack || playbackQueue.length === 0) return;
    if (repeat === 'one') {
      set({ progress: 0, isPlaying: true });
      return;
    }
    const index = playbackQueue.findIndex((track) => track.id === activeTrack.id);
    if (shuffle && playbackQueue.length > 1) {
      const candidates = playbackQueue.filter((track) => track.id !== activeTrack.id);
      const next = candidates[Math.floor(Math.random() * candidates.length)];
      set({ activeTrack: next, activeProvider: next.provider, progress: 0, isPlaying: true });
      return;
    }
    if (index >= playbackQueue.length - 1 && repeat !== 'all') {
      set({ isPlaying: false, progress: 0 });
      return;
    }
    const next = playbackQueue[(index + 1 + playbackQueue.length) % playbackQueue.length];
    set({ activeTrack: next, activeProvider: next.provider, progress: 0, isPlaying: true });
  },
  playPrevious: () => {
    const { activeTrack, playbackQueue, progress } = get();
    if (!activeTrack || playbackQueue.length === 0) return;
    if (progress > 3000) {
      set({ progress: 0 });
      return;
    }
    const index = playbackQueue.findIndex((track) => track.id === activeTrack.id);
    const previous = playbackQueue[(index - 1 + playbackQueue.length) % playbackQueue.length];
    set({ activeTrack: previous, activeProvider: previous.provider, progress: 0, isPlaying: true });
  },
  seek: (progress) => {
    const duration = get().activeTrack?.durationMs ?? 0;
    set({ progress: Math.max(0, Math.min(progress, duration)) });
  },
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(volume, 1)) }),
  toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),
  cycleRepeat: () => set((state) => ({
    repeat: state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off',
  })),
  setActiveProvider: (activeProvider) => set({ activeProvider }),
  setQueue: (playbackQueue) => set({ playbackQueue }),
}));
