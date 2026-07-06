import { useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { Alert, Platform } from 'react-native';

import type { MemoryAttachment, MemoryLocation, MemoryPrivacyMode, MemorySummary, MemoryVoiceNote } from '@/src/data/mock';
import { normalizeTags, normalizeVoiceNotes } from '@/src/data/normalizeDiaryFields';
import { resolvePlaceLabel } from '@/src/location/resolvePlaceLabel';
import { selectionFeedback } from '@/src/motion';
import { persistPickedImages, persistVoiceRecording } from '@/src/storage/mediaStorage';
import type { MemoryDraft } from '@/src/storage/draftTypes';
import { hasDraftContent } from '@/src/storage/draftTypes';
import { useAppLockStore } from '@/src/stores/useAppLockStore';
import { useDiaryStore } from '@/src/stores/useDiaryStore';

export type ComposerSheet = 'photos' | 'people' | 'mood' | 'format' | 'voice' | 'tags';

export type MemoryEditorInitial = {
  content?: string;
  mood?: string | null;
  personIds?: string[];
  attachments?: MemoryAttachment[];
  voiceNotes?: MemoryVoiceNote[];
  location?: MemoryLocation | null;
  privacyMode?: MemoryPrivacyMode | null;
  tags?: string[];
};

export type MemoryEditorSaveInput = {
  content: string;
  mood: string | null;
  personIds: string[];
  attachments: MemoryAttachment[];
  voiceNotes: MemoryVoiceNote[];
  isPrivate: boolean;
  privacyMode: MemoryPrivacyMode | null;
  location: MemoryLocation | null;
  tags: string[];
};

const formatTemplates = [
  { label: '标题', value: '# ' },
  { label: '小标题', value: '## ' },
  { label: '重点', value: '**文字**' },
  { label: '引用', value: '> ' },
  { label: '清单', value: '- ' },
  { label: '待办', value: '- [ ] ' },
  { label: '分隔', value: '---' },
];

function uniqueIds(personIds: string[]): string[] {
  return Array.from(new Set(personIds.filter(Boolean)));
}

function serializeEditor(input: MemoryEditorSaveInput): string {
  return JSON.stringify({
    content: input.content,
    mood: input.mood,
    personIds: input.personIds,
    attachments: input.attachments.map((attachment) => attachment.id),
    voiceNotes: input.voiceNotes.map((voice) => voice.id),
    privacyMode: input.privacyMode,
    location: input.location,
    tags: input.tags,
  });
}

function draftFromInitial(initial: MemoryEditorInitial): MemoryDraft {
  return {
    content: initial.content ?? '',
    mood: initial.mood ?? null,
    personIds: uniqueIds(initial.personIds ?? []),
    attachments: initial.attachments ?? [],
    location: initial.location ?? null,
    privacyMode: initial.privacyMode ?? null,
    tags: normalizeTags(initial.tags),
    updatedAt: new Date().toISOString(),
  };
}

export function useMemoryEditor(initial: MemoryEditorInitial = {}, tagSource: MemorySummary[] = []) {
  const people = useDiaryStore((state) => state.people);
  const appLockEnabled = useAppLockStore((state) => state.appLockEnabled);
  const initialRef = useRef<MemoryEditorInitial>(initial);
  const [content, setContent] = useState(initial.content ?? '');
  const [mood, setMood] = useState<string | null>(initial.mood ?? null);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>(() => uniqueIds(initial.personIds ?? []));
  const [attachments, setAttachments] = useState<MemoryAttachment[]>(initial.attachments ?? []);
  const [voiceNotes, setVoiceNotes] = useState<MemoryVoiceNote[]>(() => normalizeVoiceNotes(initial.voiceNotes));
  const [location, setLocation] = useState<MemoryLocation | null>(initial.location ?? null);
  const [privacyMode, setPrivacyMode] = useState<MemoryPrivacyMode | null>(initial.privacyMode ?? null);
  const [tags, setTags] = useState<string[]>(() => normalizeTags(initial.tags));
  const [activeSheet, setActiveSheet] = useState<ComposerSheet | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const nativeRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const nativeRecordStartedAt = useRef<number | null>(null);

  const selectedPeople = selectedPersonIds
    .map((id) => people.find((person) => person.id === id))
    .filter((person): person is NonNullable<typeof person> => Boolean(person));
  const isPrivate = privacyMode !== null;
  const privacyLabel = privacyMode === 'hidden' ? '完全隐藏' : privacyMode === 'masked' ? '隐藏正文' : '私密';
  const canSave = content.trim().length > 0 || attachments.length > 0 || voiceNotes.length > 0;
  const allTagOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const memory of tagSource) {
      for (const tag of normalizeTags(memory.tags)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN'))
      .map(([tag]) => tag);
  }, [tagSource]);
  const tagSuggestions = allTagOptions.filter((tag) => !tags.includes(tag));

  const saveInput: MemoryEditorSaveInput = {
    content,
    mood,
    personIds: selectedPersonIds,
    attachments,
    voiceNotes,
    isPrivate,
    privacyMode,
    location,
    tags,
  };
  const initialSaveInput: MemoryEditorSaveInput = {
    content: initialRef.current.content ?? '',
    mood: initialRef.current.mood ?? null,
    personIds: uniqueIds(initialRef.current.personIds ?? []),
    attachments: initialRef.current.attachments ?? [],
    voiceNotes: normalizeVoiceNotes(initialRef.current.voiceNotes),
    isPrivate: Boolean(initialRef.current.privacyMode),
    privacyMode: initialRef.current.privacyMode ?? null,
    location: initialRef.current.location ?? null,
    tags: normalizeTags(initialRef.current.tags),
  };
  const dirty = serializeEditor(saveInput) !== serializeEditor(initialSaveInput);

  const openSheet = (sheet: ComposerSheet) => {
    void selectionFeedback();
    setActiveSheet(sheet);
  };

  const pickImages = async () => {
    if (attachments.length >= 9) return;
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('需要照片权限', '允许访问照片后，就能把画面记到这段记忆里。');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, 9 - attachments.length),
      quality: 0.85,
      base64: Platform.OS === 'web',
    });

    if (!result.canceled) {
      const picked = await persistPickedImages(result.assets);
      setAttachments((prev) => [...prev, ...picked].slice(0, 9));
    }
  };

  const takePhoto = async () => {
    if (attachments.length >= 9) return;
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('需要相机权限', '允许使用相机后，就能拍下你想留下的瞬间。');
        return;
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      base64: Platform.OS === 'web',
    });

    if (!result.canceled) {
      const picked = await persistPickedImages(result.assets);
      setAttachments((prev) => [...prev, ...picked].slice(0, 9));
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const insertWritingText = (template: string) => {
    void selectionFeedback();
    const prefix = content.trim().length > 0 && !content.endsWith('\n') ? '\n' : '';
    setContent(`${content}${prefix}${template}`);
    setPreviewMode(false);
    setActiveSheet(null);
  };

  const startRecording = async () => {
    void selectionFeedback();
    if (Platform.OS !== 'web') {
      try {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('需要麦克风权限', '允许访问麦克风后，就能把声音也记进这段记忆。');
          return;
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        const startedAt = Date.now();
        nativeRecordStartedAt.current = startedAt;
        nativeRecorder.record();
        setRecordingStartedAt(startedAt);
        setRecording(true);
      } catch {
        Alert.alert('无法开始录音', '请确认已经允许访问麦克风。');
      }
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      Alert.alert('浏览器不支持录音', '请使用支持麦克风录制的现代浏览器。');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const startedAt = Date.now();
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const durationMs = Math.max(1000, Date.now() - startedAt);
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setVoiceNotes((prev) => [
            ...prev,
            { id: `voice-${Date.now()}`, uri: String(reader.result ?? ''), durationMs, createdAt: new Date().toISOString() },
          ]);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((track) => track.stop());
      };
      recorderRef.current = recorder;
      setRecordingStartedAt(startedAt);
      setRecording(true);
      recorder.start();
    } catch {
      Alert.alert('无法开始录音', '请确认浏览器已经允许访问麦克风。');
    }
  };

  const stopRecording = async () => {
    void selectionFeedback();
    if (Platform.OS !== 'web') {
      try {
        await nativeRecorder.stop();
        const startedAt = nativeRecordStartedAt.current;
        const durationMs = startedAt ? Math.max(1000, Date.now() - startedAt) : 1000;
        const tempUri = nativeRecorder.uri;
        if (tempUri) {
          const uri = await persistVoiceRecording(tempUri);
          setVoiceNotes((prev) => [
            ...prev,
            { id: `voice-${Date.now()}`, uri, durationMs, createdAt: new Date().toISOString() },
          ]);
        }
      } catch {
        // 录音停止失败不阻断
      } finally {
        nativeRecordStartedAt.current = null;
        setRecording(false);
        setRecordingStartedAt(null);
      }
      return;
    }
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
    setRecordingStartedAt(null);
  };

  const pickLocation = async () => {
    void selectionFeedback();
    if (locationLoading) return;

    try {
      setLocationLoading(true);
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('需要位置权限', '允许访问位置后，就能把当前位置记到这段记忆里。');
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const label = await resolvePlaceLabel(current.coords.latitude, current.coords.longitude);
      setLocation({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        accuracy: current.coords.accuracy,
        label,
      });
    } catch {
      Alert.alert('定位失败', '暂时没拿到当前位置，请检查系统定位权限后再试。');
    } finally {
      setLocationLoading(false);
    }
  };

  const togglePrivate = () => {
    void selectionFeedback();
    if (!appLockEnabled && !isPrivate) {
      Alert.alert('先开启应用锁', '私密记忆会跟应用锁一起保护。请先在“我”里开启应用锁。', [
        { text: '知道了', style: 'cancel' },
        { text: '去开启', onPress: () => router.push('/(tabs)/me') },
      ]);
      return;
    }
    setPrivacyMode((prev) => {
      if (prev === null) return 'hidden';
      if (prev === 'hidden') return 'masked';
      return null;
    });
    setActiveSheet(null);
  };

  const togglePerson = (id: string) => {
    void selectionFeedback();
    setSelectedPersonIds((prev) => (prev.includes(id) ? prev.filter((personId) => personId !== id) : [...prev, id]));
  };

  const addTag = (value: string) => {
    const [tag] = normalizeTags([value]);
    if (!tag) return;
    void selectionFeedback();
    setTags((prev) => normalizeTags([...prev, tag]));
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    void selectionFeedback();
    setTags((prev) => prev.filter((item) => item !== tag));
  };

  const applyDraft = (draft: MemoryDraft, fallbackPersonIds: string[] = []) => {
    setContent(draft.content);
    setMood(draft.mood);
    setSelectedPersonIds(draft.personIds.length > 0 ? draft.personIds : uniqueIds(fallbackPersonIds));
    setAttachments(draft.attachments);
    setLocation(draft.location);
    setPrivacyMode(draft.privacyMode);
    setTags(draft.tags);
  };

  const resetToInitial = () => {
    const draft = draftFromInitial(initialRef.current);
    applyDraft(draft);
    setVoiceNotes(normalizeVoiceNotes(initialRef.current.voiceNotes));
  };

  const toDraft = (): MemoryDraft => ({
    content,
    mood,
    personIds: selectedPersonIds,
    attachments,
    location,
    privacyMode,
    tags,
    updatedAt: new Date().toISOString(),
  });

  return {
    people,
    content,
    setContent,
    mood,
    setMood,
    selectedPersonIds,
    selectedPeople,
    attachments,
    voiceNotes,
    location,
    previewMode,
    setPreviewMode,
    activeSheet,
    setActiveSheet,
    recording,
    recordingStartedAt,
    locationLoading,
    privacyMode,
    isPrivate,
    privacyLabel,
    tags,
    tagInput,
    setTagInput,
    tagSuggestions,
    canSave,
    dirty,
    hasDraftContent: hasDraftContent(toDraft()),
    formatTemplates,
    saveInput,
    openSheet,
    pickImages,
    takePhoto,
    removeAttachment,
    insertWritingText,
    startRecording,
    stopRecording,
    pickLocation,
    togglePrivate,
    togglePerson,
    addTag,
    removeTag,
    applyDraft,
    resetToInitial,
    toDraft,
  };
}
