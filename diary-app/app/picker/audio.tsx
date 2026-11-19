import React, { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { Mic, Pause, Play, Square } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { addEditorAudio } from '../../src/store/editorSession';
import { actions } from '../../src/store/store';
import { Button, NavBar, Screen, goBack, haptic } from '../../src/components/ui';
import { AudioClipCard } from '../../src/components/AudioPlayer';
import { useFeedback } from '../../src/components/feedback';
import { fmtDuration } from '../../src/utils/date';
import { uid } from '../../src/utils/text';
import type { AudioClip } from '../../src/store/types';

const WAVE_COUNT = 26;

/** 9. 录音记录页（1:1 复刻设计稿2 #9） */
export default function AudioRecorderScreen() {
  const { c, fs } = useTheme();
  const { toast } = useFeedback();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [phase, setPhase] = useState<'idle' | 'recording' | 'paused' | 'done'>('idle');
  const [sec, setSec] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array.from({ length: WAVE_COUNT }, (_, i) => 16 + ((i * 19) % 44)));
  const [clip, setClip] = useState<AudioClip | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  const webRecRef = useRef<any>(null);
  const webChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = setInterval(() => {
      setSec(v => v + 1);
      setBars(prev => prev.map((_, i) => 14 + Math.round(Math.abs(Math.sin(Date.now() / 180 + i * 0.6)) * 54)));
    }, 150);
    return () => clearInterval(timer);
  }, [phase]);

  // 计时精确按秒递增
  const exactSecRef = useRef(0);
  useEffect(() => {
    if (phase !== 'recording') return;
    const secTimer = setInterval(() => {
      exactSecRef.current += 1;
      setSec(exactSecRef.current);
    }, 1000);
    return () => clearInterval(secTimer);
  }, [phase]);

  const startRec = async () => {
    haptic('medium');
    actions.markPermissionAsked('microphone');
    exactSecRef.current = 0;
    setSec(0);
    setClip(null);

    if (Platform.OS === 'web') {
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined') {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mr = new MediaRecorder(stream);
          webChunksRef.current = [];
          mr.ondataavailable = ev => {
            if (ev.data.size > 0) webChunksRef.current.push(ev.data);
          };
          mr.start();
          webRecRef.current = { mr, stream };
          setDemoMode(false);
          setPhase('recording');
          return;
        }
      } catch {
        setDemoMode(true);
        setPhase('recording');
        toast('未检测到麦克风，已进入模拟录音模式', { type: 'info' });
        return;
      }
      setDemoMode(true);
      setPhase('recording');
      return;
    }

    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        toast('权限被拒绝', {
          type: 'denied',
          message: '你已拒绝“麦克风”权限，请开启后再录音。',
          action: { label: '去设置', onPress: () => void Linking.openSettings() },
        });
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setDemoMode(false);
      setPhase('recording');
    } catch {
      setDemoMode(true);
      setPhase('recording');
      toast('已切换为计时录音模式', { type: 'info' });
    }
  };

  const togglePause = async () => {
    haptic('light');
    if (phase === 'recording') {
      if (!demoMode) {
        if (Platform.OS === 'web' && webRecRef.current?.mr?.state === 'recording') {
          webRecRef.current.mr.pause();
        } else if (Platform.OS !== 'web') {
          recorder.pause();
        }
      }
      setPhase('paused');
    } else if (phase === 'paused') {
      if (!demoMode) {
        if (Platform.OS === 'web' && webRecRef.current?.mr?.state === 'paused') {
          webRecRef.current.mr.resume();
        } else if (Platform.OS !== 'web') {
          recorder.record();
        }
      }
      setPhase('recording');
    }
  };

  const stopRec = async () => {
    haptic('success');
    const dur = Math.max(1, exactSecRef.current);
    let uri = `mock:audio-${Date.now()}`;

    if (!demoMode) {
      if (Platform.OS === 'web' && webRecRef.current) {
        const { mr, stream } = webRecRef.current;
        uri = await new Promise<string>(resolve => {
          mr.onstop = () => {
            const blob = new Blob(webChunksRef.current, { type: 'audio/webm' });
            resolve(URL.createObjectURL(blob));
          };
          mr.stop();
          stream.getTracks().forEach((tr: MediaStreamTrack) => tr.stop());
        });
        webRecRef.current = null;
      } else if (Platform.OS !== 'web') {
        try {
          await recorder.stop();
          if (recorder.uri) uri = recorder.uri;
        } catch {}
      }
    }

    setClip({ id: uid('aud'), uri, duration: dur, createdAt: Date.now() });
    setPhase('done');
  };

  const insertIntoDiary = () => {
    if (!clip) return;
    addEditorAudio(clip);
    toast('已插入语音到日记');
    goBack();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar title="录音记录" />

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingVertical: 32 }}>
        <View />

        {/* 中央声波与计时 */}
        <View style={{ alignItems: 'center', width: '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 84, marginBottom: 28 }}>
            {bars.map((h, idx) => (
              <View
                key={idx}
                style={{
                  width: 3.5,
                  height: phase === 'recording' ? h : 14 + (idx % 4) * 6,
                  borderRadius: 2,
                  backgroundColor: phase === 'recording' ? c.primary : c.primarySoft,
                }}
              />
            ))}
          </View>

          <Text style={{ fontSize: fs(38), color: c.text, fontWeight: '300', fontVariant: ['tabular-nums'], letterSpacing: 2 }}>
            {fmtDuration(sec)}
          </Text>
          <Text style={{ fontSize: fs(13), color: c.textSub, marginTop: 10 }}>
            {phase === 'idle' ? '点击下方按钮开始录音' : phase === 'recording' ? '正在录音…' : phase === 'paused' ? '录音已暂停' : '录音完成，可试听或插入日记'}
          </Text>

          {phase === 'done' && clip && (
            <View style={{ width: '100%', marginTop: 26 }}>
              <AudioClipCard clip={clip} />
            </View>
          )}
        </View>

        {/* 底部控制区 */}
        {phase === 'idle' ? (
          <View style={{ alignItems: 'center', gap: 12 }}>
            <Pressable
              onPress={() => void startRec()}
              style={({ pressed }) => ({
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: c.primary,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: c.primaryDark,
                shadowOpacity: 0.3,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 6 },
                transform: [{ scale: pressed ? 0.94 : 1 }],
              })}
            >
              <Mic size={28} color="#fff" />
            </Pressable>
            <Text style={{ fontSize: fs(12.5), color: c.textMuted }}>轻触开始</Text>
          </View>
        ) : phase === 'done' ? (
          <View style={{ width: '100%', gap: 12 }}>
            <Button title="插入到日记" onPress={insertIntoDiary} />
            <Button title="重新录制" variant="secondary" onPress={() => void startRec()} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 36 }}>
            <Pressable
              onPress={() => void togglePause()}
              style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', shadowColor: c.primaryDark, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}
            >
              {phase === 'recording' ? <Pause size={24} color="#fff" fill="#fff" /> : <Play size={24} color="#fff" fill="#fff" style={{ marginLeft: 3 }} />}
            </Pressable>

            <Pressable
              onPress={() => void stopRec()}
              style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <Square size={18} color={c.text} fill={c.text} />
            </Pressable>
          </View>
        )}
      </View>
    </Screen>
  );
}
