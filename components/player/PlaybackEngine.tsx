'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Eye, EyeOff } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { showPlaybackToast } from '@/components/player/PlaybackToastHost';
import type { Track } from '@/types/music';

interface YouTubePlayer {
  loadVideoById(videoId: string, startSeconds?: number): void;
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
  seek(milliseconds: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  addListener(event: string, callback: (data: any) => void): void;
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
    MusicKit?: { configure(options: { developerToken: string; app: { name: string; build: string } }): MusicKitInstance };
  }
}

function loadScript(src: string, id: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing?.dataset.loaded === 'true') { resolve(); return; }
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', () => { script.dataset.loaded = 'true'; resolve(); }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Could not load ${id}`)), { once: true });
    if (!existing) { script.id = id; script.src = src; script.async = true; document.head.appendChild(script); }
  });
}

function youtubeId(track: Track) {
  return track.playbackUri.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/))([\w-]{11})/i)?.[1]
    ?? track.id.match(/(?:youtube:)?([\w-]{11})$/)?.[1] ?? null;
}
function spotifyTrackId(track: Track) {
  return track.playbackUri.match(/spotify:track:([\w]+)/)?.[1] ?? track.id.replace(/^spotify:/, '');
}
function appleSongId(track: Track) { return track.id.replace(/^apple:/, ''); }
function spotifyDeepLink(track: Track) { return `https://open.spotify.com/track/${encodeURIComponent(spotifyTrackId(track))}`; }

