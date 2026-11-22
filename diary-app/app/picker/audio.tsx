import React, { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { Text } from '../../src/components/text';
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
import { storeAudio } from '../../src/services/audioStore';

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
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const sourceRef = useRef<string | null>(null);
  const mounted = useRef(true);

  const webRecRef = useRef<any>(null);
  const webChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = setInterval(() => {
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

  useEffect(() => {
    mounted.current = true;
    return () => {
    mounted.current = false;
    const active = webRecRef.current;
    if (active) {
      active.mr.ondataavailable = null;
      active.mr.onstop = null;
      if (active.mr.state !== 'inactive') active.mr.stop();
      active.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    }
    if (Platform.OS !== 'web' && recorder.isRecording) void recorder.stop().catch(() => {});
    if (sourceRef.current?.startsWith('blob:')) URL.revokeObjectURL(sourceRef.current);
    };
  }, [recorder]);

  const startRec = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    actions.markPermissionAsked('microphone');
    exactSecRef.current = 0;
    setSec(0);
    setClip(null);
    if (sourceRef.current?.startsWith('blob:')) URL.revokeObjectURL(sourceRef.current);
    sourceRef.current = null;
    try {
      if (Platform.OS === 'web') {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
          throw new Error('当前浏览器无法录音，请使用 HTTPS 页面或手机 App');
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mounted.current) { stream.getTracks().forEach(track => track.stop()); return; }
        let mr: MediaRecorder;
        try { mr = new MediaRecorder(stream); }
        catch (error) { stream.getTracks().forEach(track => track.stop()); throw error; }
        webChunksRef.current = [];
        mr.ondataavailable = event => { if (event.data.size) webChunksRef.current.push(event.data); };
        mr.start();
        webRecRef.current = { mr, stream };
      } else {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          toast('麦克风权限未开启', { type: 'denied', message: '请允许麦克风访问后再录音。', action: { label: '去设置', onPress: () => void Linking.openSettings() } });
          return;
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
      haptic('medium');
      setPhase('recording');
    } catch (error) {
      setPhase('idle');
      toast(error instanceof Error && error.message.includes('HTTPS') ? error.message : '无法开始录音，请检查麦克风权限后重试', { type: 'error' });
    } finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  };

  const togglePause = () => {
    if (busyRef.current) return;
    haptic('light');
    if (phase === 'recording') {
      if (Platform.OS === 'web') webRecRef.current?.mr.pause();
      else recorder.pause();
      setPhase('paused');
    } else if (phase === 'paused') {
      if (Platform.OS === 'web') webRecRef.current?.mr.resume();
      else recorder.record();
      setPhase('recording');
    }
  };

  const stopRec = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      let uri = '';
      if (Platform.OS === 'web' && webRecRef.current) {
        const { mr, stream } = webRecRef.current;
        try {
          uri = await new Promise<string>((resolve, reject) => {
            mr.onerror = () => reject(new Error('录音失败，请重新录制'));
            mr.onstop = () => {
              const blob = new Blob(webChunksRef.current, { type: mr.mimeType || webChunksRef.current[0]?.type || 'audio/webm' });
              if (!blob.size) reject(new Error('没有录到声音，请重新录制'));
              else resolve(URL.createObjectURL(blob));
            };
            mr.stop();
          });
        } finally {
          stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
          webRecRef.current = null;
        }
      } else if (Platform.OS !== 'web') {
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        uri = recorder.uri ?? '';
      }
      if (!uri) throw new Error('录音文件生成失败，请重新录制');
      sourceRef.current = uri;
      setClip({ id: uid('aud'), uri, duration: Math.max(1, exactSecRef.current), createdAt: Date.now() });
      setPhase('done');
      haptic('success');
    } catch (error) {
      setPhase('idle');
      toast(error instanceof Error ? error.message : '录音失败，请重试', { type: 'error' });
    } finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  };

  const insertIntoDiary = async () => {
    if (!clip || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const uri = await storeAudio(clip.id, clip.uri);
      addEditorAudio({ ...clip, uri });
      toast('录音已保存并插入日记');
      goBack();
    } catch (error) {
      toast(error instanceof Error ? error.message : '录音保存失败，请重试', { type: 'error' });
    } finally { busyRef.current = false; if (mounted.current) setBusy(false); }
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
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="开始录音"
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
            <Button title="插入到日记" loading={busy} onPress={() => void insertIntoDiary()} />
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
