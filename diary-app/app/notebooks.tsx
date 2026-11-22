import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, FlatList, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '../src/components/text';
import { router } from 'expo-router';
import { Check, Edit3, FolderOpen, MoreHorizontal, Plus, Trash2, X } from 'lucide-react-native';
import { useIllustrations, useTheme } from '../src/theme/ThemeProvider';
import { mixHex } from '../src/theme/palette';
import { actions, inNotebook, useStore } from '../src/store/store';
import type { Entry, MoodKey, Notebook } from '../src/store/types';
import { DEFAULT_NOTEBOOK_ID, NOTEBOOK_COLORS, moodMeta } from '../src/data/constants';
import { Button, Field, Illustration, NavBar, Screen, TextAction, haptic, webSpaceAction } from '../src/components/ui';
import { BookCover, BookRibbon } from '../src/components/Book';
import { MoodIcon } from '../src/components/MoodIcon';
import { useFeedback } from '../src/components/feedback';
import { BottomSheet, ND, useReducedMotion } from '../src/components/motion';
import { Image as ExpoImage } from 'expo-image';
import { PAPER_IMAGES } from '../src/data/assets';
import { plainText } from '../src/utils/text';

type OpenBook = { id: string | null; name: string; color: string; rect: { x: number; y: number; w: number; h: number } };
type TocRow = { type: 'month'; key: string; label: string } | { type: 'entry'; key: string; entry: Entry };

const PAGE_TEXT = '#1F2528';
const PAGE_SUB = '#545B60';

