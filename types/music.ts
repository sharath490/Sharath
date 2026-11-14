export type ProviderType = 'spotify' | 'apple' | 'youtube';
export type RepeatMode = 'off' | 'one' | 'all';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  coverUrl: string;
  provider: ProviderType;
  playbackUri: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  tracks: Track[];
  provider?: ProviderType;
}
