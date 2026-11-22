import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, PointerType } from 'react-native-gesture-handler';
import Reanimated, {
  scrollTo, useAnimatedReaction, useAnimatedRef, useAnimatedStyle, useFrameCallback, useScrollViewOffset, useSharedValue, withSequence, withSpring, withTiming, runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { Text } from './text';
import { router, useFocusEffect } from 'expo-router';
import { PAPER, showCurtain } from './curtain';
import { ArrowLeft, ArrowRight, Check, Edit3, FolderOpen, MoreHorizontal, PenLine, Plus, Search, Trash2, X } from 'lucide-react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';
import { mixHex } from '../theme/palette';
import { actions, inNotebook, openTutorial, useHydrated, useStore } from '../store/store';
import type { Notebook } from '../store/types';
import { DEFAULT_NOTEBOOK_ID, NOTEBOOK_COLORS } from '../data/constants';
import { IMAGES, PAPER_IMAGES, photoSource } from '../data/assets';
import { Button, Field, IconButton, Illustration, Screen, TextAction, haptic, webSpaceAction } from './ui';
import { BookCover, BookRibbon } from './Book';
import { TodayCard } from './TodayCard';
import { useFeedback } from './feedback';
import { BottomSheet, ND, useReducedMotion } from './motion';
import { useTourTarget } from './tour';
import { fmtMonthDay, greetingFor, WEEK_CN } from '../utils/date';
import { usePhotoUri } from '../utils/usePhotoUri';
import { moveId, nearestSlot, slotPosition, sortNotebooks, type ShelfGeo } from '../utils/shelf';

type OpenBook = { id: string | null; name: string; color: string; rect: { x: number; y: number; w: number; h: number } };

const PAGE_TEXT = '#1F2528';
const PAGE_SUB = '#545B60';
const COVER_ASPECT = 1.38;
const TILE_MAX = 150;
const TILE_GAP = 22;

export function shelfColumns(contentW: number) {
  return Math.max(2, Math.min(5, Math.floor((contentW - 40 + TILE_GAP) / (TILE_MAX + TILE_GAP))));
}

/** 书架：日记本排列成书，点按翻开并走进这本书；从书里返回时合上放回原位 */
export function Bookshelf() {
  const { c, t, fs, r, ink, frameInk } = useTheme();
  const { toast, confirm, sheet } = useFeedback();
  const hydrated = useHydrated();
  const rawNotebooks = useStore(s => s.notebooks);
  const notebooks = useMemo(() => sortNotebooks(rawNotebooks), [rawNotebooks]);
  const dragHintSeen = useStore(s => s.shelfDragHintSeen);
  const activeNotebook = useStore(s => s.activeNotebook);
  const entries = useStore(s => s.entries);
  const profile = useStore(s => s.profile);
  const onboarded = useStore(s => s.onboarded);
  const shelfTourSeen = useStore(s => s.shelfTourSeen);
  const avatarUri = usePhotoUri(profile.avatar);
  const reduced = useReducedMotion();
  const { width: winW, height: winH } = useWindowDimensions();
  const rootRef = useRef<View>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const cw = box?.w ?? Math.min(winW, 760);
  const ch = box?.h ?? winH;
  const contentW = Math.min(cw, 680);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Notebook | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [nameError, setNameError] = useState('');
  const [colorInput, setColorInput] = useState<string>(NOTEBOOK_COLORS[0]);

  const [open, setOpen] = useState<OpenBook | null>(null);
  const [entered, setEntered] = useState(false);
  const enteredRef = useRef(false);
  const expandedRef = useRef(false);
  const coverRefs = useRef(new Map<string, View>());
  const titleRef = useRef<any>(null);
  const booksTarget = useTourTarget('shelf.books');
  const fly = useRef(new Animated.Value(0)).current; // 0 在书架原位 → 1 居中翻开位
  const flip = useRef(new Animated.Value(0)).current; // 封面翻转角度 0 → 165
  const fade = useRef(new Animated.Value(0)).current; // 遮罩 / 减动效交叉淡入
  const edges = useRef(new Animated.Value(0)).current; // 书口层叠 / 书脊条，翻页完成后淡入
  const leaves = useRef([0, 1, 2].map(() => new Animated.Value(0))).current; // 翻开时三张薄页依次掀起
  const expand = useRef(new Animated.Value(0)).current; // 书页放大铺满，随后淡入进入书内

  const bookW = Math.min(cw - 40, 380, (ch - 32) / COVER_ASPECT);
  const bookH = bookW * COVER_ASPECT;
  const target = { x: (cw - bookW) / 2, y: Math.max(16, (ch - bookH) / 2) };
  const fillScale = Math.max(cw / bookW, ch / bookH) * 1.02;

  const aliveEntries = useMemo(() => entries.filter(e => !e.deletedAt && !e.hidden && e.status === 'published'), [entries]);

  const counts = useMemo(() => {
    const map = new Map<string | null, number>();
    map.set(null, aliveEntries.length);
    for (const nb of notebooks) map.set(nb.id, aliveEntries.filter(e => inNotebook(e, nb.id)).length);
    return map;
  }, [aliveEntries, notebooks]);

  const coverPhotos = useMemo(() => {
    const sorted = [...aliveEntries].sort((a, b) => b.createdAt - a.createdAt);
    const map = new Map<string | null, string>();
    const find = (id: string | null) => sorted.find(e => e.photos.length > 0 && inNotebook(e, id))?.photos[0];
    const all = find(null);
    if (all) map.set(null, all);
    for (const nb of notebooks) {
      const p = find(nb.id);
      if (p) map.set(nb.id, p);
    }
    return map;
  }, [aliveEntries, notebooks]);

  const bookInfo = useMemo(() => {
    if (!open) return { range: '', count: 0 };
    const list = aliveEntries.filter(e => inNotebook(e, open.id)).sort((a, b) => b.createdAt - a.createdAt);
    if (!list.length) return { range: '这本还空着', count: 0 };
    const f = (ts: number) => {
      const d = new Date(ts);
      return `${d.getFullYear()}.${d.getMonth() + 1}`;
    };
    return { range: `${f(list[list.length - 1].createdAt)} — ${f(list[0].createdAt)}`, count: list.length };
  }, [aliveEntries, open]);

  const openBook = (book: Omit<OpenBook, 'rect'>) => {
    if (open) return;
    haptic('light');
    const node = coverRefs.current.get(book.id ?? '__all__');
    const go = (rect: OpenBook['rect']) => setOpen({ ...book, rect });
    const root = rootRef.current;
    if (node?.measureInWindow && root?.measureInWindow) {
      root.measureInWindow((rx, ry) => node.measureInWindow((x, y, w, h) => go({ x: x - rx, y: y - ry, w, h })));
    } else go({ x: target.x, y: target.y, w: bookW, h: bookH });
  };

  const stopAll = React.useCallback(() => {
    fly.stopAnimation();
    flip.stopAnimation();
    fade.stopAnimation();
    edges.stopAnimation();
    expand.stopAnimation();
    leaves.forEach(l => l.stopAnimation());
  }, [fly, flip, fade, edges, expand, leaves]);

  const closeBook = React.useCallback(() => {
    stopAll();
    enteredRef.current = false;
    setEntered(false);
    if (reduced) {
      Animated.timing(fade, { toValue: 0, duration: 150, useNativeDriver: ND }).start(({ finished }) => finished && setOpen(null));
      return;
    }
    // 合上要比翻开快：回来的动作不该让人等。书页瞬间收回书本大小，封面合拢的同时飞回原位
    expand.setValue(0);
    edges.setValue(0);
    leaves.forEach(l => l.setValue(0));
    Animated.parallel([
      Animated.timing(flip, { toValue: 0, duration: 250, easing: Easing.inOut(Easing.cubic), useNativeDriver: ND }),
      Animated.sequence([
        Animated.delay(110),
        Animated.parallel([
          Animated.timing(fly, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
          Animated.timing(fade, { toValue: 0, duration: 260, useNativeDriver: ND }),
        ]),
      ]),
    ]).start(({ finished }) => {
      if (finished) {
        expandedRef.current = false;
        setOpen(null);
      }
    });
  }, [fly, flip, fade, edges, expand, leaves, reduced, stopAll]);

  const enterBook = React.useCallback(
    (id: string | null) => {
      if (enteredRef.current) return;
      enteredRef.current = true;
      setEntered(true);
      actions.setActiveNotebook(id);
      // 书页已铺满：用同一张纸色的纸幕接住，路由在纸下切换，书内页面就绪后纸幕淡出
      showCurtain(PAPER);
      router.push('/(tabs)');
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    stopAll();
    expandedRef.current = false;
    expand.setValue(0);
    const id = open.id;
    if (reduced) {
      fly.setValue(1);
      flip.setValue(165);
      edges.setValue(0);
      leaves.forEach(l => l.setValue(0));
      expandedRef.current = true;
      expand.setValue(1);
      Animated.timing(fade, { toValue: 1, duration: 150, useNativeDriver: ND }).start(({ finished }) => finished && enterBook(id));
    } else {
      fly.setValue(0);
      flip.setValue(0);
      edges.setValue(0);
      leaves.forEach(l => l.setValue(0));
      // 一条连续的时间线（约 620ms）：飞出 → 封面翻开 → 三页连翻 → 书页铺满，各段相互重叠，不停顿
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: ND }),
        Animated.timing(fly, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
        Animated.sequence([
          Animated.delay(40),
          Animated.timing(flip, { toValue: 165, duration: 300, easing: Easing.inOut(Easing.cubic), useNativeDriver: ND }),
        ]),
        Animated.sequence([
          Animated.delay(230),
          Animated.stagger(45, leaves.map(l => Animated.timing(l, { toValue: 170, duration: 160, easing: Easing.inOut(Easing.cubic), useNativeDriver: ND }))),
        ]),
        Animated.sequence([
          Animated.delay(410),
          Animated.timing(expand, { toValue: 1, duration: 210, easing: Easing.inOut(Easing.cubic), useNativeDriver: ND }),
        ]),
      ]).start(({ finished }) => {
        if (!finished) return;
        expandedRef.current = true;
        enterBook(id);
      });
    }
    const focusTimer = setTimeout(() => titleRef.current?.focus?.(), reduced ? 200 : 600);
    return () => clearTimeout(focusTimer);
  }, [open, fly, flip, fade, edges, expand, leaves, reduced, stopAll, enterBook]);

  useEffect(() => stopAll, [stopAll]);

  // 从书里回到书架：有「已走进」的书就把它合上放回原位
  useFocusEffect(
    React.useCallback(() => {
      if (enteredRef.current) closeBook();
    }, [closeBook]),
  );

  // 翻书过程中的关闭触发：Android 返回键 / web Escape（走进书内后交给书内的返回逻辑）
  useEffect(() => {
    if (!open || entered) return;
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
  }, [open, entered, closeBook]);

  // 首次来到书架：一步导览
  useEffect(() => {
    if (!hydrated || !onboarded || shelfTourSeen !== false) return;
    const tmr = setTimeout(() => openTutorial('shelf'), 900);
    return () => clearTimeout(tmr);
  }, [hydrated, onboarded, shelfTourSeen]);

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
          label: '翻开这本日记本',
          icon: FolderOpen,
          onPress: () => openBook({ id: nb.id, name: nb.name, color: nb.color }),
        },
        { label: '重命名或更换颜色', icon: Edit3, onPress: () => openEdit(nb) },
        ...(notebooks.findIndex(x => x.id === nb.id) > 0 ? [{ label: '向前移一格', icon: ArrowLeft, onPress: () => moveBy(nb.id, -1) }] : []),
        ...(notebooks.findIndex(x => x.id === nb.id) < notebooks.length - 1 ? [{ label: '向后移一格', icon: ArrowRight, onPress: () => moveBy(nb.id, 1) }] : []),
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

  const [dragId, setDragId] = useState('');
  const lastDragEnd = useRef(0);
  const scrollRef = useAnimatedRef<Reanimated.ScrollView>();
  const scrollY = useScrollViewOffset(scrollRef);
  const orderSV = useSharedValue<string[]>([]);
  const dragIdSV = useSharedValue('');
  const scrollDir = useSharedValue(0);
  const containerTop = useSharedValue(0);
  const viewportH = useSharedValue(0);
  const [shelfW, setShelfW] = useState(Math.max(0, contentW - 40));

  const cols = shelfColumns(contentW);
  const tileW = Math.min(TILE_MAX, (shelfW - TILE_GAP * (cols - 1)) / cols);
  const tileH = tileW * 4 / 3;
  const totalSlots = notebooks.length + 2;
  const rowStride = tileH + 8 + 28;
  const shelfRows = Math.ceil(totalSlots / cols);
  const geo = useMemo<ShelfGeo>(() => ({ tileW, tileH, cols, width: shelfW, total: totalSlots, gap: TILE_GAP, rowStride }), [tileW, tileH, cols, shelfW, totalSlots, rowStride]);
  const geoSV = useSharedValue<ShelfGeo>(geo);
  const orderKey = notebooks.map(n => n.id).join('|');
  useEffect(() => {
    geoSV.value = geo;
  }, [geo, geoSV]);
  useEffect(() => {
    if (!dragId) orderSV.value = orderKey ? orderKey.split('|') : [];
  }, [orderKey, dragId, orderSV]);
  useFrameCallback(() => {
    if (scrollDir.value !== 0) scrollTo(scrollRef, 0, Math.max(0, scrollY.value + scrollDir.value * 12), false);
  });
  const dragCtx = useMemo<DragCtx>(() => ({ order: orderSV, dragId: dragIdSV, geo: geoSV, scrollY, scrollDir, containerTop, viewportH }), [orderSV, dragIdSV, geoSV, scrollY, scrollDir, containerTop, viewportH]);

  const liftedRef = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const block = (e: TouchEvent) => {
      if (liftedRef.current && e.cancelable) e.preventDefault();
    };
    document.addEventListener('touchmove', block, { passive: false });
    return () => document.removeEventListener('touchmove', block);
  }, []);
  const finePointer = useMemo(() => Platform.OS === 'web' && typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches, []);

  const onLift = React.useCallback((id: string) => {
    liftedRef.current = true;
    setDragId(id);
    haptic('medium');
  }, []);
  const onDrop = React.useCallback((ids: string[], success: boolean) => {
    liftedRef.current = false;
    setDragId('');
    lastDragEnd.current = Date.now();
    if (!success) return;
    haptic('light');
    if (ids.join('|') !== notebooks.map(n => n.id).join('|')) actions.reorderNotebooks(ids);
    if (!dragHintSeen) actions.setShelfDragHintSeen(true);
  }, [notebooks, dragHintSeen]);
  const moveBy = (id: string, delta: number) => {
    const ids = notebooks.map(n => n.id);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    actions.reorderNotebooks(moveId(ids, from, to));
  };

  const setCoverRef = (key: string) => (el: View | null) => {
    if (el) coverRefs.current.set(key, el);
    else coverRefs.current.delete(key);
  };

  const dx = open ? open.rect.x + open.rect.w / 2 - (target.x + bookW / 2) : 0;
  const dy = open ? open.rect.y + open.rect.h / 2 - (target.y + bookH / 2) : 0;
  const sc = open ? open.rect.w / bookW : 1;
  const flipDeg = flip.interpolate({ inputRange: [0, 165], outputRange: ['0deg', '-165deg'] });
  const coverOpacity = reduced ? 0 : flip.interpolate({ inputRange: [0, 110, 165], outputRange: [1, 1, 0] });
  const edgesOpacity = Animated.multiply(edges, expand.interpolate({ inputRange: [0, 0.35], outputRange: [1, 0], extrapolate: 'clamp' }));

  const overlayNode = (
    <View ref={rootRef} collapsable={false} pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={e => { const { width: w, height: h } = e.nativeEvent.layout; if (w > 0 && h > 0) setBox({ w, h }); }}>
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
                { scale: expand.interpolate({ inputRange: [0, 1], outputRange: [1, fillScale] }) },
              ],
            }}
          >
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: edgesOpacity }]}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: open.color, borderRadius: r(12), transform: [{ translateX: 10 }, { translateY: 10 }] }]} />
              {([['#D3CBBB', 6], ['#DDD6C8', 4], ['#E6E0D4', 2]] as const).map(([col, off]) => (
                <View key={col} style={[StyleSheet.absoluteFill, { backgroundColor: col, borderRadius: r(12), transform: [{ translateX: off }, { translateY: off }] }]} />
              ))}
            </Animated.View>

            <TitlePage fade={expand.interpolate({ inputRange: [0, 0.55], outputRange: [1, 0], extrapolate: 'clamp' })} name={open.name} color={open.color} range={bookInfo.range} count={bookInfo.count} titleRef={titleRef} onClose={closeBook} />

            {!reduced && [0, 1, 2].map(i => (
              <Animated.View
                key={`leaf_${i}`}
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: ['#F7F3EA', '#F3EEE4', '#EFE9DE'][i],
                    borderRadius: r(12),
                    overflow: 'hidden',
                    opacity: leaves[i].interpolate({ inputRange: [0, 0.5, 110, 170], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' }),
                    transform: [
                      { perspective: 1400 },
                      { translateX: -bookW / 2 },
                      { rotateY: leaves[i].interpolate({ inputRange: [0, 170], outputRange: ['0deg', '-170deg'] }) },
                      { translateX: bookW / 2 },
                    ],
                  },
                ]}
              >
                <Animated.View style={[StyleSheet.absoluteFill, { opacity: leaves[i].interpolate({ inputRange: [0, 90, 170], outputRange: [0, 0.25, 0] }) }]}>
                  <LinearGradient colors={['rgba(0,0,0,0.9)', 'rgba(0,0,0,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                </Animated.View>
              </Animated.View>
            ))}

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
    </View>
  );

  const now = new Date();
  const lastBookName = (activeNotebook ? notebooks.find(n => n.id === activeNotebook) : notebooks.find(n => n.id === DEFAULT_NOTEBOOK_ID))?.name ?? '我的日记';
  const writeNotebook = activeNotebook ?? DEFAULT_NOTEBOOK_ID;

  const header = (
    <View style={{ minHeight: 64, paddingHorizontal: 20, paddingTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
        <Text textRole="reading" style={[t.h1, { fontSize: fs(24), fontWeight: '600' }]}>记得</Text>
        <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: fs(12.5), color: c.textSub }}>{`${fmtMonthDay(now.getTime())} ${WEEK_CN[now.getDay()]}`}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <IconButton icon={Search} label="搜索" onPress={() => router.push('/search')} />
        <Pressable accessibilityRole="button" accessibilityLabel="我的" onPress={() => router.push('/me')} hitSlop={4} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Image
            source={photoSource(avatarUri) ?? IMAGES.avatar}
            style={{ width: 36, height: 36, borderRadius: 18, borderWidth: ink.on ? 1.5 : 0, borderColor: ink.line, backgroundColor: c.primarySoft }}
          />
        </Pressable>
      </View>
    </View>
  );

  const footer = (
    <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, alignItems: 'stretch' }}>
      <Button title="写今天" icon={PenLine} onPress={() => router.push({ pathname: '/write', params: { notebook: writeNotebook } })} />
      <Text numberOfLines={1} style={{ fontSize: fs(12), color: c.textSub, textAlign: 'center', marginTop: 6 }}>{`写进「${lastBookName}」`}</Text>
    </View>
  );

  const plankColor = ink.on ? mixHex(c.bgDeep, ink.line, 0.18) : c.border;
  const plankShadow = ink.on ? `0px 4px 0px ${ink.line}` : '0px 6px 10px rgba(0,0,0,0.08)';
  const bookTilt = (i: number) => (i % 2 === 0 ? '-5deg' : '4deg');

  return (
    <Screen edges={['top', 'bottom']} overlay={overlayNode} header={header} footer={footer}>
      <Reanimated.ScrollView
        ref={scrollRef}
        scrollEnabled={!dragId}
        scrollEventThrottle={16}
        onLayout={e => { viewportH.value = e.nativeEvent.layout.height; }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 }}
      >
        <TodayCard />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: notebooks.length >= 2 && !dragHintSeen ? 2 : 12 }}>
          <Text style={[t.h2, { fontSize: fs(16) }]}>我的书架</Text>
          <TextAction label="新建" bold color={c.primaryDark} onPress={openCreate} />
        </View>
        {notebooks.length >= 2 && !dragHintSeen && (
          <Text style={{ fontSize: fs(12), color: c.textMuted, marginBottom: 12 }}>{finePointer ? '拖动书本可以整理书架' : '长按书本拖动整理'}</Text>
        )}
        <View
          ref={booksTarget}
          collapsable={false}
          onLayout={e => {
            containerTop.value = e.nativeEvent.layout.y;
            const w = e.nativeEvent.layout.width;
            if (w > 0 && Math.abs(w - shelfW) > 0.5) setShelfW(w);
          }}
          style={{ height: shelfRows * rowStride, userSelect: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none' } as any}
        >
          {Array.from({ length: shelfRows }, (_, i) => (
            <View key={`plank_${i}`} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: i * rowStride + tileH, height: 8, borderRadius: 3, backgroundColor: plankColor, boxShadow: plankShadow }} />
          ))}
          <ShelfBook
            id={null}
            slot={0}
            geo={geo}
            name="全部日记"
            color={c.primary}
            count={counts.get(null) ?? 0}
            photo={coverPhotos.get(null)}
            tilt="-5deg"
            lastOpened={activeNotebook === null}
            locked={!!dragId}
            lastDragEnd={lastDragEnd}
            coverRef={setCoverRef('__all__')}
            onOpen={() => openBook({ id: null, name: '全部日记', color: c.primary })}
          />
          {notebooks.map((nb, i) => (
            <ShelfBook
              key={nb.id}
              id={nb.id}
              slot={i + 1}
              geo={geo}
              name={nb.name}
              color={nb.color}
              count={counts.get(nb.id) ?? 0}
              photo={coverPhotos.get(nb.id)}
              tilt={bookTilt(i)}
              lastOpened={activeNotebook === nb.id}
              locked={!!dragId}
              lifted={dragId === nb.id}
              reduced={reduced}
              ctx={dragCtx}
              lastDragEnd={lastDragEnd}
              coverRef={setCoverRef(nb.id)}
              onOpen={() => openBook({ id: nb.id, name: nb.name, color: nb.color })}
              onManage={() => onNotebookPress(nb)}
              onLift={onLift}
              onDrop={onDrop}
              onMove={delta => moveBy(nb.id, delta)}
            />
          ))}
          {(() => {
            const p = slotPosition(totalSlots - 1, geo);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="新建日记本"
                onPress={openCreate}
                style={{ position: 'absolute', left: p.x, top: p.y, width: tileW, height: tileH, borderRadius: r(12), borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.textMuted, alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Plus size={22} color={c.textMuted} />
                <Text style={{ fontSize: fs(13), color: c.textMuted }}>新建日记本</Text>
              </Pressable>
            );
          })()}
        </View>
      </Reanimated.ScrollView>

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

/** 翻开后的扉页：纸底 + 书脊条 + 书名、起止年月与篇数 */
function TitlePage({ name, color, range, count, titleRef, onClose, fade }: { fade: Animated.AnimatedInterpolation<number>; name: string; color: string; range: string; count: number; titleRef: any; onClose: () => void }) {
  const { t, r, fs } = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius: r(12), overflow: 'hidden', backgroundColor: '#F7F4EC' }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
      <ExpoImage source={PAPER_IMAGES['paper-white'] as any} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={120} pointerEvents="none" />
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 12, backgroundColor: mixHex(color, '#000000', 0.18), borderTopLeftRadius: r(12), borderBottomLeftRadius: r(12) }} />
      <View style={{ position: 'absolute', left: 12, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(0,0,0,0.08)' }} />
      <View style={{ position: 'absolute', left: 13, top: 0, bottom: 0, width: 8, backgroundColor: 'rgba(0,0,0,0.025)' }} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="合上日记本"
        onPress={onClose}
        hitSlop={8}
        style={{ position: 'absolute', top: 10, right: 10, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <X size={18} color={PAGE_SUB} />
      </Pressable>

      <View style={{ flex: 1, paddingLeft: 36, paddingRight: 24, alignItems: 'center', justifyContent: 'center' }}>
        <Text ref={titleRef} tabIndex={0} textRole="reading" numberOfLines={2} style={[t.h1, { fontSize: fs(26), color: PAGE_TEXT, textAlign: 'center' }]}>{name}</Text>
        <View style={{ width: 36, height: 1.5, backgroundColor: 'rgba(0,0,0,0.2)', marginVertical: 14 }} />
        {!!range && <Text style={{ fontSize: fs(13), color: PAGE_SUB, textAlign: 'center' }}>{range}</Text>}
        {count > 0 && <Text style={{ fontSize: fs(13), color: PAGE_SUB, marginTop: 4 }}>{`共 ${count} 篇`}</Text>}
        <Illustration name="memorySticker" size={72} style={{ marginTop: 22 }} />
      </View>
      </Animated.View>
    </View>
  );
}


interface DragCtx {
  order: SharedValue<string[]>;
  dragId: SharedValue<string>;
  geo: SharedValue<ShelfGeo>;
  scrollY: SharedValue<number>;
  scrollDir: SharedValue<number>;
  containerTop: SharedValue<number>;
  viewportH: SharedValue<number>;
}

interface ShelfBookProps {
  id: string | null;
  slot: number;
  geo: ShelfGeo;
  name: string;
  color: string;
  count: number;
  photo?: string;
  tilt: string;
  lastOpened: boolean;
  locked: boolean;
  lifted?: boolean;
  reduced?: boolean;
  ctx?: DragCtx;
  lastDragEnd: React.MutableRefObject<number>;
  coverRef: (el: View | null) => void;
  onOpen: () => void;
  onManage?: () => void;
  onLift?: (id: string) => void;
  onDrop?: (ids: string[], success: boolean) => void;
  onMove?: (delta: number) => void;
}

const SETTLE = { damping: 18, stiffness: 220 };

/** 书架上的一本书：「全部日记」固定不动，其余可长按拖动换位（UI 线程驱动） */
function ShelfBook(props: ShelfBookProps) {
  const { id, slot, geo, name, color, count, photo, tilt, lastOpened, locked, lifted, reduced, ctx, lastDragEnd, coverRef, onOpen, onManage, onLift, onDrop, onMove } = props;
  const { c, r, ink } = useTheme();
  const init = slotPosition(slot, geo);
  const open = () => {
    if (locked || Date.now() - lastDragEnd.current < 400) return;
    onOpen();
  };

  const body = (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`日记本 ${name}，${count} 篇，点按翻开`}
        accessibilityActions={onMove ? [{ name: 'moveForward', label: '向前移一格' }, { name: 'moveBackward', label: '向后移一格' }] : undefined}
        onAccessibilityAction={e => {
          if (e.nativeEvent.actionName === 'moveForward') onMove?.(-1);
          else if (e.nativeEvent.actionName === 'moveBackward') onMove?.(1);
        }}
        onPress={open}
      >
        <View ref={coverRef} collapsable={false}>
          <BookCover color={color} name={name} count={count} photo={photo} photoTilt={tilt} />
        </View>
        {lastOpened && <BookRibbon color={c.primary} />}
      </Pressable>
      {onManage && !lifted && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`管理${name}`}
          disabled={locked}
          onPress={onManage}
          hitSlop={8}
          style={{ position: 'absolute', top: 0, right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,253,248,0.9)', alignItems: 'center', justifyContent: 'center' }}>
            <MoreHorizontal size={15} color="#3A4148" />
          </View>
        </Pressable>
      )}
    </>
  );

  if (!ctx || id === null) {
    return <View style={{ position: 'absolute', left: init.x, top: init.y, width: geo.tileW }}>{body}</View>;
  }
  return <DraggableBook {...{ id, init, geo, ctx, reduced: !!reduced, color, lastDragEnd, onLift, onDrop }}>{body}</DraggableBook>;
}

