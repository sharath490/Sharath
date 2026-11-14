'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Eye, EyeOff } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import type { ProviderType, Track } from '@/types/music';

interface YouTubePlayer {
  loadVideoById(videoId: string, startSeconds?: number): void;
  cueVideoById(videoId: string, startSeconds?: number): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  setVolume(volume: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
}
interface YouTubeApi {
  Player: new (element: HTMLElement, options: Record<string, unknown>) => YouTubePlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
}
interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(milliseconds: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  addListener(event: string, callback: (data: any) => void): void;
  removeListener(event: string): void;
}
interface MusicKitInstance {
  authorize(): Promise<string>;
  player: {
    setQueue(options: { song: string }): Promise<void>;
    play(): Promise<void>;
    pause(): void;
    seekToTime(seconds: number): void;
    volume: number;
    currentPlaybackTime: number;
    currentPlaybackDuration: number;
  };
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
    Spotify?: { Player: new (options: { name: string; getOAuthToken: (callback: (token: string) => void) => void; volume: number }) => SpotifyPlayer };
    onSpotifyWebPlaybackSDKReady?: () => void;
    MusicKit?: { configure(options: { developerToken: string; app: { name: string; build: string } }): MusicKitInstance; getInstance(): MusicKitInstance };
  }
}

function loadScript(src: string, id: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing?.dataset.loaded === 'true') { resolve(); return; }
    const script = existing ?? document.createElement('script');
    const onLoad = () => { script.dataset.loaded = 'true'; resolve(); };
    const onError = () => reject(new Error(`Could not load ${id}`));
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    if (!existing) {
      script.id = id;
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

function youtubeId(track: Track) {
  const fromUri = track.playbackUri.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/))([\w-]{11})/i)?.[1];
  const fromId = track.id.match(/(?:youtube:)?([\w-]{11})$/)?.[1];
  return fromUri ?? fromId ?? null;
}

function spotifyTrackId(track: Track) {
  return track.playbackUri.match(/spotify:track:([\w]+)/)?.[1] ?? track.id.replace(/^spotify:/, '');
}

function appleSongId(track: Track) {
  return track.id.replace(/^apple:/, '');
}

function spotifyDeepLink(track: Track) {
  const id = spotifyTrackId(track);
  return `https://open.spotify.com/track/${encodeURIComponent(id)}`;
}

