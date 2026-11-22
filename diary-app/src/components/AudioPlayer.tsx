import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './text';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pause, Play, Trash2 } from 'lucide-react-native';
import type { AudioClip } from '../store/types';
import { useTheme } from '../theme/ThemeProvider';
import { fmtDuration } from '../utils/date';
import { resolveAudioUri } from '../services/audioStore';

const BARS = [0.4, 0.7, 0.5, 0.9, 0.6, 1, 0.55, 0.85, 0.45, 0.75, 0.9, 0.5, 0.65, 0.8, 0.4];

function NativeAudioPlayer({ clip, onRemove }: { clip: AudioClip; onRemove?: () => void }) {
  const player = useAudioPlayer(clip.uri);
  const status = useAudioPlayerStatus(player);
  const [error, setError] = useState(false);
  const total = Math.max(1, Math.floor(status.duration || clip.duration || 1));
  const toggle = async () => {
    try {
      if (status.playing) player.pause();
      else {
        if (status.currentTime >= total - 0.3) await player.seekTo(0);
        player.play();
      }
    } catch { setError(true); }
  };
  if (error || status.error) return <UnavailableAudio message="录音无法播放，请检查音频文件" onRemove={onRemove} />;
  return <AudioBar playing={status.playing} current={Math.floor(status.currentTime ?? 0)} total={total} onToggle={() => void toggle()} onRemove={onRemove} />;
}

function WebAudioPlayer({ clip, onRemove }: { clip: AudioClip; onRemove?: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (typeof Audio === 'undefined') { setError(true); return; }
    const audio = new Audio(clip.uri);
    audio.preload = 'metadata';
    audioRef.current = audio;
    const onTime = () => setCur(Math.floor(audio.currentTime));
    const onEnd = () => { setPlaying(false); setCur(0); };
    const onError = () => { setPlaying(false); setError(true); };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('error', onError);
    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('error', onError);
      audio.removeAttribute('src');
      audio.load();
      audioRef.current = null;
    };
  }, [clip.uri]);
  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else {
      if (audio.ended) audio.currentTime = 0;
      void audio.play().then(() => setPlaying(true)).catch(() => { setPlaying(false); setError(true); });
    }
  };
  if (error) return <UnavailableAudio message="录音无法播放，请检查音频文件" onRemove={onRemove} />;
  return <AudioBar playing={playing} current={cur} total={Math.max(1, clip.duration)} onToggle={toggle} onRemove={onRemove} />;
}

function UnavailableAudio({ message, onRemove }: { message: string; onRemove?: () => void }) {
  const { c, fs } = useTheme();
  return <View style={{ backgroundColor: c.cardAlt, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <Text style={{ flex: 1, color: c.textSub, fontSize: fs(12.5) }}>{message}</Text>
    {onRemove && <Pressable accessibilityRole="button" accessibilityLabel="移除录音" onPress={onRemove} hitSlop={8}><Trash2 size={17} color={c.textMuted} /></Pressable>}
  </View>;
}

function AudioBar({ playing, current, total, onToggle, onRemove }: { playing: boolean; current: number; total: number; onToggle: () => void; onRemove?: () => void }) {
  const { c, fs } = useTheme();
  const ratio = Math.min(1, current / Math.max(1, total));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.cardAlt, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider, gap: 10 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={playing ? '暂停录音' : '播放录音'} onPress={onToggle} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
        {playing ? <Pause size={16} color="#fff" fill="#fff" /> : <Play size={16} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />}
      </Pressable>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3, height: 24 }}>
        {BARS.map((h, i) => {
          const active = i / BARS.length <= ratio;
          return <View key={i} style={{ flex: 1, height: Math.round(h * 20), borderRadius: 2, backgroundColor: active ? c.primary : c.border }} />;
        })}
      </View>
      <Text style={{ fontSize: fs(12), color: c.textSub, fontVariant: ['tabular-nums'] }}>
        {playing ? fmtDuration(current) : fmtDuration(total)}
      </Text>
      {onRemove && (
        <Pressable hitSlop={8} onPress={onRemove} style={{ padding: 4 }}>
          <Trash2 size={15} color={c.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

export function AudioClipCard({ clip, onRemove }: { clip: AudioClip; onRemove?: () => void }) {
  const [resolved, setResolved] = useState<{ original: string; uri: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    if (clip.uri.startsWith('mock:')) { setResolved({ original: clip.uri, uri: null }); return; }
    void resolveAudioUri(clip.uri).then(uri => { if (alive) setResolved({ original: clip.uri, uri }); })
      .catch(() => { if (alive) setResolved({ original: clip.uri, uri: null }); });
    return () => { alive = false; };
  }, [clip.uri]);
  if (resolved?.original !== clip.uri) return <UnavailableAudio message="正在读取录音…" onRemove={onRemove} />;
  if (!resolved.uri) return <UnavailableAudio message={clip.uri.startsWith('mock:') ? '旧版模拟录音没有音频文件' : '录音文件不在这台设备上'} onRemove={onRemove} />;
  const playable = { ...clip, uri: resolved.uri };
  return Platform.OS === 'web' ? <WebAudioPlayer key={resolved.uri} clip={playable} onRemove={onRemove} /> : <NativeAudioPlayer key={resolved.uri} clip={playable} onRemove={onRemove} />;
}