/** 书架页：日记本排列成书，点按翻开目录，合上回到书架 */
export default function NotebooksScreen() {
  const { c, fs, r, ink } = useTheme();
  const { toast, confirm, sheet } = useFeedback();
  const notebooks = useStore(s => s.notebooks);
  const activeNotebook = useStore(s => s.activeNotebook);
  const entries = useStore(s => s.entries);
  const reduced = useReducedMotion();
  const { width: winW, height: winH } = useWindowDimensions();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Notebook | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [nameError, setNameError] = useState('');
  const [colorInput, setColorInput] = useState<string>(NOTEBOOK_COLORS[0]);

  const [open, setOpen] = useState<OpenBook | null>(null);
  const [pageReady, setPageReady] = useState(false);
  const coverRefs = useRef(new Map<string, View>());
  const titleRef = useRef<any>(null);
  const fly = useRef(new Animated.Value(0)).current; // 0 在书架原位 → 1 居中翻开位
  const flip = useRef(new Animated.Value(0)).current; // 封面翻转角度 0 → 165
  const fade = useRef(new Animated.Value(0)).current; // 遮罩 / 减动效交叉淡入
  const edges = useRef(new Animated.Value(0)).current; // 书口层叠 / 书脊条，翻页完成后淡入

  // 翻开后的目标位：居中，宽 = min(屏宽-40, 380)，高 = 宽×1.38
  const bookW = Math.min(winW - 40, 380);
  const bookH = bookW * 1.38;
  const target = { x: (winW - bookW) / 2, y: Math.max(24, (winH - bookH) / 2) };

  const counts = useMemo(() => {
    const map = new Map<string | null, number>();
    const alive = entries.filter(e => !e.deletedAt && !e.hidden && e.status === 'published');
    map.set(null, alive.length);
    for (const nb of notebooks) {
      map.set(nb.id, alive.filter(e => inNotebook(e, nb.id)).length);
    }
    return map;
  }, [entries, notebooks]);

  // 每本封面拍立得：取该本（或全部）最近一篇带照片的可见日记
  const coverPhotos = useMemo(() => {
    const alive = entries
      .filter(e => !e.deletedAt && !e.hidden && e.status === 'published')
      .sort((a, b) => b.createdAt - a.createdAt);
    const map = new Map<string | null, string>();
    const find = (id: string | null) => alive.find(e => e.photos.length > 0 && inNotebook(e, id))?.photos[0];
    const all = find(null);
    if (all) map.set(null, all);
    for (const nb of notebooks) {
      const p = find(nb.id);
      if (p) map.set(nb.id, p);
    }
    return map;
  }, [entries, notebooks]);

  const openBook = (book: Omit<OpenBook, 'rect'>) => {
    haptic('light');
    const node = book.id == null ? coverRefs.current.get('__all__') : coverRefs.current.get(book.id);
    const go = (rect: OpenBook['rect']) => {
      setPageReady(false);
      setOpen({ ...book, rect });
    };
    if (node?.measureInWindow) node.measureInWindow((x, y, w, h) => go({ x, y, w, h }));
    else go({ x: target.x, y: target.y, w: bookW, h: bookH });
  };

  const closeBook = React.useCallback(() => {
    fly.stopAnimation();
    flip.stopAnimation();
    fade.stopAnimation();
    edges.stopAnimation();
    if (reduced) {
      Animated.timing(fade, { toValue: 0, duration: 150, useNativeDriver: ND }).start(({ finished }) => finished && setOpen(null));
      return;
    }
    Animated.sequence([
      Animated.timing(flip, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.cubic), useNativeDriver: ND }),
      Animated.parallel([
        Animated.timing(fly, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
        Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: ND }),
      ]),
    ]).start(({ finished }) => finished && setOpen(null));
  }, [fly, flip, fade, edges, reduced]);

  // 翻开动画：飞入 320ms → 140ms 起封面左缘 3D 翻开 440ms
  useEffect(() => {
    if (!open) return;
    fly.stopAnimation();
    flip.stopAnimation();
    fade.stopAnimation();
    edges.stopAnimation();
    if (reduced) {
      fly.setValue(1);
      flip.setValue(165);
      edges.setValue(1);
      setPageReady(true);
      Animated.timing(fade, { toValue: 1, duration: 150, useNativeDriver: ND }).start();
    } else {
      fly.setValue(0);
      flip.setValue(0);
      edges.setValue(0);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: ND }),
        Animated.timing(fly, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
        Animated.sequence([
          Animated.delay(140),
          Animated.timing(flip, { toValue: 165, duration: 440, easing: Easing.inOut(Easing.cubic), useNativeDriver: ND }),
        ]),
        // 书口/封底板层在翻页完成后淡入
        Animated.sequence([
          Animated.delay(560),
          Animated.timing(edges, { toValue: 1, duration: 120, useNativeDriver: ND }),
        ]),
      ]).start(({ finished }) => finished && setPageReady(true));
    }
    const focusTimer = setTimeout(() => titleRef.current?.focus?.(), reduced ? 200 : 700);
    return () => clearTimeout(focusTimer);
  }, [open, fly, flip, fade, reduced]);

  // 关闭触发：Android 返回键 / web Escape
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeBook();
      return true;
    });
    const onKey = (e: any) => {
      if (e.key === 'Escape') closeBook();
    };
    if (Platform.OS === 'web') document.addEventListener('keydown', onKey);
    return () => {
      sub.remove();
      if (Platform.OS === 'web') document.removeEventListener('keydown', onKey);
    };
  }, [open, closeBook]);

  const openCreate = () => {
    setNameError('');
    setEditing(null);
    setNameInput('');
    setColorInput(NOTEBOOK_COLORS[notebooks.length % NOTEBOOK_COLORS.length]);
    setModalOpen(true);
  };

  const openEdit = (nb: Notebook) => {
    setNameError('');
    setEditing(nb);
    setNameInput(nb.name);
    setColorInput(nb.color);
    setModalOpen(true);
  };

  const saveModal = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setNameError('请输入日记本名称');
      return;
    }
    if (editing) {
      actions.updateNotebook(editing.id, { name: trimmed, color: colorInput });
      toast('已更新日记本');
    } else {
      const created = actions.addNotebook(trimmed, colorInput);
      if (created) toast(`已创建「${created.name}」`);
    }
    setModalOpen(false);
  };

  const onNotebookPress = (nb: Notebook) => {
    const isDefault = nb.id === DEFAULT_NOTEBOOK_ID;
    sheet(
      [
        {
          label: '在首页查看此日记本',
          icon: FolderOpen,
          onPress: () => {
            actions.setActiveNotebook(nb.id);
            router.replace('/(tabs)');
          },
        },
        {
          label: '重命名或更换颜色',
          icon: Edit3,
          onPress: () => openEdit(nb),
        },
        ...(!isDefault
          ? [
              {
                label: '删除日记本',
                icon: Trash2,
                destructive: true,
                onPress: async () => {
                  const ok = await confirm({
                    title: `删除「${nb.name}」？`,
                    message: '其中的日记将自动移入「我的日记」，不会丢失任何内容。',
                    confirmText: '删除',
                    destructive: true,
                    icon: 'danger',
                  });
                  if (!ok) return;
                  actions.removeNotebook(nb.id);
                  toast('已删除日记本，日记已归入「我的日记」');
                },
              },
            ]
          : []),
      ],
      nb.name,
    );
  };

  const renderTile = (id: string | null, name: string, color: string, tileW: number, tilt: string, nb?: Notebook) => {
    const count = counts.get(id) ?? 0;
    const active = id === null ? activeNotebook === null : activeNotebook === id;
    const refKey = id ?? '__all__';
    return (
      <View key={refKey} style={{ width: tileW, minWidth: 0 }}>
        <View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`日记本 ${name}，${count} 篇，点按翻开`}
            onPress={() => openBook({ id, name, color })}
            onLongPress={nb ? () => onNotebookPress(nb) : undefined}
            delayLongPress={350}
          >
            <View ref={el => { if (el) coverRefs.current.set(refKey, el); else coverRefs.current.delete(refKey); }} collapsable={false}>
              <BookCover color={color} name={name} count={count} photo={coverPhotos.get(id)} photoTilt={tilt} />
            </View>
            {active && <BookRibbon color={c.primary} />}
            {active && (
              <View style={{ position: 'absolute', top: 9, left: 38, paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: r(999), backgroundColor: c.primary }}>
                <Text style={{ fontSize: fs(9), color: '#FFFFFF', fontWeight: '600' }}>当前查看</Text>
              </View>
            )}
          </Pressable>
          {nb && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`管理${nb.name}`}
              onPress={() => onNotebookPress(nb)}
              hitSlop={8}
              style={{ position: 'absolute', top: 0, right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,253,248,0.9)', alignItems: 'center', justifyContent: 'center' }}>
                <MoreHorizontal size={15} color="#3A4148" />
              </View>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const openBookEntries = useMemo(() => {
    if (!open) return [];
    return entries
      .filter(e => !e.deletedAt && !e.hidden && e.status === 'published' && inNotebook(e, open.id))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [entries, open]);

  const dx = open ? open.rect.x + open.rect.w / 2 - (target.x + bookW / 2) : 0;
  const dy = open ? open.rect.y + open.rect.h / 2 - (target.y + bookH / 2) : 0;
  const sc = open ? open.rect.w / bookW : 1;
  const flipDeg = flip.interpolate({ inputRange: [0, 165], outputRange: ['0deg', '-165deg'] });
  const coverOpacity = reduced ? 0 : flip.interpolate({ inputRange: [0, 110, 165], outputRange: [1, 1, 0] });

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar title="我的日记本" right={<TextAction label="新建" bold color={c.primaryDark} onPress={openCreate} />} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 36 }}>
        {(() => {
          // 书宽 = min((内容宽-22)/2, 150)，两本一排放上横板
          const tileW = Math.min((winW - 40 - 22) / 2, 150);
          const tiles: React.ReactNode[] = [
            renderTile(null, '全部日记', c.primary, tileW, '-5deg'),
            ...notebooks.map((nb, i) => renderTile(nb.id, nb.name, nb.color, tileW, i % 2 === 0 ? '-5deg' : '4deg', nb)),
            <Pressable
              key="__create__"
              accessibilityRole="button"
              accessibilityLabel="新建日记本"
              onPress={openCreate}
              style={{ width: tileW, aspectRatio: 3 / 4, borderRadius: r(12), borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.textMuted, alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Plus size={22} color={c.textMuted} />
              <Text style={{ fontSize: fs(13), color: c.textMuted }}>新建日记本</Text>
            </Pressable>,
          ];
          const plankColor = ink.on ? mixHex(c.bgDeep, ink.line, 0.18) : c.border;
          const plankShadow = ink.on ? `0px 4px 0px ${ink.line}` : '0px 6px 10px rgba(0,0,0,0.08)';
          const rows: React.ReactNode[][] = [];
          for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));
          return rows.map((rowTiles, i) => (
            <View key={`shelf_${i}`} style={{ marginBottom: 28 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 22 }}>
                {rowTiles}
              </View>
              <View style={{ height: 8, borderRadius: 3, backgroundColor: plankColor, boxShadow: plankShadow }} />
            </View>
          ));
        })()}
      </ScrollView>

      {open && (
        <View style={StyleSheet.absoluteFill} accessibilityViewIsModal accessibilityLabel={`日记本：${open.name}`}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay, opacity: fade }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="合上日记本" onPress={closeBook} style={{ flex: 1 }} />
          </Animated.View>

          <Animated.View
            style={{
              position: 'absolute',
              left: target.x,
              top: target.y,
              width: bookW,
              height: bookH,
              transform: [
                { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [dx, 0] }) },
                { translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) },
                { scale: fly.interpolate({ inputRange: [0, 1], outputRange: [sc, 1] }) },
              ],
            }}
          >
            {/* 封底板 + 书口层叠页边（翻页完成后淡入，营造厚度） */}
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: edges }]}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: open.color, borderRadius: r(12), transform: [{ translateX: 10 }, { translateY: 10 }] }]} />
              {([['#D3CBBB', 6], ['#DDD6C8', 4], ['#E6E0D4', 2]] as const).map(([col, off]) => (
                <View key={col} style={[StyleSheet.absoluteFill, { backgroundColor: col, borderRadius: r(12), transform: [{ translateX: off }, { translateY: off }] }]} />
              ))}
            </Animated.View>

            {/* 内页：目录（封底之下，翻开即见） */}
            <BookPage
              ready={pageReady}
              notebookId={open.id}
              name={open.name}
              color={open.color}
              entries={openBookEntries}
              titleRef={titleRef}
              fs={fs}
              onClose={closeBook}
            />

            {/* 封面：左缘铰链翻起，含正面封面与内衬面 */}
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: coverOpacity,
                  transform: [{ perspective: 1400 }, { translateX: -bookW / 2 }, { rotateY: flipDeg }, { translateX: bookW / 2 }],
                },
              ]}
            >
              <View style={[StyleSheet.absoluteFill, { backfaceVisibility: 'hidden' }]}>
                <BookCover color={open.color} name={open.name} count={counts.get(open.id) ?? 0} photo={coverPhotos.get(open.id)} style={{ width: '100%' }} />
              </View>
              {/* 封面内衬 */}
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backfaceVisibility: 'hidden', backgroundColor: '#F3EFE6', borderRadius: r(12), alignItems: 'center', justifyContent: 'center', transform: [{ rotateY: '180deg' }] },
                ]}
              >
                <Text style={{ fontSize: fs(20), color: 'rgba(60,54,44,0.4)', letterSpacing: 6, transform: [{ rotate: '-12deg' }] }}>记得</Text>
                <Text style={{ fontSize: fs(10), color: 'rgba(60,54,44,0.32)', marginTop: 8, letterSpacing: 2 }}>EX LIBRIS</Text>
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      )}

      {/* 新建 / 编辑日记本弹窗 */}
      <BottomSheet visible={modalOpen} onClose={() => setModalOpen(false)} title={editing ? '编辑日记本' : '新建日记本'} keyboard>
          <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">

            <Text style={{ fontSize: fs(12.5), color: c.textSub, marginBottom: 6 }}>名称</Text>
            <Field
              accessibilityLabel="日记本名称" error={nameError}
              value={nameInput}
              onChangeText={value => { setNameInput(value); setNameError(''); }}
              placeholder="例如：读书摘抄、旅行手记、工作复盘…"
              maxLength={16}
            />

            <Text style={{ fontSize: fs(12.5), color: c.textSub, marginTop: 6, marginBottom: 10 }}>主题标识色</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
              {NOTEBOOK_COLORS.map((col, index) => {
                const picked = colorInput === col;
                return (
                  <Pressable
                    key={col}
                    {...webSpaceAction(() => { haptic('light'); setColorInput(col); })}
                    accessibilityRole="radio" accessibilityLabel={`标识色 ${index + 1}`} accessibilityState={{ checked: picked }} aria-checked={picked}
                    onPress={() => {
                      haptic('light');
                      setColorInput(col);
                    }}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: col,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: picked ? 2.5 : 0,
                      borderColor: c.text,
                    }}
                  >
                    {picked && <Check size={16} color="#fff" strokeWidth={3} />}
                  </Pressable>
                );
              })}
            </View>

          </ScrollView>
          <Button title={editing ? '保存修改' : '创建日记本'} onPress={saveModal} style={{ marginTop: 12 }} />
      </BottomSheet>
    </Screen>
  );
}

