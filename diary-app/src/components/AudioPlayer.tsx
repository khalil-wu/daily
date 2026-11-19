import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pause, Play, Trash2 } from 'lucide-react-native';
import type { AudioClip } from '../store/types';
import { useTheme } from '../theme/ThemeProvider';
import { fmtDuration } from '../utils/date';

const BARS = [0.4, 0.7, 0.5, 0.9, 0.6, 1, 0.55, 0.85, 0.45, 0.75, 0.9, 0.5, 0.65, 0.8, 0.4];

function NativeAudioPlayer({ clip, onRemove }: { clip: AudioClip; onRemove?: () => void }) {
  const isMock = clip.uri.startsWith('mock:');
  const player = useAudioPlayer(isMock ? null : clip.uri);
  const status = useAudioPlayerStatus(player);
  const [mockPlaying, setMockPlaying] = useState(false);
  const [mockElapsed, setMockElapsed] = useState(0);

  useEffect(() => {
    if (!mockPlaying) return;
    const t = setInterval(() => {
      setMockElapsed(v => {
        if (v + 1 >= clip.duration) {
          setMockPlaying(false);
          return 0;
        }
        return v + 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [mockPlaying, clip.duration]);

  const playing = isMock ? mockPlaying : status.playing;
  const cur = isMock ? mockElapsed : Math.floor(status.currentTime ?? 0);
  const total = Math.max(1, Math.floor(status.duration || clip.duration || 1));

  const toggle = () => {
    if (isMock) {
      setMockPlaying(p => !p);
      return;
    }
    if (status.playing) {
      player.pause();
    } else {
      if (status.currentTime >= total - 0.3) void player.seekTo(0);
      player.play();
    }
  };

  return <AudioBar playing={playing} current={cur} total={total} onToggle={toggle} onRemove={onRemove} />;
}

function WebAudioPlayer({ clip, onRemove }: { clip: AudioClip; onRemove?: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isMock = clip.uri.startsWith('mock:');

  useEffect(() => {
    if (isMock || typeof Audio === 'undefined') return;
    const a = new Audio(clip.uri);
    audioRef.current = a;
    const onTime = () => setCur(Math.floor(a.currentTime));
    const onEnd = () => {
      setPlaying(false);
      setCur(0);
    };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    return () => {
      a.pause();
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
    };
  }, [clip.uri, isMock]);

  useEffect(() => {
    if (!isMock || !playing) return;
    const t = setInterval(() => {
      setCur(v => {
        if (v + 1 >= clip.duration) {
          setPlaying(false);
          return 0;
        }
        return v + 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [isMock, playing, clip.duration]);

  const toggle = () => {
    if (isMock || !audioRef.current) {
      setPlaying(p => !p);
      return;
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      void audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(true));
    }
  };

  return <AudioBar playing={playing} current={cur} total={Math.max(1, clip.duration)} onToggle={toggle} onRemove={onRemove} />;
}

function AudioBar({ playing, current, total, onToggle, onRemove }: { playing: boolean; current: number; total: number; onToggle: () => void; onRemove?: () => void }) {
  const { c, fs } = useTheme();
  const ratio = Math.min(1, current / Math.max(1, total));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.cardAlt, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider, gap: 10 }}>
      <Pressable onPress={onToggle} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
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
  return Platform.OS === 'web' ? <WebAudioPlayer clip={clip} onRemove={onRemove} /> : <NativeAudioPlayer clip={clip} onRemove={onRemove} />;
}
