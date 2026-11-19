import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AudioLines, Bold, BookOpen, Calendar, Check, CheckSquare, Cloud, Eye, EyeOff, Heading1, Image as ImageIcon, Italic, Type,
  LayoutTemplate, List, ListOrdered, MapPin, Mic, Minus, Quote, Redo2, RefreshCw, Smile, Sparkles,
  Square, Tag as TagIcon, Underline, Undo2, Video,
} from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeProvider';
import { actions, openTutorial, useStore } from '../src/store/store';
import type { Entry, MoodKey, PhotoLayout } from '../src/store/types';
import {
  getEditorDraft, markAutoSaved, startEditorSession, updateEditorDraft, useEditorDraft,
  removeEditorAudio, removeEditorPhoto, removeEditorVideo, clearEditorSession,
} from '../src/store/editorSession';
import { DAILY_PROMPTS, DEFAULT_NOTEBOOK_ID, MOODS, TEMPLATES, moodMeta, weatherMeta } from '../src/data/constants';
import { Chip, NavBar, PillAction, Screen, TextAction, goBack, haptic } from '../src/components/ui';
import { MoodIcon, WeatherIcon } from '../src/components/MoodIcon';
import { AudioClipCard } from '../src/components/AudioPlayer';
import { VideoClipCard } from '../src/components/VideoPlayer';
import { PhotoViewer } from '../src/components/PhotoViewer';
import { PhotoLayoutView } from '../src/components/PhotoLayout';
import { RichBody } from '../src/components/RichBody';
import { useFeedback } from '../src/components/feedback';
import { DateTimeSheet } from '../src/components/DateTimeSheet';
import { PopDialog, PressableScale } from '../src/components/motion';
import { setTourHandler, useTourTarget } from '../src/components/tour';
import { fmtAgo, fmtMonthDayTime, WEEK_CN } from '../src/utils/date';
import { wordCount } from '../src/utils/text';
import { continueListOnEnter, toggleTodoAtLine } from '../src/utils/richtext';
import { TextHistory } from '../src/utils/history';
import { createDictationSession, isDictationSupported, type DictationSession } from '../src/utils/dictation';