/** 翻开的书页：纸底 + 书脊条 + 按月分组的目录 */
function BookPage({ ready, notebookId, name, color, entries, titleRef, fs, onClose }: { ready: boolean; notebookId: string | null; name: string; color: string; entries: Entry[]; titleRef: any; fs: (n: number) => number; onClose: () => void }) {
  const { t, r } = useTheme();
  const rows = useMemo<TocRow[]>(() => {
    const out: TocRow[] = [];
    let lastMonth = '';
    for (const e of entries) {
      const d = new Date(e.createdAt);
      const mk = `${d.getFullYear()}-${d.getMonth()}`;
      if (mk !== lastMonth) {
        lastMonth = mk;
        out.push({ type: 'month', key: `m_${mk}`, label: `${d.getFullYear()}年${d.getMonth() + 1}月` });
      }
      out.push({ type: 'entry', key: e.id, entry: e });
    }
    return out;
  }, [entries]);

  const range = useMemo(() => {
    if (!entries.length) return '';
    const first = new Date(entries[entries.length - 1].createdAt);
    const last = new Date(entries[0].createdAt);
    const f = (d: Date) => `${d.getFullYear()}.${d.getMonth() + 1}`;
    return `${f(first)} — ${f(last)} · 共 ${entries.length} 篇`;
  }, [entries]);

  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius: r(12), overflow: 'hidden', backgroundColor: '#F7F4EC' }]}>
      <ExpoImage source={PAPER_IMAGES['paper-white'] as any} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={120} pointerEvents="none" />
      {/* 书脊条（封面色压深）+ 装订线阴影 */}
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 12, backgroundColor: mixHex(color, '#000000', 0.18), borderTopLeftRadius: r(12), borderBottomLeftRadius: r(12) }} />
      <View style={{ position: 'absolute', left: 12, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(0,0,0,0.08)' }} />
      <View style={{ position: 'absolute', left: 13, top: 0, bottom: 0, width: 8, backgroundColor: 'rgba(0,0,0,0.025)' }} />

      <View style={{ flex: 1, paddingLeft: 36, paddingRight: 10, paddingTop: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <Text ref={titleRef} tabIndex={0} numberOfLines={1} style={[t.h2, { flex: 1, fontSize: fs(20), color: PAGE_TEXT }]}>{name}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="合上日记本"
            onPress={onClose}
            hitSlop={8}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={18} color={PAGE_SUB} />
          </Pressable>
        </View>
        {!!range && <Text style={{ fontSize: fs(12), color: PAGE_SUB, marginTop: 2 }}>{range}</Text>}
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.14)', marginTop: 10, marginBottom: 4 }} />

        {ready && (
          entries.length ? (
            <FlatList
              data={rows}
              keyExtractor={row => row.key}
              initialNumToRender={12}
              windowSize={5}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 10 }}
              renderItem={({ item }) =>
                item.type === 'month' ? (
                  <Text style={{ fontSize: fs(12), color: PAGE_SUB, fontWeight: '600', marginTop: 12, marginBottom: 2 }}>{item.label}</Text>
                ) : (
                  <TocEntryRow entry={item.entry} fs={fs} />
                )
              }
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 30 }}>
              <Illustration name="emptyBook" size={120} />
              <Text style={{ fontSize: fs(15), color: PAGE_TEXT, fontWeight: '600', marginTop: 10 }}>这本还空着</Text>
              <Text style={{ fontSize: fs(12), color: PAGE_SUB, marginTop: 4 }}>写下的第一篇会出现在这里</Text>
            </View>
          )
        )}

        <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 12 }}>
          {notebookId != null ? (
            <>
              <Button title="在这本里写" size="sm" full={false} style={{ flex: 1 }} onPress={() => router.push({ pathname: '/write', params: { notebook: notebookId } })} />
              <Button title="在首页只看这本" variant="secondary" size="sm" full={false} style={{ flex: 1.3 }} onPress={() => { actions.setActiveNotebook(notebookId); router.replace('/(tabs)'); }} />
            </>
          ) : (
            <>
              <Button title="写一篇" size="sm" full={false} style={{ flex: 1 }} onPress={() => router.push('/write')} />
              <Button title="在首页看全部" variant="secondary" size="sm" full={false} style={{ flex: 1.3 }} onPress={() => { actions.setActiveNotebook(null); router.replace('/(tabs)'); }} />
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function TocEntryRow({ entry, fs }: { entry: Entry; fs: (n: number) => number }) {
  const d = new Date(entry.createdAt);
  const mood = moodMeta(entry.mood as MoodKey | undefined);
  const title = entry.title.trim() || plainText(entry.body).split('\n')[0]?.trim() || '无题日记';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${d.getDate()}日，${title}`}
      onPress={() => router.push(`/memory/${entry.id}`)}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.07)', backgroundColor: pressed ? 'rgba(0,0,0,0.04)' : 'transparent' })}
    >
      <Text style={{ width: 26, fontSize: fs(15), color: PAGE_TEXT, fontVariant: ['tabular-nums'], textAlign: 'right' }}>{d.getDate()}</Text>
      {mood ? <MoodIcon mood={mood.key} size={18} /> : <View style={{ width: 18 }} />}
      <Text numberOfLines={1} style={{ flex: 1, fontSize: fs(14.5), color: PAGE_TEXT }}>{title}</Text>
    </Pressable>
  );
}
