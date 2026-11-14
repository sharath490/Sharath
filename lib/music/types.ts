export type MusicProvider = 'spotify' | 'apple' | 'youtube';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  coverUrl: string;
  provider: MusicProvider;
  playbackUri: string;
}
