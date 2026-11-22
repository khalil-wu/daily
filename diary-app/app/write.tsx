import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Easing, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../src/components/text';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AudioLines, BookOpen, Check, ChevronDown, Cloud, Eye, EyeOff,
  MapPin, Minus, RefreshCw, Smile, Sparkles, Square, Tag as TagIcon, Users,
} from 'lucide-react-native';
import { EDITOR_ICONS, PAPER_IMAGES, PAPER_THUMBS } from '../src/data/assets';
import { Image as ExpoImage } from 'expo-image';
import { AssetIcon } from '../src/components/AssetIcon';
import { useTheme } from '../src/theme/ThemeProvider';
import { actions, openTutorial, useStore } from '../src/store/store';
import type { Entry, MoodKey, PaperKey, PhotoLayout } from '../src/store/types';
import {
  getEditorDraft, markAutoSaved, startEditorSession, updateEditorDraft, useEditorDraft,
  removeEditorAudio, removeEditorPhoto, removeEditorVideo, clearEditorSession,
} from '../src/store/editorSession';
import { DAILY_PROMPTS, DEFAULT_NOTEBOOK_ID, MOODS, MOOD_ORDER, PAPERS, TEMPLATES, WEATHERS, moodMeta, moodTint, paperColors, weatherMeta } from '../src/data/constants';
import { Chip, NavBar, PillAction, Screen, TextAction, goBack, haptic } from '../src/components/ui';
import { MoodIcon, WeatherIcon } from '../src/components/MoodIcon';
import { AudioClipCard } from '../src/components/AudioPlayer';
import { VideoClipCard } from '../src/components/VideoPlayer';
import { PhotoViewer } from '../src/components/PhotoViewer';
import { PhotoLayoutView } from '../src/components/PhotoLayout';
import { RichBody } from '../src/components/RichBody';
import { RememberPanel } from '../src/components/RememberPanel';
import { useFeedback } from '../src/components/feedback';
import { DateTimeSheet } from '../src/components/DateTimeSheet';
import { HiddenAccessBoundary } from '../src/components/HiddenAccessBoundary';
import { BottomSheet, FadeIn, PopDialog, PressableScale, useReducedMotion } from '../src/components/motion';
import { setTourHandler, useTourTarget } from '../src/components/tour';
import { fmtAgo, fmtMonthDayTime, WEEK_CN } from '../src/utils/date';
import { wordCount } from '../src/utils/text';
import { continueListOnEnter, toggleTodoAtLine } from '../src/utils/richtext';
import { TextHistory } from '../src/utils/history';
import { entryForSave, hasEntryContent, insertDictation, resolveWriteNotebook } from '../src/utils/editor';
import { flushPendingState, getPersistenceError } from '../src/store/storage';
import { createDictationSession, isDictationSupported, type DictationSession } from '../src/utils/dictation';

/** 2, 3, 8, 12. 新建/编辑日记页 */
export default function WriteScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <HiddenAccessBoundary entryId={id}><WriteEditor /></HiddenAccessBoundary>;
}