function DraggableBook({ id, init, geo, ctx, reduced, color, onLift, onDrop, children }: {
  id: string;
  init: { x: number; y: number };
  geo: ShelfGeo;
  ctx: DragCtx;
  reduced: boolean;
  color: string;
  lastDragEnd: React.MutableRefObject<number>;
  onLift?: (id: string) => void;
  onDrop?: (ids: string[], success: boolean) => void;
  children: React.ReactNode;
}) {
  const { r, ink } = useTheme();
  const { order, dragId, geo: geoSV, scrollY, scrollDir, containerTop, viewportH } = ctx;
  const sx = useSharedValue(init.x);
  const sy = useSharedValue(init.y);
  const active = useSharedValue(0);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScroll = useSharedValue(0);
  const startOrder = useSharedValue<string[]>([]);
  const scale = useSharedValue(1);
  const rot = useSharedValue(0);
  const lift = useSharedValue(0);

  const hover = () => {
    'worklet';
    const g = geoSV.value;
    const n = order.value.length;
    const cx = startX.value + dx.value + g.tileW / 2;
    const cy = startY.value + dy.value + (scrollY.value - startScroll.value) + g.tileH / 2;
    const target = nearestSlot(cx, cy, 1, n, g);
    const cur = order.value.indexOf(id) + 1;
    if (target !== cur) order.value = moveId(order.value, cur - 1, target - 1);
    const vy = containerTop.value + cy - scrollY.value;
    scrollDir.value = vy < 60 ? -1 : vy > viewportH.value - 60 ? 1 : 0;
  };

  useAnimatedReaction(
    () => ({ s: order.value.indexOf(id) + 1, g: geoSV.value }),
    (cur, prev) => {
      if (active.value || cur.s <= 0) return;
      const p = slotPosition(cur.s, cur.g);
      // 只有「换了格子」才用弹簧让位；尺寸变化（回到书架、窗口缩放）直接就位，不让整排书晃动
      if (!prev || prev.s === cur.s) {
        sx.value = p.x;
        sy.value = p.y;
        return;
      }
      sx.value = reduced ? withTiming(p.x, { duration: 120 }) : withSpring(p.x, SETTLE);
      sy.value = reduced ? withTiming(p.y, { duration: 120 }) : withSpring(p.y, SETTLE);
    },
    [id, reduced],
  );
  useAnimatedReaction(
    () => scrollY.value,
    () => {
      if (active.value) hover();
    },
  );

  const downX = useSharedValue(0);
  const downY = useSharedValue(0);

  const pan = useMemo(() => {
    const wire = (g: ReturnType<typeof Gesture.Pan>) =>
      g
        .onStart(() => {
          'worklet';
          startX.value = sx.value;
          startY.value = sy.value;
          startScroll.value = scrollY.value;
          startOrder.value = order.value;
          dx.value = 0;
          dy.value = 0;
          active.value = 1;
          dragId.value = id;
          if (!reduced) {
            scale.value = withSpring(1.08);
            rot.value = withSpring(-3);
            lift.value = withTiming(1, { duration: 140 });
          }
          if (onLift) runOnJS(onLift)(id);
        })
        .onUpdate(e => {
          'worklet';
          dx.value = e.translationX;
          dy.value = e.translationY;
          if (!reduced) {
            const vx = e.velocityX;
            rot.value = withSpring(Math.abs(vx) > 40 ? Math.max(-8, Math.min(8, vx * 0.004)) : -3, { damping: 14, stiffness: 160 });
          }
          hover();
        })
        .onFinalize((_e, success) => {
          'worklet';
          if (!active.value) return;
          scrollDir.value = 0;
          if (!success) order.value = startOrder.value;
          const p = slotPosition(order.value.indexOf(id) + 1, geoSV.value);
          sx.value = startX.value + dx.value;
          sy.value = startY.value + dy.value + (scrollY.value - startScroll.value);
          active.value = 0;
          dragId.value = '';
          sx.value = reduced ? withTiming(p.x, { duration: 120 }) : withSpring(p.x, SETTLE);
          sy.value = reduced ? withTiming(p.y, { duration: 120 }) : withSpring(p.y, SETTLE);
          scale.value = reduced ? 1 : withSequence(withTiming(0.98, { duration: 110 }), withTiming(1, { duration: 110 }));
          rot.value = reduced ? 0 : withSpring(0, SETTLE);
          lift.value = withTiming(0, { duration: 200 });
          if (onDrop) runOnJS(onDrop)(order.value.slice(), success);
        });

    // 鼠标：按下后移动 ≥ 6px 立即开始拖动；其余指针（触摸 / 触控笔）：长按 250ms 抬起
    const mouse = wire(
      Gesture.Pan()
        .manualActivation(true)
        .onTouchesDown((e, sm) => {
          'worklet';
          if (e.pointerType !== PointerType.MOUSE) {
            sm.fail();
            return;
          }
          downX.value = e.allTouches[0]?.absoluteX ?? 0;
          downY.value = e.allTouches[0]?.absoluteY ?? 0;
        })
        .onTouchesMove((e, sm) => {
          'worklet';
          const t = e.allTouches[0];
          if (!t) return;
          if (Math.hypot(t.absoluteX - downX.value, t.absoluteY - downY.value) >= 6) sm.activate();
        }),
    );
    const touch = wire(
      Gesture.Pan()
        .activateAfterLongPress(250)
        .onTouchesDown((e, sm) => {
          'worklet';
          if (e.pointerType === PointerType.MOUSE) sm.fail();
        }),
    );
    return Gesture.Race(mouse, touch);
  }, [id, reduced, onLift, onDrop]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: active.value ? startX.value + dx.value : sx.value },
      { translateY: active.value ? startY.value + dy.value + (scrollY.value - startScroll.value) : sy.value },
      { rotate: `${rot.value}deg` },
      { scale: scale.value },
    ],
    zIndex: active.value ? 50 : 0,
  }));
  const shadowStyle = useAnimatedStyle(() => ({ opacity: lift.value }));

  return (
    <GestureDetector gesture={pan} touchAction="pan-y">
      <Reanimated.View style={[{ position: 'absolute', left: 0, top: 0, width: geo.tileW }, style]}>
        <Reanimated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              backgroundColor: color,
              borderTopLeftRadius: r(6),
              borderBottomLeftRadius: r(6),
              borderTopRightRadius: r(12),
              borderBottomRightRadius: r(12),
              boxShadow: ink.on ? `0px 8px 0px ${ink.line}` : '0px 14px 24px rgba(0,0,0,0.22)',
            } as any,
            shadowStyle,
          ]}
        />
        {children}
      </Reanimated.View>
    </GestureDetector>
  );
}
