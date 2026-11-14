import type { MusicProvider, Track } from '@/lib/music/types';

export const demoTracks: Track[] = [
  { id: 'afterglow', title: 'Afterglow', artist: 'Mira Sol', album: 'Soft Focus', durationMs: 218000, coverUrl: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=800&q=85', provider: 'spotify', playbackUri: 'spotify:track:demo-afterglow' },
  { id: 'blue-hour', title: 'Blue Hour', artist: 'The Satellites', album: 'Somewhere, Slowly', durationMs: 194000, coverUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=800&q=85', provider: 'apple', playbackUri: 'apple:track:demo-blue-hour' },
  { id: 'weightless', title: 'Weightless', artist: 'June Wilder', album: 'A Little More Light', durationMs: 246000, coverUrl: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=800&q=85', provider: 'youtube', playbackUri: 'youtube:video:demo-weightless' },
  { id: 'golden', title: 'Golden', artist: 'Mira Sol', album: 'Soft Focus', durationMs: 203000, coverUrl: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=800&q=85', provider: 'spotify', playbackUri: 'spotify:track:demo-golden' },
  { id: 'slow-motion', title: 'Slow Motion', artist: 'Northbound', album: 'Quietly Out There', durationMs: 232000, coverUrl: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=800&q=85', provider: 'apple', playbackUri: 'apple:track:demo-slow-motion' },
];

export type { MusicProvider, Track };