function WriteEditor() {
  const params = useLocalSearchParams<{ id?: string; template?: string; date?: string; action?: string; prompt?: string; mood?: string; tour?: string; notebook?: string }>();
  const { c, t, fs, lineHeight, contentWidth, dark, r, frameInk } = useTheme();
  const { toast } = useFeedback();
  const tags = useStore(s => s.tags);
  const people = useStore(s => s.people);
  const notebooks = useStore(s => s.notebooks);
  const goals = useStore(s => s.goals);
  const account = useStore(s => s.account);
  const syncCloud = useStore(s => s.sync.cloud);
  const editorTourSeen = useStore(s => s.editorTourSeen);

  const draft = useEditorDraft();
  const [previewMode, setPreviewMode] = useState(false);
  const [exitModal, setExitModal] = useState(false);
  const [exitError, setExitError] = useState('');
  const [dateModal, setDateModal] = useState(false);
  const [nbModal, setNbModal] = useState(false);
  const [paperSheet, setPaperSheet] = useState(false);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const [promptTipIdx, setPromptTipIdx] = useState(0);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const selectionRef = useRef(selection);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const finishedRef = useRef(false);
  const lastSavedEntryRef = useRef<Entry | null>(null);
  const reducedMotion = useReducedMotion();
  const [dictating, setDictating] = useState(false);
  const [interimText, setInterimText] = useState('');
  const dictationSupported = useMemo(() => isDictationSupported(), []);
  const dictationRef = useRef<DictationSession | null>(null);
  const toggleDictationRef = useRef<() => void>(() => undefined);
  // 格式工具默认收起，只露一行附件图标（设计稿2 #3：键盘上方一条细工具栏）
  const [formatOpen, setFormatOpen] = useState(false);
  // 心情 / 天气在元信息胶囊下就地展开快选行（Daylio 式点按即得，不再跳转选择页）
  const [metaRow, setMetaRow] = useState<'mood' | 'weather' | null>(null);
  const formatAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(formatAnim, {
      toValue: formatOpen ? 1 : 0,
      duration: reducedMotion ? 0 : 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [formatOpen, formatAnim, reducedMotion]);
  // 写作导览讲到「排版」那一步之前，先把格式工具展开
  useEffect(() => {
    setTourHandler('editor.prepare', () => setFormatOpen(true));
    return () => setTourHandler('editor.prepare', null);
  }, []);
  const bodyRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const initActionRan = useRef(false);
  // 进入编辑时这篇日记原本的样子（新建则为 null），选择「不保存」时据此还原
  const originalRef = useRef<Entry | null>(null);
  // 程序改动正文后把光标放到指定位置（只生效一瞬间，随后交还给输入框）
  const [forcedSel, setForcedSel] = useState<{ start: number; end: number } | undefined>(undefined);
  const history = useRef(new TextHistory('')).current;
  const historyFor = useRef<string | null>(null);
  const [, bumpHistory] = useState(0);

  const metaTarget = useTourTarget('write.meta');
  const bodyTarget = useTourTarget('write.body');
  const formatTarget = useTourTarget('write.format');
  const attachTarget = useTourTarget('write.attach');
  const publishTarget = useTourTarget('write.publish');

  const persistCurrentDraft = useCallback(async () => {
    const current = getEditorDraft();
    if (finishedRef.current || savingRef.current || !current?.dirty || current.entry === lastSavedEntryRef.current) return;
    if (!hasEntryContent(current.entry) && !originalRef.current) {
      if (actions.snapshot().entries.some(item => item.id === current.entry.id)) {
        actions.destroyEntry(current.entry.id);
        await flushPendingState().catch(() => {});
      }
      return;
    }
    await actions.upsertEntry(entryForSave(current.entry), true);
    if (!getPersistenceError() && getEditorDraft()?.entry === current.entry) {
      lastSavedEntryRef.current = current.entry;
      markAutoSaved();
    }
  }, []);

  // 初始化编辑会话
  useEffect(() => {
    finishedRef.current = false;
    lastSavedEntryRef.current = null;
    initActionRan.current = false;
    const tpl = params.template ? TEMPLATES.find(x => x.id === params.template) : undefined;
    const promptItem = params.prompt ? DAILY_PROMPTS.find(p => p.id === params.prompt) : undefined;
    const createdAt = params.date ? Number(params.date) : undefined;
    const presetMood = MOODS.find(m => m.key === params.mood)?.key as MoodKey | undefined;
    const existing = params.id ? actions.snapshot().entries.find(e => e.id === params.id) : undefined;
    originalRef.current = existing
      ? { ...existing, tags: [...existing.tags], photos: [...existing.photos], audios: [...existing.audios], videos: [...existing.videos] }
      : null;
    startEditorSession({
      id: params.id,
      templateId: params.template,
      createdAt: Number.isFinite(createdAt) ? createdAt : undefined,
      mood: presetMood,
      notebookId: resolveWriteNotebook(params.notebook, notebooks, params.id),
      templateData: tpl
        ? { title: tpl.title, body: tpl.body, tags: tpl.tags, template: tpl.id }
        : promptItem
          ? { title: promptItem.title, body: `${promptItem.guide}\n\n`, tags: [] }
          : undefined,
    });
    return () => {
      dictationRef.current?.stop();
      dictationRef.current = null;
      // 系统返回、手势退出也保留最后一次输入，不依赖防抖计时器是否已触发。
      void persistCurrentDraft();
      clearEditorSession();
    };
  }, [params.id, params.template, params.date, params.prompt, params.mood, params.notebook, notebooks, persistCurrentDraft]);

  // 快捷入口直达录音/拍照/拍视频；离开写作页时取消尚未触发的导航。
  const sessionId = draft?.entry.id;
  useEffect(() => {
    if (!sessionId || initActionRan.current) return;
    const launch = () => {
      initActionRan.current = true;
      if (params.action === 'audio') router.push('/picker/audio');
      else if (params.action === 'photo') router.push('/picker/photos');
      else if (params.action === 'video') router.push('/picker/video');
      else if (params.action === 'dictate' && isDictationSupported()) toggleDictationRef.current();
    };
    const timer = setTimeout(launch, params.action === 'dictate' ? 500 : 220);
    return () => clearTimeout(timer);
  }, [sessionId, params.action]);

  const entry = draft?.entry;

  // 每换一篇日记，撤销历史从它当前的正文重新开始
  useEffect(() => {
    if (entry && historyFor.current !== entry.id) {
      historyFor.current = entry.id;
      history.reset(entry.body);
      bumpHistory(n => n + 1);
    }
  }, [entry, history]);

  const forceSelection = useCallback((start: number, end = start) => {
    setForcedSel({ start, end });
    selectionRef.current = { start, end };
    setSelection({ start, end });
    setTimeout(() => setForcedSel(undefined), 80);
  }, []);

  /** 所有正文改动都走这里：记入撤销历史。step = 整段操作（格式化、听写、模板），独立成一步 */
  const setBody = useCallback(
    (next: string, opts?: { step?: boolean; select?: [number, number] }) => {
      history.push(next, Date.now(), !!opts?.step);
      if (opts?.step) history.seal();
      updateEditorDraft({ body: next });
      if (opts?.select) forceSelection(opts.select[0], opts.select[1]);
    },
    [forceSelection, history],
  );

  // 撤销 / 重做后，把光标放到这次变化结束的位置
  const restoreBody = (v: string | null) => {
    if (v == null) return;
    const before = getEditorDraft()?.entry.body ?? '';
    let tail = 0;
    const max = Math.min(before.length, v.length);
    while (tail < max && before[before.length - 1 - tail] === v[v.length - 1 - tail]) tail++;
    haptic('light');
    updateEditorDraft({ body: v });
    setPreviewMode(false);
    forceSelection(v.length - tail);
  };
  const undo = () => restoreBody(history.undo());
  const redo = () => restoreBody(history.redo());

  // 第一次进入写作页：等页面升起后开始写作导览（快捷录音 / 拍照入口除外）
  const draftReady = !!entry;
  useEffect(() => {
    if (!draftReady || (editorTourSeen !== false && params.tour !== '1') || params.action) return;
    const timer = setTimeout(() => { openTutorial('editor'); if (params.tour === '1') router.setParams({ tour: undefined }); }, 700);
    return () => clearTimeout(timer);
  }, [draftReady, editorTourSeen, params.action, params.tour]);

  const hasContent = hasEntryContent(entry);

  // 一次依赖完整日记对象，日期、人物、同数量标签替换等修改也能自动保存。
  useEffect(() => {
    if (!draft?.dirty) return;
    const timer = setTimeout(() => void persistCurrentDraft(), 1200);
    return () => clearTimeout(timer);
  }, [draft?.dirty, entry, persistCurrentDraft]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') void persistCurrentDraft();
    });
    const onPageHide = () => void persistCurrentDraft();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') onPageHide();
    };
    if (Platform.OS === 'web') {
      window.addEventListener('pagehide', onPageHide);
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    return () => {
      subscription.remove();
      if (Platform.OS === 'web') {
        window.removeEventListener('pagehide', onPageHide);
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }, [persistCurrentDraft]);

  const handleCancel = useCallback(() => {
    if (savingRef.current) return;
    dictationRef.current?.stop();
    if (draft?.dirty && (hasContent || originalRef.current)) { setExitError(''); setExitModal(true); }
    else goBack();
  }, [draft?.dirty, hasContent]);

  const saveAndExit = async () => {
    if (savingRef.current) return;
    const cur = getEditorDraft()?.entry;
    if (!cur) return;
    savingRef.current = true;
    setSaving(true);
    setExitError('');
    try {
      await actions.upsertEntry(entryForSave(cur), true);
      const error = getPersistenceError();
      if (error) { setExitError(error); return; }
      finishedRef.current = true;
      toast(cur.status === 'published' ? '已保存修改' : '已保存为草稿');
      setExitModal(false);
      goBack();
    } catch {
      setExitError(getPersistenceError() || '保存未完成，请重试');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // 撤销本次编辑期间的自动保存，确认写入成功后再离开。
  const discardAndExit = async () => {
    if (savingRef.current) return;
    const cur = getEditorDraft()?.entry;
    savingRef.current = true;
    setSaving(true);
    setExitError('');
    try {
      if (cur) {
        if (originalRef.current) await actions.upsertEntry(entryForSave(originalRef.current), true);
        else actions.destroyEntry(cur.id);
      }
      await flushPendingState();
      const error = getPersistenceError();
      if (error) { setExitError(error); return; }
      finishedRef.current = true;
      setExitModal(false);
      goBack();
    } catch {
      setExitError(getPersistenceError() || '保存未完成，请重试');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const publish = async () => {
    if (savingRef.current) return;
    dictationRef.current?.stop();
    const cur = getEditorDraft()?.entry;
    if (!cur) return;
    if (!hasEntryContent(cur)) {
      toast('写点内容再保存吧', { type: 'warning' });
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      await actions.publishEntry(cur);
      const error = getPersistenceError();
      if (error) { toast(error, { type: 'warning' }); return; }
      finishedRef.current = true;
      haptic('success');
      if (syncCloud && account) void actions.syncNow();
      router.replace({ pathname: '/saved', params: { id: cur.id, revision: String(actions.snapshot().entries.find(item => item.id === cur.id)?.updatedAt ?? cur.updatedAt) } });
    } catch {
      toast(getPersistenceError() || '保存未完成，请重试', { type: 'warning' });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const toggleDictation = () => {
    if (!dictationSupported) return;
    if (dictating) {
      dictationRef.current?.stop();
      setDictating(false);
      setInterimText('');
      return;
    }
    haptic('medium');
    const session = createDictationSession({
      lang: 'zh-CN',
      onInterim: txt => setInterimText(txt),
      onFinal: txt => {
        const cur = getEditorDraft()?.entry;
        if (!cur || !txt) return;
        const next = insertDictation(cur.body, txt, selectionRef.current);
        setBody(next.body, { step: true, select: [next.cursor, next.cursor] });
      },
      onError: msg => {
        toast(msg, { type: 'warning' });
        setDictating(false);
        setInterimText('');
      },
      onEnd: () => {
        setDictating(false);
        setInterimText('');
      },
    });
    dictationRef.current = session;
    if (session.start()) {
      setDictating(true);
      setPreviewMode(false);
    }
  };

  toggleDictationRef.current = toggleDictation;

  // 插入富文本格式标记
  const applyFormat = (kind: 'h' | 'b' | 'i' | 'u' | 's' | 'hl' | 'quote' | 'todo' | 'ul' | 'ol' | 'hr') => {
    if (!entry) return;
    haptic('light');
    const text = entry.body;
    const start = Math.min(selection.start, text.length);
    const end = Math.min(selection.end, text.length);
    const sel = text.slice(start, end);
    let nextText = text;
    let select: [number, number] = [end, end];
    if (kind === 'b' || kind === 'i' || kind === 'u' || kind === 's' || kind === 'hl') {
      const wrap = kind === 'b' ? '**' : kind === 'i' ? '*' : kind === 'u' ? '__' : kind === 's' ? '~~' : '==';
      const inner = sel || (kind === 'b' ? '重点文字' : kind === 'i' ? '斜体' : kind === 'u' ? '下划线' : kind === 's' ? '删除线' : '高亮');
      nextText = `${text.slice(0, start)}${wrap}${inner}${wrap}${text.slice(end)}`;
      // 没有选中文字时，选中占位词，直接打字就能替换
      select = sel ? [start + wrap.length * 2 + inner.length, start + wrap.length * 2 + inner.length] : [start + wrap.length, start + wrap.length + inner.length];
    } else if (kind === 'hr') {
      const before = text.slice(0, end);
      const after = text.slice(end);
      const lead = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
      const tail = after.startsWith('\n') ? '' : '\n';
      nextText = `${before}${lead}---${tail}${after}`;
      const pos = before.length + lead.length + 3 + 1;
      select = [Math.min(pos, nextText.length), Math.min(pos, nextText.length)];
    } else {
      const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      const lineEndIdx = text.indexOf('\n', lineStart);
      const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
      const curLine = text.slice(lineStart, lineEnd);
      let delta = 0;

      if (kind === 'todo') {
        const todoPrefixMatch = curLine.match(/^-\s+\[[ xX]\]\s*/);
        if (todoPrefixMatch) {
          nextText = text.slice(0, lineStart) + curLine.slice(todoPrefixMatch[0].length) + text.slice(lineEnd);
          delta = -todoPrefixMatch[0].length;
        } else {
          nextText = `${text.slice(0, lineStart)}- [ ] ${curLine}${text.slice(lineEnd)}`;
          delta = 6;
        }
      } else {
        const prefix = kind === 'h' ? '# ' : kind === 'quote' ? '> ' : kind === 'ul' ? '- ' : '1. ';
        if (curLine.startsWith(prefix)) {
          nextText = text.slice(0, lineStart) + curLine.slice(prefix.length) + text.slice(lineEnd);
          delta = -prefix.length;
        } else {
          nextText = text.slice(0, lineStart) + prefix + curLine + text.slice(lineEnd);
          delta = prefix.length;
        }
      }
      const pos = Math.max(lineStart, end + delta);
      select = [pos, pos];
    }
    setPreviewMode(false);
    setBody(nextText, { step: true, select });
    setTimeout(() => bodyRef.current?.focus(), 30);
  };

  const readingPadH = Math.round(26 - contentWidth * 12);
  const words = useMemo(() => (entry ? wordCount(entry.title) + wordCount(entry.body) : 0), [entry?.title, entry?.body]);
  const goalPct = goals.enabled ? Math.min(100, Math.round((words / Math.max(1, goals.dailyWords)) * 100)) : 0;

  const paper = entry?.paper;
  const pcol = useMemo(() => paperColors(paper), [paper]);
  // 信纸底图随 paper 变化才重渲染，不跟每次击键
  const paperBg = useMemo(
    () =>
      paper && PAPER_IMAGES[paper] ? (
        <ExpoImage source={PAPER_IMAGES[paper] as any} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={120} pointerEvents="none" />
      ) : null,
    [paper],
  );
  if (!entry) return <Screen edges={['top']}><View /></Screen>;

  const d = new Date(entry.createdAt);
  const dateLabel = `${fmtMonthDayTime(entry.createdAt)} ${WEEK_CN[d.getDay()]}`;
  const mood = moodMeta(entry.mood);
  const weather = weatherMeta(entry.weather);
  const activeNbId = entry.notebookId || DEFAULT_NOTEBOOK_ID;
  const activeNb = notebooks.find(n => n.id === activeNbId) ?? notebooks[0];
  const photoLayout: PhotoLayout = entry.photoLayout ?? 'grid';

  const subtitleText = draft?.dirty && entry !== lastSavedEntryRef.current
    ? `正在保存…${goals.enabled ? ` · ${words}/${goals.dailyWords}字` : ''}`
    : draft?.lastAutoSavedAt
    ? `已自动保存 · ${fmtAgo(draft.lastAutoSavedAt)}${goals.enabled ? ` · ${words}/${goals.dailyWords}字` : ''}`
    : goals.enabled
      ? `${words} / ${goals.dailyWords} 字`
      : words > 0
        ? `${words} 字`
        : undefined;

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <NavBar
        title={params.id ? '编辑日记' : '新建日记'}
        subtitle={subtitleText}
        left={<TextAction label="取消" onPress={handleCancel} />}
        right={
          <View ref={publishTarget} collapsable={false}>
            <PillAction label={saving ? "保存中…" : entry.status === "published" ? "保存" : "完成"} disabled={saving || !hasContent} onPress={() => void publish()} />
          </View>
        }
      />

      {/* 导航栏下方极细写作目标进度条 */}
      {goals.enabled && (
        <View style={{ height: 2.5, backgroundColor: c.divider, width: '100%' }}>
          <View
            style={{
              height: '100%',
              width: `${goalPct}%`,
              backgroundColor: words >= goals.dailyWords ? c.success : c.primary,
            }}
          />
        </View>
      )}

      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: readingPadH, paddingTop: 12, paddingBottom: 48 }}
      >
        {/* 顶部杂志大日期头 + 日记本胶囊 */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`日期：${dateLabel}，轻点修改`}
            onPress={() => setDateModal(true)}
            style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, flex: 1, minWidth: 0, minHeight: 44 }}
          >
            <Text style={[t.h1, { fontSize: fs(36), lineHeight: fs(44), fontVariant: ['tabular-nums'] }]}>{d.getDate()}</Text>
            <View style={{ paddingBottom: 4, flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: fs(11.5), color: c.textMuted }}>{d.getFullYear()}年</Text>
              <Text numberOfLines={1} style={{ fontSize: fs(12.5), color: c.textSub, fontWeight: '500', marginTop: 2 }}>{dateLabel}</Text>
            </View>
          </Pressable>
          {activeNb && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`日记本：${activeNb.name}，轻点切换`}
              onPress={() => setNbModal(true)}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  height: 30,
                  paddingHorizontal: 11,
                  borderRadius: r(999),
                  backgroundColor: activeNb.id !== DEFAULT_NOTEBOOK_ID ? c.primaryFaint : c.card,
                  borderWidth: 1,
                  borderColor: activeNb.id !== DEFAULT_NOTEBOOK_ID ? c.primary : c.divider,
                }}
              >
                <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: activeNb.color }} />
                <Text numberOfLines={1} style={{ fontSize: fs(12), color: activeNb.id !== DEFAULT_NOTEBOOK_ID ? c.primaryDark : c.textSub, fontWeight: '500', maxWidth: 100 }}>
                  {activeNb.name}
                </Text>
                <ChevronDown size={13} color={activeNb.id !== DEFAULT_NOTEBOOK_ID ? c.primaryDark : c.textMuted} />
              </View>
            </Pressable>
          )}
        </View>

        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.divider, marginTop: 10, marginBottom: 4 }} />

        {/* 纤巧元信息行：心情、天气、地点、标签、和谁、模板 */}
        <View ref={metaTarget} collapsable={false} style={{ marginBottom: 8 }}>
          <View style={{ position: 'relative' }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 28 }} style={{ flexGrow: 0, flexShrink: 0 }}>
              <Chip
                tone={mood ? 'soft' : undefined}
                size="sm"
                icon={mood ? <MoodIcon mood={mood.key} size={14} /> : Smile}
                label={mood ? mood.label : '心情'}
                selected={!!mood || metaRow === 'mood'}
                onPress={() => {
                  haptic('light');
                  setMetaRow(v => (v === 'mood' ? null : 'mood'));
                }}
              />
              <Chip
                tone={weather ? 'soft' : undefined}
                size="sm"
                icon={weather ? <WeatherIcon weather={weather.key} size={13} /> : Cloud}
                label={weather ? `${weather.label}${entry.temperature != null ? ` ${entry.temperature}°` : ''}` : '天气'}
                selected={!!weather || metaRow === 'weather'}
                onPress={() => {
                  haptic('light');
                  setMetaRow(v => (v === 'weather' ? null : 'weather'));
                }}
              />
              <Chip
                tone={entry.place ? 'soft' : undefined}
                size="sm"
                icon={MapPin}
                label={entry.place?.name?.split('·').pop()?.trim() || '地点'}
                selected={!!entry.place}
                onPress={() => router.push('/picker/location')}
              />
              <Chip
                tone={entry.tags.length ? 'soft' : undefined}
                size="sm"
                icon={TagIcon}
                label={entry.tags.length ? `${entry.tags.length} 个标签` : '标签'}
                selected={entry.tags.length > 0}
                onPress={() => router.push('/picker/tags')}
              />
              <Chip
                tone={entry.people.length ? 'soft' : undefined}
                size="sm"
                icon={Users}
                label={
                  entry.people.length === 0
                    ? '和谁'
                    : entry.people.length <= 2
                      ? entry.people.map(id => people.find(p => p.id === id)?.name).filter(Boolean).join('、')
                      : `${entry.people.length} 个人`
                }
                selected={entry.people.length > 0}
                onPress={() => router.push('/picker/people')}
              />
              <Chip
                size="sm"
                icon={<AssetIcon source={EDITOR_ICONS.sticker} size={14} color={c.textSub} />}
                label="模板"
                onPress={() => router.push('/templates')}
              />
            </ScrollView>
            <LinearGradient
              pointerEvents="none"
              colors={['transparent', c.bg]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 26 }}
            />
          </View>

          {/* 内联快选行：心情 / 天气，一行点完即收起；末尾保留完整选择页入口 */}
          {metaRow === 'mood' && (
            <FadeIn dy={6} duration={220}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0, flexShrink: 0, marginTop: 4 }}
                contentContainerStyle={{ gap: 6 }}
                keyboardShouldPersistTaps="handled"
              >
                {MOOD_ORDER.map(key => {
                  const m = moodMeta(key)!;
                  const on = entry.mood === key;
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityLabel={`心情：${m.label}`}
                      onPress={() => {
                        haptic('light');
                        updateEditorDraft({ mood: on ? undefined : key });
                        setMetaRow(null);
                      }}
                      style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 12,
                          height: 34,
                          borderRadius: r(999),
                          backgroundColor: on ? moodTint(m, dark) : c.cardAlt,
                          borderWidth: on ? 1.2 : StyleSheet.hairlineWidth,
                          borderColor: on ? c.primary : c.divider,
                        }}
                      >
                        <MoodIcon mood={key} size={18} />
                        <Text style={{ fontSize: fs(12.5), color: on ? c.text : c.textSub, fontWeight: on ? '600' : '400' }}>{m.label}</Text>
                      </View>
                    </Pressable>
                  );
                })}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="打开完整心情选择页"
                  onPress={() => {
                    setMetaRow(null);
                    router.push('/picker/mood');
                  }}
                  style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 34, borderRadius: r(999), borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }}>
                    <Text style={{ fontSize: fs(12.5), color: c.primaryDark }}>更多 ›</Text>
                  </View>
                </Pressable>
              </ScrollView>
            </FadeIn>
          )}

          {metaRow === 'weather' && (
            <FadeIn dy={6} duration={220}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0, flexShrink: 0, marginTop: 4 }}
                contentContainerStyle={{ gap: 6 }}
                keyboardShouldPersistTaps="handled"
              >
                {WEATHERS.map(w => {
                  const on = entry.weather === w.key;
                  return (
                    <Pressable
                      key={w.key}
                      accessibilityRole="button"
                      accessibilityLabel={`天气：${w.label}`}
                      onPress={() => {
                        haptic('light');
                        updateEditorDraft({ weather: on ? undefined : w.key });
                        setMetaRow(null);
                      }}
                      style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 5,
                          paddingHorizontal: 11,
                          height: 34,
                          borderRadius: r(999),
                          backgroundColor: on ? c.primaryFaint : c.cardAlt,
                          borderWidth: on ? 1.2 : StyleSheet.hairlineWidth,
                          borderColor: on ? c.primary : c.divider,
                        }}
                      >
                        <WeatherIcon weather={w.key} size={15} />
                        <Text style={{ fontSize: fs(12.5), color: on ? c.primaryDark : c.textSub, fontWeight: on ? '600' : '400' }}>{w.label}</Text>
                      </View>
                    </Pressable>
                  );
                })}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="打开地点与温度选择页"
                  onPress={() => {
                    setMetaRow(null);
                    router.push('/picker/location');
                  }}
                  style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 34, borderRadius: r(999), borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }}>
                    <Text style={{ fontSize: fs(12.5), color: c.primaryDark }}>地点 ›</Text>
                  </View>
                </Pressable>
              </ScrollView>
            </FadeIn>
          )}
        </View>

        {/* 标题 + 正文：信纸底纹容器 */}
        <View style={paperBg ? { borderRadius: r(18), overflow: 'hidden', paddingHorizontal: 18, paddingVertical: 20, marginBottom: 8 } : undefined}>
          {paperBg}
        {/* 标题输入 */}
        <TextInput
          accessibilityLabel="日记标题"
          editable={!saving}
          value={entry.title}
          onChangeText={title => updateEditorDraft({ title: title.replace(/[\r\n]+/g, '') })}
          placeholder="标题（可选）"
          placeholderTextColor={pcol?.placeholder ?? c.textMuted}
          multiline
          scrollEnabled={false}
          submitBehavior="blurAndSubmit"
          returnKeyType="next"
          onSubmitEditing={() => bodyRef.current?.focus()}
          textAlignVertical="top"
          style={[
            t.readingTitle,
            {
              fontSize: fs(22),
              lineHeight: fs(32),
              minHeight: fs(44),
              color: pcol?.text ?? c.text,
              ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
              paddingTop: 8,
              paddingBottom: 8,
              paddingHorizontal: 0,
              marginBottom: 8,
              outlineStyle: 'none',
            } as any,
          ]}
        />

        {/* 正文输入或富文本预览 */}
        <View ref={bodyTarget} collapsable={false}>
          {previewMode ? (
            <Pressable onPress={() => setPreviewMode(false)} style={{ minHeight: 160, paddingVertical: 6 }}>
              {entry.body.trim() ? (
                <RichBody
                  body={entry.body}
                  colors={pcol ? { text: pcol.text, sub: pcol.sub, muted: pcol.placeholder } : undefined}
                  onToggleTodo={lineIdx => setBody(toggleTodoAtLine(entry.body, lineIdx), { step: true })}
                />
              ) : (
                <Text style={{ fontSize: fs(15), color: c.textMuted }}>暂无正文内容，点击返回编辑…</Text>
              )}
            </Pressable>
          ) : (
            <TextInput
              ref={bodyRef}
              accessibilityLabel="日记正文"
              editable={!saving}
              value={entry.body}
              selection={forcedSel}
              onChangeText={body => {
                // 在列表、待办、引用行里回车：自动接上下一项
                const caret = selection.start === selection.end ? selection.start : undefined;
                const cont = continueListOnEnter(entry.body, body, caret);
                if (cont) setBody(cont.text, { step: true, select: [cont.cursor, cont.cursor] });
                else setBody(body);
              }}
              onSelectionChange={e => { selectionRef.current = e.nativeEvent.selection; setSelection(e.nativeEvent.selection); }}
              placeholder="写下此刻的想法…"
              placeholderTextColor={pcol?.placeholder ?? c.textMuted}
              selectionColor={pcol?.caret}
              multiline
              textAlignVertical="top"
              style={{
                fontFamily: t.bodySerif.fontFamily,
                fontSize: fs(16),
                lineHeight: fs(16) * lineHeight,
                color: pcol?.text ?? c.text,
                minHeight: 160,
                paddingVertical: 4,
                outlineStyle: 'none',
              } as any}
            />
          )}
        </View>
        </View>

        {/* 空白写作灵感引导条 */}
        {!entry.title && !entry.body && !previewMode && (
          <View style={{ marginTop: 12, backgroundColor: dark ? c.cardAlt : c.primaryFaint, borderRadius: r(14), borderLeftWidth: 3, borderLeftColor: c.primary, padding: 13, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Sparkles size={13} color={c.primaryDark} />
                <Text style={{ fontSize: fs(12), color: c.primaryDark, fontWeight: '500' }}>不知道写什么？试试这个提问</Text>
              </View>
              <Pressable hitSlop={8} onPress={() => setPromptTipIdx(i => (i + 1) % DAILY_PROMPTS.length)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <RefreshCw size={11} color={c.textMuted} />
                <Text style={{ fontSize: fs(11.5), color: c.textSub }}>换一条</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => {
                const p = DAILY_PROMPTS[promptTipIdx] ?? DAILY_PROMPTS[0];
                updateEditorDraft({ title: p.title });
                setBody(`${p.guide}\n\n`, { step: true });
              }}
            >
              <Text style={{ fontSize: fs(13.5), color: c.text }}>{(DAILY_PROMPTS[promptTipIdx] ?? DAILY_PROMPTS[0]).title}</Text>
              <Text style={{ fontSize: fs(11.5), color: c.primaryDark, marginTop: 4 }}>轻触填入日记 ›</Text>
            </Pressable>
          </View>
        )}

        {/* 已选标签与身边人展示（置于正文后，不打断开篇视线） */}
        {(entry.tags.length > 0 || entry.people.length > 0) && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
            {entry.people.map(pid => {
              const p = people.find(x => x.id === pid);
              if (!p) return null;
              return (
                <Chip
                  tone="soft"
                  key={pid}
                  size="sm"
                  selected
                  label={p.name}
                  onRemove={() => updateEditorDraft({ people: entry.people.filter(x => x !== pid) })}
                />
              );
            })}
            {entry.tags.map(tid => {
              const tg = tags.find(x => x.id === tid);
              if (!tg) return null;
              return (
                <Chip
                  tone="soft"
                  key={tid}
                  size="sm"
                  selected
                  label={`#${tg.name}`}
                  onRemove={() => updateEditorDraft({ tags: entry.tags.filter(x => x !== tid) })}
                />
              );
            })}
          </View>
        )}

        {/* 「记得」面板：追问 / 整理 / 理顺，放在正文下方不遮挡思考 */}
        <RememberPanel entry={entry} applyBody={(next, step) => setBody(next, { step })} />

        {/* 多图排版切换器 + 照片预览 */}
        {entry.photos.length >= 2 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: -8 }}>
            <Text style={{ fontSize: fs(12), color: c.textSub }}>图片排版 ({entry.photos.length} 张)</Text>
            <View style={{ flexDirection: 'row', backgroundColor: c.bgDeep, borderRadius: r(999), padding: 2 }}>
              {[
                { key: 'grid' as const, label: '网格' },
                { key: 'large' as const, label: '大图' },
                { key: 'carousel' as const, label: '轮播' },
              ].map(opt => {
                const on = photoLayout === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => {
                      haptic('light');
                      updateEditorDraft({ photoLayout: opt.key });
                    }}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      borderRadius: r(999),
                      backgroundColor: on ? c.card : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: fs(11), color: on ? c.primaryDark : c.textMuted, fontWeight: on ? '600' : '400' }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <PhotoLayoutView
          photos={entry.photos}
          layout={photoLayout}
          onPressPhoto={setViewerIdx}
          onRemovePhoto={removeEditorPhoto}
        />

        {/* 添加的视频：可就地试看，右上角移除 */}
        {entry.videos.length > 0 && (
          <View style={{ gap: 12, marginTop: 18 }}>
            {entry.videos.map(clip => (
              <VideoClipCard key={clip.id} clip={clip} onRemove={() => removeEditorVideo(clip.id)} />
            ))}
          </View>
        )}

        {/* 插入的语音列表 */}
        {entry.audios.length > 0 && (
          <View style={{ gap: 10, marginTop: 18 }}>
            {entry.audios.map(clip => (
              <AudioClipCard key={clip.id} clip={clip} onRemove={() => removeEditorAudio(clip.id)} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* 语音听写实时指示条 */}
      {dictating && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: c.dangerSoft,
            paddingHorizontal: 16,
            paddingVertical: 8,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.danger }} />
            <Text numberOfLines={1} style={{ fontSize: fs(12.5), color: c.danger, flex: 1 }}>
              {interimText ? `识别中：${interimText}` : '正在聆听中文语音，说完自动上屏…'}
            </Text>
          </View>
          <Pressable
            onPress={toggleDictation}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: c.danger,
            }}
          >
            <Square size={10} color={c.textOnPrimary} fill={c.textOnPrimary} />
            <Text style={{ fontSize: fs(11.5), color: c.textOnPrimary, fontWeight: '600' }}>停止</Text>
          </Pressable>
        </View>
      )}

      {/* 底部工具栏：一行附件图标 +「Aa」展开格式工具（设计稿2 #3 / 编辑器组件示例） */}
      <View style={{ backgroundColor: c.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider }}>
        {/* 格式工具：撤销重做 + 9 种格式，随「Aa」滑出 */}
        <Animated.View
          ref={formatTarget}
          collapsable={false}
          style={{
            height: formatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 52] }),
            opacity: formatAnim,
            overflow: 'hidden',
            borderBottomWidth: formatOpen ? StyleSheet.hairlineWidth : 0,
            borderBottomColor: c.divider,
          }}
        >
          <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 6, marginRight: 4, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: c.divider }}>
              {[
                { asset: EDITOR_ICONS.undo, label: '撤销', on: history.canUndo, onPress: undo },
                { asset: EDITOR_ICONS.redo, label: '重做', on: history.canRedo, onPress: redo },
              ].map(tool => (
                <Pressable
                  key={tool.label}
                  accessibilityRole="button"
                  accessibilityLabel={tool.label}
                  disabled={!tool.on}
                  onPress={tool.onPress}
                  hitSlop={4}
                  style={({ pressed }) => ({ width: 44, height: 44, borderRadius: r(10), alignItems: 'center', justifyContent: 'center', opacity: tool.on ? 1 : 0.3, backgroundColor: pressed ? c.bgDeep : 'transparent' })}
                >
                  <AssetIcon source={tool.asset} size={20} color={c.text} />
                </Pressable>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', paddingRight: 6 }} style={{ flex: 1 }}>
              {[
                { asset: EDITOR_ICONS.heading, label: '小标题', onPress: () => applyFormat('h') },
                { asset: EDITOR_ICONS.bold, label: '加粗', onPress: () => applyFormat('b') },
                { asset: EDITOR_ICONS.italic, label: '斜体', onPress: () => applyFormat('i') },
                { asset: EDITOR_ICONS.underline, label: '下划线', onPress: () => applyFormat('u') },
                { asset: EDITOR_ICONS.strike, label: '删除线', onPress: () => applyFormat('s') },
                { asset: EDITOR_ICONS.highlight, label: '高亮', onPress: () => applyFormat('hl') },
                { asset: EDITOR_ICONS.quote, label: '引用', onPress: () => applyFormat('quote') },
                { asset: EDITOR_ICONS.checklist, label: '待办', onPress: () => applyFormat('todo') },
                { asset: EDITOR_ICONS.bullets, label: '无序列表', onPress: () => applyFormat('ul') },
                { asset: EDITOR_ICONS.numbered, label: '有序列表', onPress: () => applyFormat('ol') },
                { icon: Minus, label: '分割线', onPress: () => applyFormat('hr') },
              ].map(tool => (
                <Pressable key={tool.label} accessibilityRole="button" accessibilityLabel={tool.label} onPress={tool.onPress} hitSlop={4} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: r(10), alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.bgDeep : 'transparent' })}>
                  {'asset' in tool && tool.asset ? (
                    <AssetIcon source={tool.asset} size={20} color={c.text} />
                  ) : (
                    tool.icon && <tool.icon size={19} color={c.text} strokeWidth={2} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Animated.View>

        {/* 主工具行：Aa ｜ 附件图标 ｜ 预览 */}
        <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
          <PressableScale
            scaleTo={0.9}
            onPress={() => {
              haptic('light');
              setFormatOpen(v => !v);
            }}
            accessibilityLabel={formatOpen ? '收起格式工具' : '展开格式工具'}
            aria-expanded={formatOpen}
            style={{ width: 44, height: 44, borderRadius: r(10), alignItems: 'center', justifyContent: 'center', backgroundColor: formatOpen ? c.primaryFaint : 'transparent' }}
          >
            <AssetIcon source={EDITOR_ICONS.font} size={20} color={formatOpen ? c.primaryDark : c.text} />
          </PressableScale>
          <PressableScale
            scaleTo={0.9}
            onPress={() => {
              haptic('light');
              setPaperSheet(true);
            }}
            accessibilityLabel="信纸"
            style={{ width: 44, height: 44, borderRadius: r(10), alignItems: 'center', justifyContent: 'center', backgroundColor: paperSheet ? c.primaryFaint : 'transparent' }}
          >
            <AssetIcon source={EDITOR_ICONS.palette} size={20} color={paperSheet || entry.paper ? c.primaryDark : c.text} />
          </PressableScale>
          <View style={{ width: StyleSheet.hairlineWidth, height: 18, backgroundColor: c.divider, marginHorizontal: 4 }} />

          {/* 心情、地点天气、标签已经在顶部胶囊栏里，这里只留顶部没有的媒体入口 */}
          <View ref={attachTarget} collapsable={false} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
            {[
              { asset: EDITOR_ICONS.photo, label: '图片', active: false, onPress: () => router.push('/picker/photos') },
              { asset: EDITOR_ICONS.video, label: '视频', active: false, onPress: () => router.push('/picker/video') },
              { asset: EDITOR_ICONS.audio, label: '录音', active: false, onPress: () => router.push('/picker/audio') },
              ...(dictationSupported
                ? [{ icon: AudioLines, label: dictating ? '停止听写' : '听写', active: dictating, onPress: toggleDictation }]
                : []),
            ].map(att => (
              <PressableScale
                key={att.label}
                scaleTo={0.86}
                onPress={att.onPress}
                accessibilityLabel={att.label}
                style={{ width: 44, height: 44, borderRadius: r(10), alignItems: 'center', justifyContent: 'center', backgroundColor: att.active ? c.dangerSoft : 'transparent' }}
              >
                {'asset' in att && att.asset ? (
                  <AssetIcon source={att.asset} size={21} color={att.active ? c.danger : c.primaryDark} />
                ) : (
                  att.icon && <att.icon size={20} color={att.active ? c.danger : c.primaryDark} strokeWidth={1.85} />
                )}
              </PressableScale>
            ))}
          </View>

          <View style={{ width: StyleSheet.hairlineWidth, height: 18, backgroundColor: c.divider, marginHorizontal: 4 }} />
          <PressableScale
            scaleTo={0.9}
            onPress={() => setPreviewMode(v => !v)}
            accessibilityLabel={previewMode ? '返回编辑' : '预览排版'}
            aria-pressed={previewMode}
            style={{ width: 44, height: 44, borderRadius: r(10), alignItems: 'center', justifyContent: 'center', backgroundColor: previewMode ? c.primaryFaint : 'transparent' }}
          >
            {previewMode ? <EyeOff size={17} color={c.primaryDark} strokeWidth={1.8} /> : <Eye size={17} color={c.text} strokeWidth={1.8} />}
          </PressableScale>
        </View>
      </View>

      {/* 退出保护弹窗（设计稿2 #12） */}
      <PopDialog accessibilityLabel="保存日记" visible={exitModal} onClose={() => { if (!saving) setExitModal(false); }} maxWidth={330} style={{ padding: 24 }}>
        <Text style={[t.h2, { textAlign: 'center', fontSize: fs(18) }]}>{entry.status === "published" ? "保存这次修改？" : "保存这篇草稿？"}</Text>
        <Text style={[t.sub, { textAlign: 'center', marginTop: 10 }]}>{entry.status === "published" ? "保存后将更新这篇日记。选择不保存，会还原本次编辑前的内容。" : "保存后可以在草稿箱继续写。选择不保存，会放弃这次编辑。"}</Text>
        {!!exitError && <Text accessibilityRole="alert" style={[t.sub, { color: c.danger, marginTop: 12 }]}>{exitError}</Text>}
        <View style={{ gap: 10, marginTop: 22 }}>
          <PressableScale disabled={saving} onPress={() => void discardAndExit()} style={{ minHeight: 44, paddingVertical: 10, borderRadius: r(999), borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: fs(14), color: c.textSub }}>不保存</Text>
          </PressableScale>
          <PressableScale disabled={saving} onPress={() => void saveAndExit()} style={{ minHeight: 44, paddingVertical: 10, borderRadius: r(999), backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: fs(14), color: c.textOnPrimary, fontWeight: '600' }}>{saving ? "保存中…" : entry.status === "published" ? "保存修改" : "保存草稿"}</Text>
          </PressableScale>
        </View>
      </PopDialog>

      {/* 日记本选择弹窗 */}
      <PopDialog accessibilityLabel="选择日记本" visible={nbModal} onClose={() => setNbModal(false)} maxWidth={330} style={{ padding: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <BookOpen size={17} color={c.primaryDark} />
            <Text style={[t.h3, { fontSize: fs(16) }]}>选择日记本</Text>
          </View>
          <Pressable
            hitSlop={8}
            onPress={() => {
              setNbModal(false);
              router.push('/shelf');
            }}
          >
            <Text style={{ fontSize: fs(12.5), color: c.primaryDark }}>管理 ›</Text>
          </Pressable>
        </View>
        <View style={{ gap: 8 }}>
          {notebooks.map(nb => {
            const selected = activeNbId === nb.id;
            return (
              <PressableScale
                key={nb.id}
                scaleTo={0.98}
                onPress={() => {
                  haptic('light');
                  updateEditorDraft({ notebookId: nb.id === DEFAULT_NOTEBOOK_ID ? undefined : nb.id });
                  setNbModal(false);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 14,
                  height: 44,
                  borderRadius: r(12),
                  backgroundColor: selected ? c.primaryFaint : c.bgDeep,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: nb.color }} />
                  <Text style={{ fontSize: fs(14), color: c.text, fontWeight: selected ? '600' : '400' }}>{nb.name}</Text>
                </View>
                {selected && <Check size={16} color={c.primaryDark} />}
              </PressableScale>
            );
          })}
        </View>
      </PopDialog>

      {/* 记录时间：可选任意一天、任意时刻（用于补记） */}
      <DateTimeSheet
        visible={dateModal}
        value={entry.createdAt}
        onClose={() => setDateModal(false)}
        onConfirm={ts => {
          haptic('light');
          updateEditorDraft({ createdAt: ts });
        }}
      />

      {/* 信纸选择 */}
      <BottomSheet visible={paperSheet} onClose={() => setPaperSheet(false)} title="选择信纸">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 4 }}>
          {[{ key: undefined as PaperKey | undefined, name: '无' }, ...PAPERS].map(p => {
            const on = (entry.paper ?? undefined) === p.key;
            return (
              <Pressable
                key={p.key ?? 'none'}
                accessibilityRole="radio"
                accessibilityLabel={`信纸：${p.name}`}
                accessibilityState={{ checked: on }}
                aria-checked={on}
                onPress={() => {
                  haptic('light');
                  updateEditorDraft({ paper: p.key });
                }}
                style={{ width: '22.5%', minWidth: 64, alignItems: 'center' }}
              >
                <View
                  style={{
                    width: '100%',
                    aspectRatio: 2 / 3,
                    borderRadius: r(10),
                    overflow: 'hidden',
                    backgroundColor: c.inputBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...(on ? frameInk : { borderWidth: 1, borderColor: c.divider }),
                  }}
                >
                  {p.key ? (
                    <ExpoImage source={PAPER_THUMBS[p.key] as any} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" transition={0} />
                  ) : (
                    <Minus size={18} color={c.textMuted} />
                  )}
                  {on && (
                    <View style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={11} color={c.textOnPrimary} strokeWidth={3} />
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: fs(12), color: on ? c.primaryDark : c.textSub, marginTop: 6 }}>{p.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

      <PhotoViewer photos={entry.photos} initialIndex={viewerIdx ?? 0} visible={viewerIdx !== null} onClose={() => setViewerIdx(null)} />
    </Screen>
  );
}