export default function PlaybackEngine({ spotifyAccessToken }: { spotifyAccessToken?: string }) {
  const youtubeElement = useRef<HTMLDivElement>(null);
  const youtubePlayer = useRef<YouTubePlayer | null>(null);
  const spotifyPlayer = useRef<SpotifyPlayer | null>(null);
  const spotifyDeviceId = useRef<string | null>(null);
  const appleMusic = useRef<MusicKitInstance | null>(null);
  const previewAudio = useRef<HTMLAudioElement | null>(null);
  const failedTrackIds = useRef(new Set<string>());
  const [readyVersion, setReadyVersion] = useState(0);
  const [status, setStatus] = useState('Preparing music players…');
  const [handoffUrl, setHandoffUrl] = useState('');
  const [showVideo, setShowVideo] = useState(true);

  const activeTrack = usePlayerStore((state) => state.activeTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const progress = usePlayerStore((state) => state.progress);
  const seekRevision = usePlayerStore((state) => state.seekRevision);
  const volume = usePlayerStore((state) => state.volume);
  const setProgress = usePlayerStore((state) => state.setProgress);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);

  const skipUnavailable = useCallback((track: Track, message: string) => {
    const state = usePlayerStore.getState();
    if (state.activeTrack?.id !== track.id || failedTrackIds.current.has(track.id)) return;
    failedTrackIds.current.add(track.id);
    showPlaybackToast(message);
    const index = state.playbackQueue.findIndex((item) => item.id === track.id);
    let next: Track | undefined;
    for (let offset = 1; offset < state.playbackQueue.length; offset += 1) {
      const candidate = state.playbackQueue[(Math.max(index, 0) + offset) % state.playbackQueue.length];
      if (candidate.id !== track.id && !failedTrackIds.current.has(candidate.id)) { next = candidate; break; }
    }
    if (next) {
      setStatus(`Skipping unavailable track · next: ${next.title}`);
      usePlayerStore.setState({ activeTrack: next, activeProvider: next.provider, progress: 0, isPlaying: true });
    } else {
      setStatus('No other playable tracks remain in the queue.');
      setIsPlaying(false);
    }
  }, [setIsPlaying]);

  const pauseAll = useCallback(async () => {
    try { youtubePlayer.current?.pauseVideo(); } catch { /* SDK may be initializing. */ }
    try { await spotifyPlayer.current?.pause(); } catch { /* Device may have disconnected. */ }
    try { appleMusic.current?.player.pause(); } catch { /* MusicKit may not be authorized. */ }
    previewAudio.current?.pause();
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
          onError: (event: { data: number }) => {
            const track = usePlayerStore.getState().activeTrack;
            if (!track || track.provider !== 'youtube') return;
            const message = event.data === 101 || event.data === 150
              ? 'This video does not allow embedded playback. Skipping to the next playable track.'
              : event.data === 100
                ? 'This video is unavailable, private, or restricted in your region. Skipping to the next playable track.'
                : 'YouTube could not play this video. Skipping to the next playable track.';
            skipUnavailable(track, message);
          },
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
      const player = new window.Spotify.Player({ name: 'Sonder Web Player', getOAuthToken: (callback) => callback(spotifyAccessToken), volume: usePlayerStore.getState().volume });
      player.addListener('ready', ({ device_id }: { device_id: string }) => { spotifyDeviceId.current = device_id; setStatus('Spotify Web Player ready'); notifyReady(); });
      player.addListener('not_ready', () => { spotifyDeviceId.current = null; });
      player.addListener('initialization_error', ({ message }: { message: string }) => setStatus(`Spotify SDK: ${message}`));
      player.addListener('authentication_error', () => showPlaybackToast('Your Spotify session expired. Reconnect Spotify to continue.'));
      player.addListener('account_error', () => showPlaybackToast('Spotify Web Playback requires a Premium subscription.'));
      player.addListener('player_state_changed', (state: { position: number; paused: boolean } | null) => { if (state) { setProgress(state.position); setIsPlaying(!state.paused); } });
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
    void Promise.allSettled([initYouTube(), initSpotify(), initAppleMusic()]).then((results) => {
      if (!disposed && results.every((result) => result.status === 'rejected')) setStatus('Players unavailable. Check your connection and provider setup.');
    });
    return () => {
      disposed = true;
      void pauseAll();
      youtubePlayer.current?.destroy();
      spotifyPlayer.current?.disconnect();
      youtubePlayer.current = null; spotifyPlayer.current = null; appleMusic.current = null;
    };
  }, [pauseAll, setIsPlaying, setProgress, skipUnavailable, spotifyAccessToken]);

  useEffect(() => {
    if (!activeTrack || !isPlaying) { void pauseAll(); return; }
    let cancelled = false;
    const track = activeTrack;
    setHandoffUrl('');
    setStatus(`Loading ${track.provider}…`);
    const startTrack = async () => {
      await pauseAll();
      if (cancelled) return;
      const current = usePlayerStore.getState();
      if (track.provider === 'youtube') {
        const id = youtubeId(track);
        if (!id || !youtubePlayer.current) { setStatus('YouTube is still loading or this track has no playable video ID.'); return; }
        youtubePlayer.current.setVolume(Math.round(current.volume * 100));
        youtubePlayer.current.loadVideoById(id, current.progress / 1000);
        setStatus('Loading video from YouTube…');
        return;
      }
      if (track.provider === 'apple') {
        if (!appleMusic.current) { skipUnavailable(track, 'Apple Music is unavailable. Check setup or choose another track.'); return; }
        try {
          await appleMusic.current.authorize();
          await appleMusic.current.player.setQueue({ song: appleSongId(track) });
          appleMusic.current.player.volume = current.volume;
          await appleMusic.current.player.play();
          setStatus('Playing through Apple Music');
        } catch (error) {
          const detail = error instanceof Error ? error.message : '';
          const regionLocked = /region|territor|country|storefront|not available/i.test(detail);
          skipUnavailable(track, regionLocked
            ? 'This Apple Music track is not available in your region. Skipping to the next playable track.'
            : 'Apple Music could not play this track. Check your subscription or authorization; skipping to the next playable track.');
        }
        return;
      }

      let premiumRequired = false;
      if (spotifyAccessToken && spotifyPlayer.current && spotifyDeviceId.current) {
        try {
          const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(spotifyDeviceId.current)}`, {
            method: 'PUT', headers: { Authorization: `Bearer ${spotifyAccessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ uris: [`spotify:track:${spotifyTrackId(track)}`], position_ms: current.progress }),
          });
          if (response.ok || response.status === 204) { setStatus('Playing through Spotify'); return; }
          if (response.status === 401) showPlaybackToast('Your Spotify session expired. Reconnect Spotify to continue.');
          if (response.status === 403) { premiumRequired = true; showPlaybackToast('Spotify Web Playback requires Premium. Trying an available preview or skipping ahead.'); }
        } catch { /* Use preview or queue fallback. */ }
      }
      if (track.previewUrl) {
        const audio = previewAudio.current ?? new Audio();
        previewAudio.current = audio;
        audio.src = track.previewUrl;
        audio.volume = current.volume;
        audio.currentTime = Math.min(current.progress / 1000, 29.5);
        audio.ontimeupdate = () => setProgress(audio.currentTime * 1000);
        audio.onended = () => {
          const latest = usePlayerStore.getState();
          if (latest.repeat === 'one') { audio.currentTime = 0; void audio.play(); }
          else latest.playNext();
        };
        try { await audio.play(); setStatus('Playing Spotify preview'); return; }
        catch { /* Preview unavailable; skip. */ }
      }
      if (premiumRequired) {
        skipUnavailable(track, 'This track requires Spotify Premium for playback and has no playable preview. Skipping to the next playable track.');
      } else {
        setHandoffUrl(spotifyDeepLink(track));
        skipUnavailable(track, 'Spotify playback is unavailable for this track. Skipping to the next playable track. Use the Spotify link if you want to open it there.');
      }
    };
    void startTrack();
    return () => { cancelled = true; };
  }, [activeTrack?.id, isPlaying, readyVersion, spotifyAccessToken, pauseAll, setProgress, skipUnavailable]);

  useEffect(() => {
    if (activeTrack?.provider === 'youtube' && youtubePlayer.current) youtubePlayer.current.setVolume(Math.round(volume * 100));
    if (activeTrack?.provider === 'spotify' && spotifyPlayer.current) void spotifyPlayer.current.setVolume(volume);
    if (activeTrack?.provider === 'apple' && appleMusic.current) appleMusic.current.player.volume = volume;
    if (activeTrack?.provider === 'spotify' && previewAudio.current) previewAudio.current.volume = volume;
  }, [activeTrack?.provider, volume]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const state = usePlayerStore.getState();
      const track = state.activeTrack;
      if (!track || !state.isPlaying) return;
      if (track.provider === 'youtube' && youtubePlayer.current) {
        const currentTime = youtubePlayer.current.getCurrentTime();
        const duration = youtubePlayer.current.getDuration();
        if (Number.isFinite(currentTime)) setProgress(currentTime * 1000);
        if (Number.isFinite(duration) && duration > 0 && Math.abs(duration * 1000 - track.durationMs) > 1500) usePlayerStore.setState({ activeTrack: { ...track, durationMs: duration * 1000 } });
      } else if (track.provider === 'apple' && appleMusic.current) {
        const player = appleMusic.current.player;
        if (Number.isFinite(player.currentPlaybackTime)) setProgress(player.currentPlaybackTime * 1000);
        if (Number.isFinite(player.currentPlaybackDuration) && player.currentPlaybackDuration > 0) usePlayerStore.setState((stateNow) => stateNow.activeTrack ? { activeTrack: { ...stateNow.activeTrack, durationMs: player.currentPlaybackDuration * 1000 } } : stateNow);
      } else if (track.provider === 'spotify' && previewAudio.current && !previewAudio.current.paused) setProgress(previewAudio.current.currentTime * 1000);
    }, 500);
    return () => window.clearInterval(timer);
  }, [setProgress]);

  useEffect(() => {
    if (!activeTrack) return;
    const target = progress / 1000;
    if (activeTrack.provider === 'youtube' && youtubePlayer.current) youtubePlayer.current.seekTo(target, true);
    if (activeTrack.provider === 'spotify' && spotifyPlayer.current && spotifyDeviceId.current) void spotifyPlayer.current.seek(progress).catch(() => undefined);
    if (activeTrack.provider === 'apple' && appleMusic.current) appleMusic.current.player.seekToTime(target);
    if (activeTrack.provider === 'spotify' && previewAudio.current) previewAudio.current.currentTime = Math.min(target, 30);
  }, [activeTrack?.id, seekRevision]);

  return <section className="fixed bottom-[88px] right-3 z-20 w-[min(360px,calc(100vw-24px))] rounded-2xl border border-white/10 bg-[#11121aeF] p-3 shadow-2xl backdrop-blur-xl md:bottom-24 md:right-6" aria-label="Playback engine">
    <div className="mb-2 flex items-center justify-between gap-3"><p className="truncate text-xs text-white/55" role="status">{status}</p><button type="button" onClick={() => setShowVideo((shown) => !shown)} className="shrink-0 rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white" aria-label={showVideo ? 'Use compact video player' : 'Show video player'}>{showVideo ? <EyeOff size={15} /> : <Eye size={15} />}</button></div>
    <div className={`overflow-hidden rounded-xl bg-black ${showVideo ? 'h-[180px]' : 'h-10'}`}><div ref={youtubeElement} className={showVideo ? 'h-[180px] w-full' : 'h-10 w-full'} />{!showVideo && <p className="pointer-events-none -mt-7 text-center text-[10px] text-white/45">Video minimized · audio playback continues</p>}</div>
    {handoffUrl && <a href={handoffUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15"><ExternalLink size={14} />Open in Spotify</a>}
  </section>;
}