/** Owns provider SDK lifecycles and keeps their progress/seek state in the shared player store. */
export default function PlaybackEngine({ spotifyAccessToken }: { spotifyAccessToken?: string }) {
  const youtubeElement = useRef<HTMLDivElement>(null);
  const youtubePlayer = useRef<YouTubePlayer | null>(null);
  const spotifyPlayer = useRef<SpotifyPlayer | null>(null);
  const spotifyDeviceId = useRef<string | null>(null);
  const appleMusic = useRef<MusicKitInstance | null>(null);
  const previewAudio = useRef<HTMLAudioElement | null>(null);
  const [readyVersion, setReadyVersion] = useState(0);
  const [status, setStatus] = useState('Preparing music players…');
  const [handoffUrl, setHandoffUrl] = useState('');
  const [showVideo, setShowVideo] = useState(true);

  const activeTrack = usePlayerStore((state) => state.activeTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const progress = usePlayerStore((state) => state.progress);
  const volume = usePlayerStore((state) => state.volume);
  const setProgress = usePlayerStore((state) => state.setProgress);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);

  const pauseAll = useCallback(async () => {
    try { youtubePlayer.current?.pauseVideo(); } catch { /* SDK may still be initializing. */ }
    try { await spotifyPlayer.current?.pause(); } catch { /* Device may have disconnected. */ }
    try { appleMusic.current?.player.pause(); } catch { /* MusicKit may not be authorized. */ }
    if (previewAudio.current) previewAudio.current.pause();
  }, []);

  useEffect(() => {
    let disposed = false;
    const notifyReady = () => { if (!disposed) setReadyVersion((value) => value + 1); };

    const initYouTube = async () => {
      await loadScript('https://www.youtube.com/iframe_api', 'youtube-iframe-api');
      if (!window.YT) await new Promise<void>((resolve) => {
        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(); };
        if (window.YT) resolve();
      });
      if (disposed || !window.YT || !youtubeElement.current) return;
      youtubePlayer.current = new window.YT.Player(youtubeElement.current, {
        width: '320', height: '180', videoId: '', playerVars: { playsinline: 1, controls: 1, modestbranding: 1 },
        events: {
          onReady: () => { setStatus('YouTube player ready'); notifyReady(); },
          onStateChange: (event: { data: number }) => {
            if (!window.YT) return;
            if (event.data === window.YT.PlayerState.PLAYING) setIsPlaying(true);
            if (event.data === window.YT.PlayerState.PAUSED) setIsPlaying(false);
            if (event.data === window.YT.PlayerState.ENDED) usePlayerStore.getState().playNext();
          },
          onError: () => { setStatus('This YouTube video cannot be played here. Try another result.'); setIsPlaying(false); },
        },
      });
    };

    const initSpotify = async () => {
      if (!spotifyAccessToken || !process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID) return;
      await loadScript('https://sdk.scdn.co/spotify-player.js', 'spotify-web-playback-sdk');
      if (!window.Spotify && !disposed) await new Promise<void>((resolve) => {
        const previous = window.onSpotifyWebPlaybackSDKReady;
        window.onSpotifyWebPlaybackSDKReady = () => { previous?.(); resolve(); };
      });
      if (disposed || !window.Spotify) return;
      const player = new window.Spotify.Player({
        name: 'Sonder Web Player',
        getOAuthToken: (callback) => callback(spotifyAccessToken),
        volume: usePlayerStore.getState().volume,
      });
      player.addListener('ready', ({ device_id }: { device_id: string }) => {
        spotifyDeviceId.current = device_id;
        setStatus('Spotify Web Player ready');
        notifyReady();
      });
      player.addListener('not_ready', () => { spotifyDeviceId.current = null; });
      player.addListener('initialization_error', ({ message }: { message: string }) => setStatus(`Spotify SDK: ${message}`));
      player.addListener('authentication_error', () => setStatus('Spotify session expired. Reconnect Spotify to continue.'));
      player.addListener('account_error', () => setStatus('Spotify Web Playback requires a Premium account.'));
      player.addListener('player_state_changed', (state: { position: number; paused: boolean } | null) => {
        if (!state) return;
        setProgress(state.position);
        setIsPlaying(!state.paused);
      });
      spotifyPlayer.current = player;
      await player.connect();
    };

    const initAppleMusic = async () => {
      await loadScript('https://js-cdn.music.apple.com/musickit/v3/musickit.js', 'apple-musickit-js');
      if (!window.MusicKit && !disposed) await new Promise<void>((resolve) => {
        document.addEventListener('musickitloaded', () => resolve(), { once: true });
        if (window.MusicKit) resolve();
      });
      if (disposed || !window.MusicKit) return;
      const response = await fetch('/api/apple-token', { cache: 'no-store' });
      if (!response.ok) throw new Error('Apple Music developer token is not configured');
      const { token } = await response.json() as { token: string };
      appleMusic.current = window.MusicKit.configure({ developerToken: token, app: { name: 'Sonder', build: '1.0.0' } });
      setStatus('Apple Music player ready');
      notifyReady();
    };

    Promise.allSettled([initYouTube(), initSpotify(), initAppleMusic()]).then((results) => {
      if (disposed) return;
      if (results.every((result) => result.status === 'rejected')) setStatus('Players unavailable. Check your connection and provider setup.');
    });
    return () => {
      disposed = true;
      void pauseAll();
      youtubePlayer.current?.destroy();
      spotifyPlayer.current?.disconnect();
      youtubePlayer.current = null;
      spotifyPlayer.current = null;
      appleMusic.current = null;
    };
  }, [pauseAll, setIsPlaying, setProgress, spotifyAccessToken]);

  useEffect(() => {
    if (!activeTrack || !isPlaying) { void pauseAll(); return; }
    let cancelled = false;
    setHandoffUrl('');
    setStatus(`Loading ${activeTrack.provider}…`);

    const startTrack = async () => {
      // Stop every SDK before loading another provider, including same-provider track changes.
      await pauseAll();
      if (cancelled) return;
      if (activeTrack.provider === 'youtube') {
        const id = youtubeId(activeTrack);
        if (!id || !youtubePlayer.current) { setStatus('YouTube player is still loading or the video ID is invalid.'); setIsPlaying(false); return; }
        youtubePlayer.current.loadVideoById(id, progress / 1000);
        youtubePlayer.current.setVolume(Math.round(volume * 100));
        setStatus('Playing through YouTube');
        return;
      }
      if (activeTrack.provider === 'apple') {
        if (!appleMusic.current) { setStatus('Apple Music is unavailable. Check Apple Music credentials.'); setIsPlaying(false); return; }
        try {
          // Authorization is required for catalog playback and may prompt the listener.
          await appleMusic.current.authorize();
          await appleMusic.current.player.setQueue({ song: appleSongId(activeTrack) });
          appleMusic.current.player.volume = volume;
          await appleMusic.current.player.play();
          setStatus('Playing through Apple Music');
        } catch (error) {
          setStatus(error instanceof Error ? `Apple Music playback unavailable: ${error.message}` : 'Apple Music playback unavailable.');
          setIsPlaying(false);
        }
        return;
      }

      const spotify = activeTrack;
      if (spotifyAccessToken && spotifyPlayer.current && spotifyDeviceId.current) {
        try {
          const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(spotifyDeviceId.current)}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${spotifyAccessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ uris: [`spotify:track:${spotifyTrackId(spotify)}`], position_ms: progress }),
          });
          if (response.ok || response.status === 204) { setStatus('Playing through Spotify'); return; }
          if (response.status === 401) setStatus('Spotify session expired. Reconnect Spotify to continue.');
          else if (response.status === 403) setStatus('Spotify Web Playback requires a Premium account.');
        } catch { /* Continue to preview or handoff. */ }
      }
      if (spotify.previewUrl) {
        try {
          const audio = previewAudio.current ?? new Audio();
          previewAudio.current = audio;
          audio.src = spotify.previewUrl;
          audio.volume = volume;
          audio.currentTime = Math.min(progress / 1000, 30);
          audio.on timeupdate = undefined;
        } catch { /* Assigned below without relying on an SDK preview. */ }
        const audio = previewAudio.current;
        if (audio) {
          audio.ontimeupdate = () => setProgress(audio.currentTime * 1000);
          audio.onended = () => setIsPlaying(false);
          try { await audio.play(); setStatus('Playing 30-second Spotify preview'); return; }
          catch { setStatus('Spotify preview could not start. Open the track in Spotify instead.'); }
        }
      }
      setHandoffUrl(spotifyDeepLink(spotify));
      setStatus('Open Spotify to listen to this track. Web playback needs an active Premium session.');
      setIsPlaying(false);
    };

    void startTrack();
    return () => { cancelled = true; };
  }, [activeTrack, isPlaying, readyVersion, progress, volume, pauseAll, setIsPlaying, setProgress, spotifyAccessToken]);

  useEffect(() => {
    if (activeTrack?.provider === 'youtube' && youtubePlayer.current) youtubePlayer.current.setVolume(Math.round(volume * 100));
    if (activeTrack?.provider === 'spotify' && spotifyPlayer.current) void spotifyPlayer.current.setVolume(volume);
    if (activeTrack?.provider === 'apple' && appleMusic.current) appleMusic.current.player.volume = volume;
    if (activeTrack?.provider === 'spotify' && previewAudio.current) previewAudio.current.volume = volume;
  }, [activeTrack?.provider, volume]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const track = usePlayerStore.getState().activeTrack;
      if (!track || !usePlayerStore.getState().isPlaying) return;
      if (track.provider === 'youtube' && youtubePlayer.current) {
        const current = youtubePlayer.current.getCurrentTime();
        const duration = youtubePlayer.current.getDuration();
        if (Number.isFinite(current)) setProgress(current * 1000);
        if (Number.isFinite(duration) && duration > 0 && Math.abs(duration * 1000 - track.durationMs) > 1500) {
          usePlayerStore.setState({ activeTrack: { ...track, durationMs: duration * 1000 } });
        }
      } else if (track.provider === 'apple' && appleMusic.current) {
        const player = appleMusic.current.player;
        if (Number.isFinite(player.currentPlaybackTime)) setProgress(player.currentPlaybackTime * 1000);
        if (Number.isFinite(player.currentPlaybackDuration) && player.currentPlaybackDuration > 0) {
          usePlayerStore.setState((state) => state.activeTrack ? { activeTrack: { ...state.activeTrack, durationMs: player.currentPlaybackDuration * 1000 } } : state);
        }
      } else if (track.provider === 'spotify' && previewAudio.current && !previewAudio.current.paused) {
        setProgress(previewAudio.current.currentTime * 1000);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [setProgress]);

  useEffect(() => {
    if (!activeTrack) return;
    const seconds = progress / 1000;
    if (activeTrack.provider === 'youtube' && youtubePlayer.current) youtubePlayer.current.seekTo(seconds, true);
    if (activeTrack.provider === 'spotify' && spotifyPlayer.current && spotifyDeviceId.current) void spotifyPlayer.current.seek(progress).catch(() => undefined);
    if (activeTrack.provider === 'apple' && appleMusic.current) appleMusic.current.player.seekToTime(seconds);
    if (activeTrack.provider === 'spotify' && previewAudio.current) previewAudio.current.currentTime = Math.min(seconds, 30);
  }, [activeTrack?.id, progress]);

  return (
    <section className="fixed bottom-[88px] right-3 z-20 w-[min(360px,calc(100vw-24px))] rounded-2xl border border-white/10 bg-[#11121aeF] p-3 shadow-2xl backdrop-blur-xl md:bottom-24 md:right-6" aria-label="Playback engine">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="truncate text-xs text-white/55" role="status">{status}</p>
        <button type="button" onClick={() => setShowVideo((shown) => !shown)} className="shrink-0 rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white" aria-label={showVideo ? 'Use compact video player' : 'Show video player'}>
          {showVideo ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      <div className={`overflow-hidden rounded-xl bg-black ${showVideo ? 'h-[180px]' : 'h-10'}`}>
        <div ref={youtubeElement} className={showVideo ? 'h-[180px] w-full' : 'h-10 w-full'} />
        {!showVideo && <p className="pointer-events-none -mt-7 text-center text-[10px] text-white/45">Video minimized · audio playback continues</p>}
      </div>
      {handoffUrl && <a href={handoffUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15"><ExternalLink size={14} />Open in Spotify</a>}
    </section>
  );
}