/** 2, 3, 8, 12. 新建/编辑日记页 */
export default function WriteScreen() {
  const params = useLocalSearchParams<{ id?: string; template?: string; date?: string; action?: string; prompt?: string; mood?: string }>();
  const { c, t, fs, lineHeight, contentWidth } = useTheme();
  const { toast } = useFeedback();
  const tags = useStore(s => s.tags);
  const notebooks = useStore(s => s.notebooks);
  const goals = useStore(s => s.goals);
  const account = useStore(s => s.account);
  const syncCloud = useStore(s => s.sync.cloud);
  const editorTourSeen = useStore(s => s.editorTourSeen);

  const draft = useEditorDraft();
  const [previewMode, setPreviewMode] = useState(false);
  const [exitModal, setExitModal] = useState(false);
  const [dateModal, setDateModal] = useState(false);
  const [nbModal, setNbModal] = useState(false);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const [promptTipIdx, setPromptTipIdx] = useState(0);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [dictating, setDictating] = useState(false);
  const [interimText, setInterimText] = useState('');
  const dictationSupported = useMemo(() => isDictationSupported(), []);
  const dictationRef = useRef<DictationSession | null>(null);
  const toggleDictationRef = useRef<() => void>(() => undefined);
  // 格式工具默认收起，只露一行附件图标（设计稿2 #3：键盘上方一条细工具栏）
  const [formatOpen, setFormatOpen] = useState(false);
  const formatAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(formatAnim, {
      toValue: formatOpen ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [formatOpen, formatAnim]);
  // 写作导览讲到「排版」那一步之前，先把格式工具展开
  useEffect(() => {
    setTourHandler('editor.prepare', () => setFormatOpen(true));
    return () => setTourHandler('editor.prepare', null);
  }, []);
  const bodyRef = useRef<TextInput>(null);
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

  // 初始化编辑会话
  useEffect(() => {
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
      templateData: tpl
        ? { title: tpl.title, body: tpl.body, tags: tpl.tags, template: tpl.id }
        : promptItem
          ? { title: promptItem.title, body: `${promptItem.guide}\n\n`, tags: [] }
          : undefined,
    });
    return () => {
      dictationRef.current?.stop();
      dictationRef.current = null;
      clearEditorSession();
    };
  }, [params.id, params.template, params.date, params.prompt, params.mood]);

  // 快捷入口直达录音/拍照/拍视频
  useEffect(() => {
    if (!draft || initActionRan.current) return;
    initActionRan.current = true;
    if (params.action === 'audio') {
      setTimeout(() => router.push('/picker/audio'), 220);
    } else if (params.action === 'photo') {
      setTimeout(() => router.push('/picker/photos'), 220);
    } else if (params.action === 'video') {
      setTimeout(() => router.push('/picker/video'), 220);
    } else if (params.action === 'dictate') {
      // 首页 FAB「语音听写」直达：进编辑页后自动开始听
      if (isDictationSupported()) setTimeout(() => toggleDictationRef.current(), 500);
    }
  }, [draft, params.action]);

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
    if (!draftReady || editorTourSeen !== false || params.action) return;
    const timer = setTimeout(() => openTutorial('editor'), 700);
    return () => clearTimeout(timer);
  }, [draftReady, editorTourSeen, params.action]);

  const hasContent = !!(
    entry &&
    (entry.title.trim() || entry.body.trim() || entry.photos.length > 0 || entry.audios.length > 0 || entry.videos.length > 0)
  );

  // 自动保存草稿
  useEffect(() => {
    if (!draft?.dirty || !hasContent || !entry) return;
    const timer = setTimeout(() => {
      const cur = getEditorDraft()?.entry;
      if (!cur) return;
      actions.upsertEntry({ ...cur, status: cur.status === 'published' ? 'published' : 'draft', updatedAt: Date.now() });
      markAutoSaved();
    }, 5000);
    return () => clearTimeout(timer);
  }, [
    draft?.dirty,
    hasContent,
    entry?.title,
    entry?.body,
    entry?.photos.length,
    entry?.audios.length,
    entry?.videos.length,
    entry?.mood,
    entry?.tags.length,
    entry?.weather,
    entry?.place?.name,
    entry?.notebookId,
    entry?.photoLayout,
  ]);

  const handleCancel = useCallback(() => {
    dictationRef.current?.stop();
    if (draft?.dirty && hasContent) {
      setExitModal(true);
    } else {
      goBack();
    }
  }, [draft?.dirty, hasContent]);

  const saveAsDraftAndExit = () => {
    const cur = getEditorDraft()?.entry;
    if (cur) {
      actions.upsertEntry({ ...cur, status: 'draft', updatedAt: Date.now() }, true);
      toast('已保存为草稿');
    }
    setExitModal(false);
    goBack();
  };

  // 「不保存」要说到做到：撤掉这次编辑期间自动存下的内容
  const discardAndExit = () => {
    const cur = getEditorDraft()?.entry;
    if (cur) {
      if (originalRef.current) actions.upsertEntry(originalRef.current, true);
      else actions.destroyEntry(cur.id);
    }
    setExitModal(false);
    goBack();
  };

  const publish = async () => {
    dictationRef.current?.stop();
    const cur = getEditorDraft()?.entry;
    if (!cur) return;
    if (!cur.title.trim() && !cur.body.trim() && cur.photos.length === 0 && cur.audios.length === 0 && cur.videos.length === 0) {
      toast('写点内容再发布吧', { type: 'warning' });
      return;
    }
    haptic('success');
    actions.publishEntry(cur);
    if (syncCloud && account) {
      void actions.syncNow();
    }
    router.replace({ pathname: '/saved', params: { id: cur.id } });
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
        const pos = Math.min(selection.end, cur.body.length);
        const before = cur.body.slice(0, pos);
        const after = cur.body.slice(pos);
        const next = `${before}${txt}${after}`;
        const nextPos = pos + txt.length;
        setBody(next, { step: true, select: [nextPos, nextPos] });
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
  const applyFormat = (kind: 'h' | 'b' | 'i' | 'u' | 'quote' | 'todo' | 'ul' | 'ol' | 'hr') => {
    if (!entry) return;
    haptic('light');
    const text = entry.body;
    const start = Math.min(selection.start, text.length);
    const end = Math.min(selection.end, text.length);
    const sel = text.slice(start, end);
    let nextText = text;
    let select: [number, number] = [end, end];
    if (kind === 'b' || kind === 'i' || kind === 'u') {
      const wrap = kind === 'b' ? '**' : kind === 'i' ? '*' : '__';
      const inner = sel || (kind === 'b' ? '重点文字' : kind === 'i' ? '斜体' : '下划线');
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
  const words = useMemo(() => (entry ? wordCount(entry.title) + wordCount(entry.body) : 0), [entry]);
  const goalPct = goals.enabled ? Math.min(100, Math.round((words / Math.max(1, goals.dailyWords)) * 100)) : 0;

  if (!entry) return <Screen edges={['top']}><View /></Screen>;

  const d = new Date(entry.createdAt);
  const dateLabel = `${fmtMonthDayTime(entry.createdAt)} ${WEEK_CN[d.getDay()]}`;
  const mood = moodMeta(entry.mood);
  const weather = weatherMeta(entry.weather);
  const activeNbId = entry.notebookId || DEFAULT_NOTEBOOK_ID;
  const activeNb = notebooks.find(n => n.id === activeNbId) ?? notebooks[0];
  const photoLayout: PhotoLayout = entry.photoLayout ?? 'grid';

  const subtitleText = draft?.lastAutoSavedAt
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
            <PillAction label="发布" onPress={() => void publish()} />
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: readingPadH, paddingTop: 10, paddingBottom: 32 }}
      >
        {/* 顶部元信息胶囊栏：日记本、日期、心情、地点天气、模板 */}
        <View ref={metaTarget} collapsable={false} style={{ marginBottom: 14 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }}>
          {activeNb && (
            <Chip
              icon={<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: activeNb.color }} />}
              label={activeNb.name}
              selected={activeNb.id !== DEFAULT_NOTEBOOK_ID}
              onPress={() => setNbModal(true)}
            />
          )}
          <Chip
            icon={Calendar}
            label={dateLabel}
            onPress={() => setDateModal(true)}
          />
          <Chip
            icon={mood ? <MoodIcon mood={mood.key} size={15} /> : Smile}
            label={mood ? mood.label : '心情'}
            selected={!!mood}
            onPress={() => router.push('/picker/mood')}
          />
          <Chip
            icon={weather ? <WeatherIcon weather={weather.key} size={14} /> : entry.place ? MapPin : Cloud}
            label={
              [
                entry.place?.name?.split('·').pop()?.trim(),
                weather ? `${weather.label}${entry.temperature != null ? ` ${entry.temperature}°` : ''}` : null,
              ]
                .filter(Boolean)
                .join(' · ') || '天气与地点'
            }
            selected={!!(weather || entry.place)}
            onPress={() => router.push('/picker/location')}
          />
          <Chip
            icon={TagIcon}
            label={entry.tags.length ? `${entry.tags.length} 个标签` : '标签'}
            selected={entry.tags.length > 0}
            onPress={() => router.push('/picker/tags')}
          />
          <Chip
            icon={LayoutTemplate}
            label="模板"
            onPress={() => router.push('/templates')}
          />
        </ScrollView>
        </View>

        {/* 已选标签展示 */}
        {entry.tags.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {entry.tags.map(tid => {
              const tg = tags.find(x => x.id === tid);
              if (!tg) return null;
              return (
                <Chip
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

        {/* 标题输入 */}
        <TextInput
          value={entry.title}
          onChangeText={title => updateEditorDraft({ title })}
          placeholder="标题（可选）"
          placeholderTextColor={c.textMuted}
          style={[
            t.h1,
            {
              fontSize: fs(21),
              color: c.text,
              paddingVertical: 8,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: c.divider,
              marginBottom: 12,
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
                  onToggleTodo={lineIdx => setBody(toggleTodoAtLine(entry.body, lineIdx), { step: true })}
                />
              ) : (
                <Text style={{ fontSize: fs(15), color: c.textMuted }}>暂无正文内容，点击返回编辑…</Text>
              )}
            </Pressable>
          ) : (
            <TextInput
              ref={bodyRef}
              value={entry.body}
              selection={forcedSel}
              onChangeText={body => {
                // 在列表、待办、引用行里回车：自动接上下一项
                const caret = selection.start === selection.end ? selection.start : undefined;
                const cont = continueListOnEnter(entry.body, body, caret);
                if (cont) setBody(cont.text, { step: true, select: [cont.cursor, cont.cursor] });
                else setBody(body);
              }}
              onSelectionChange={e => setSelection(e.nativeEvent.selection)}
              placeholder="写下此刻的想法…"
              placeholderTextColor={c.textMuted}
              multiline
              textAlignVertical="top"
              style={{
                fontFamily: t.bodySerif.fontFamily,
                fontSize: fs(16),
                lineHeight: fs(16) * lineHeight,
                color: c.text,
                minHeight: 180,
                paddingVertical: 4,
                outlineStyle: 'none',
              } as any}
            />
          )}
        </View>

        {/* 空白写作灵感引导条 */}
        {!entry.title && !entry.body && !previewMode && (
          <View style={{ marginTop: 10, backgroundColor: c.cardAlt, borderRadius: 14, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider, gap: 8 }}>
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

        {/* 多图排版切换器 + 照片预览 */}
        {entry.photos.length >= 2 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: -8 }}>
            <Text style={{ fontSize: fs(12), color: c.textSub }}>图片排版 ({entry.photos.length} 张)</Text>
            <View style={{ flexDirection: 'row', backgroundColor: c.bgDeep, borderRadius: 999, padding: 2 }}>
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
                      borderRadius: 999,
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
            <Square size={10} color="#fff" fill="#fff" />
            <Text style={{ fontSize: fs(11.5), color: '#fff', fontWeight: '600' }}>停止</Text>
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
            height: formatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 46] }),
            opacity: formatAnim,
            overflow: 'hidden',
            borderBottomWidth: formatOpen ? StyleSheet.hairlineWidth : 0,
            borderBottomColor: c.divider,
          }}
        >
          <View style={{ height: 46, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 6, marginRight: 4, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: c.divider }}>
              {[
                { icon: Undo2, label: '撤销', on: history.canUndo, onPress: undo },
                { icon: Redo2, label: '重做', on: history.canRedo, onPress: redo },
              ].map(tool => (
                <Pressable
                  key={tool.label}
                  accessibilityLabel={tool.label}
                  disabled={!tool.on}
                  onPress={tool.onPress}
                  hitSlop={4}
                  style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', opacity: tool.on ? 1 : 0.3, backgroundColor: pressed ? c.bgDeep : 'transparent' })}
                >
                  <tool.icon size={17} color={c.text} strokeWidth={1.8} />
                </Pressable>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', paddingRight: 6 }} style={{ flex: 1 }}>
              {[
                { icon: Heading1, label: '小标题', onPress: () => applyFormat('h') },
                { icon: Bold, label: '加粗', onPress: () => applyFormat('b') },
                { icon: Italic, label: '斜体', onPress: () => applyFormat('i') },
                { icon: Underline, label: '下划线', onPress: () => applyFormat('u') },
                { icon: Quote, label: '引用', onPress: () => applyFormat('quote') },
                { icon: CheckSquare, label: '待办', onPress: () => applyFormat('todo') },
                { icon: List, label: '无序列表', onPress: () => applyFormat('ul') },
                { icon: ListOrdered, label: '有序列表', onPress: () => applyFormat('ol') },
                { icon: Minus, label: '分割线', onPress: () => applyFormat('hr') },
              ].map(tool => (
                <Pressable key={tool.label} accessibilityLabel={tool.label} onPress={tool.onPress} hitSlop={4} style={({ pressed }) => ({ width: 36, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.bgDeep : 'transparent' })}>
                  <tool.icon size={17} color={c.text} strokeWidth={1.8} />
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
            style={{ width: 40, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: formatOpen ? c.primaryFaint : 'transparent' }}
          >
            <Type size={19} color={formatOpen ? c.primaryDark : c.text} strokeWidth={1.8} />
          </PressableScale>
          <View style={{ width: StyleSheet.hairlineWidth, height: 22, backgroundColor: c.divider, marginHorizontal: 4 }} />

          <View ref={attachTarget} collapsable={false} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
            {[
              { icon: ImageIcon, label: '图片', active: false, onPress: () => router.push('/picker/photos') },
              { icon: Video, label: '视频', active: false, onPress: () => router.push('/picker/video') },
              { icon: Mic, label: '录音', active: false, onPress: () => router.push('/picker/audio') },
              ...(dictationSupported
                ? [{ icon: AudioLines, label: dictating ? '停止听写' : '听写', active: dictating, onPress: toggleDictation }]
                : []),
              { icon: MapPin, label: '地点天气', active: false, onPress: () => router.push('/picker/location') },
              { icon: TagIcon, label: '标签', active: false, onPress: () => router.push('/picker/tags') },
              { icon: Smile, label: '心情', active: false, onPress: () => router.push('/picker/mood') },
            ].map(att => (
              <PressableScale
                key={att.label}
                scaleTo={0.86}
                onPress={att.onPress}
                accessibilityLabel={att.label}
                style={{ width: 38, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: att.active ? c.dangerSoft : 'transparent' }}
              >
                <att.icon size={19} color={att.active ? c.danger : c.primaryDark} strokeWidth={1.7} />
              </PressableScale>
            ))}
          </View>

          <View style={{ width: StyleSheet.hairlineWidth, height: 22, backgroundColor: c.divider, marginHorizontal: 4 }} />
          <PressableScale
            scaleTo={0.9}
            onPress={() => setPreviewMode(v => !v)}
            accessibilityLabel={previewMode ? '返回编辑' : '预览排版'}
            style={{ width: 40, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: previewMode ? c.primaryFaint : 'transparent' }}
          >
            {previewMode ? <EyeOff size={18} color={c.primaryDark} strokeWidth={1.8} /> : <Eye size={18} color={c.text} strokeWidth={1.8} />}
          </PressableScale>
        </View>
      </View>

      {/* 退出保护弹窗（设计稿2 #12） */}
      <PopDialog visible={exitModal} onClose={() => setExitModal(false)} maxWidth={330} style={{ padding: 24 }}>
        <Text style={[t.h2, { textAlign: 'center', fontSize: fs(18) }]}>是否保存为草稿？</Text>
        <Text style={[t.sub, { textAlign: 'center', marginTop: 10 }]}>当前内容尚未发布，退出前是否保存为草稿？</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 22 }}>
          <PressableScale onPress={discardAndExit} style={{ flex: 1, height: 42, borderRadius: 21, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: fs(14), color: c.textSub }}>不保存</Text>
          </PressableScale>
          <PressableScale onPress={saveAsDraftAndExit} style={{ flex: 1, height: 42, borderRadius: 21, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: fs(14), color: '#fff', fontWeight: '600' }}>保存草稿</Text>
          </PressableScale>
        </View>
      </PopDialog>

      {/* 日记本选择弹窗 */}
      <PopDialog visible={nbModal} onClose={() => setNbModal(false)} maxWidth={330} style={{ padding: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <BookOpen size={17} color={c.primaryDark} />
            <Text style={[t.h3, { fontSize: fs(16) }]}>选择日记本</Text>
          </View>
          <Pressable
            hitSlop={8}
            onPress={() => {
              setNbModal(false);
              router.push('/notebooks');
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
                  borderRadius: 12,
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

      <PhotoViewer photos={entry.photos} initialIndex={viewerIdx ?? 0} visible={viewerIdx !== null} onClose={() => setViewerIdx(null)} />
    </Screen>
  );
}
