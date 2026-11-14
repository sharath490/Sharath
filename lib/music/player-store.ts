import { create } from 'zustand';
import type { Track } from '@/lib/music/types';

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  queue: Track[];
  play: (track: Track, queue?: Track[]) => void;
  togglePlayback: () => void;
  playNext: () => void;
  playPrevious: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  queue: [],
  play: (track, queue = []) => set({ currentTrack: track, queue, isPlaying: true }),
  togglePlayback: () => {
    const { currentTrack, isPlaying } = get();
    if (currentTrack) set({ isPlaying: !isPlaying });
  },
  playNext: () => {
    const { currentTrack, queue } = get();
    if (!currentTrack || queue.length === 0) return;
    const index = queue.findIndex((track) => track.id === currentTrack.id);
    const next = queue[(index + 1 + queue.length) % queue.length];
    set({ currentTrack: next, isPlaying: true });
  },
  playPrevious: () => {
    const { currentTrack, queue } = get();
    if (!currentTrack || queue.length === 0) return;
    const index = queue.findIndex((track) => track.id === currentTrack.id);
    const previous = queue[(index - 1 + queue.length) % queue.length];
    set({ currentTrack: previous, isPlaying: true });
  },
}));
