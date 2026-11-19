import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, FlatList, Platform, Pressable, RefreshControl, ScrollView,
  type StyleProp, StyleSheet, Text, View, type ViewStyle,
} from 'react-native';
import { router, useNavigation } from 'expo-router';
import {
  AudioLines, BookOpen, Camera, ChevronDown, CloudOff, FileText, FolderInput, Heart,
  Image as ImageIcon, LayoutGrid, LayoutTemplate, List, Lock, Mic, PenLine, Pin,
  Plus, Search, Trash2, Video,
} from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions, inNotebook, openTutorial, useHydrated, useStore } from '../../src/store/store';
import { Chip, EmptyState, IconButton, Screen, UnderlineTabs, haptic } from '../../src/components/ui';
import { EntryGridCard, EntryListCard } from '../../src/components/EntryCard';
import { SwipeRow, closeOpenSwipeRow, type SwipeAction } from '../../src/components/SwipeRow';
import { TodayCard } from '../../src/components/TodayCard';
import { animateNextLayout, BottomSheet, ND, PressableScale, SPRING } from '../../src/components/motion';
import { setTourHandler, useTourTarget } from '../../src/components/tour';
import { HomeSkeleton } from '../../src/components/Skeleton';
import { MoodIcon } from '../../src/components/MoodIcon';
import { useFeedback } from '../../src/components/feedback';
import { IMAGES } from '../../src/data/assets';
import { MOODS } from '../../src/data/constants';
import { isDictationSupported } from '../../src/utils/dictation';
import { groupEntriesByDate } from '../../src/utils/grouping';
import type { Entry, MoodKey } from '../../src/store/types';

type SubTab = 'all' | 'diary' | 'draft' | 'favorite' | 'pinned';
type FlatListRow =
  | { type: 'header'; key: string; title: string; count: number }
  | { type: 'entry'; key: string; entry: Entry; index: number; first: boolean; last: boolean };

const USE_NATIVE = ND;

function AnimatedEntrance({ index, style, children }: { index: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(index < 10 ? 0 : 1)).current;

  useEffect(() => {
    if (index >= 10) return;
    const tmr = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 240,
        useNativeDriver: USE_NATIVE,
      }).start();
    }, Math.min(index, 9) * 30);
    return () => clearTimeout(tmr);
  }, [anim, index]);

  if (index >= 10) return <>{children}</>;

  return (
    <Animated.View
      style={[
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** 9-11. 首页（列表分组虚拟化 / 左滑撤销 / 日记本切换 / 写作目标 / 快捷入口） */
export default function HomeScreen() {
  const { c, t, fs, dark } = useTheme();
  const { toast, sheet } = useFeedback();
  const hydrated = useHydrated();
  const entries = useStore(s => s.entries);
  const tags = useStore(s => s.tags);
  const notebooks = useStore(s => s.notebooks);
  const activeNotebook = useStore(s => s.activeNotebook);
  const account = useStore(s => s.account);
  const homeView = useStore(s => s.appearance.homeView);
  const onboarded = useStore(s => s.onboarded);
  const tutorialSeen = useStore(s => s.tutorialSeen);

  // 首次进入首页：等启动页淡出后再开始导览
  useEffect(() => {
    if (onboarded && tutorialSeen === false) {
      const tmr = setTimeout(() => openTutorial('home'), 700);
      return () => clearTimeout(tmr);
    }
  }, [onboarded, tutorialSeen]);

  const [tab, setTab] = useState<SubTab>('all');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterMood, setFilterMood] = useState<MoodKey | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [fabMounted, setFabMounted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // 听写只在真正支持的环境里给入口（Expo Go / 不支持的原生构建不显示）
  const dictationSupported = useMemo(() => isDictationSupported(), []);

  const navigation = useNavigation();
  const listRef = useRef<FlatList<any>>(null);
  const titleTarget = useTourTarget('home.title');
  const toolsTarget = useTourTarget('home.tools');
  const fabTarget = useTourTarget('home.fab');

  const scrollToTop = useCallback((animated = true) => {
    listRef.current?.scrollToOffset({ offset: 0, animated });
  }, []);

  // 再点一次「日记」标签：回到列表顶部
  useEffect(() => {
    const unsub = (navigation as any).addListener?.('tabPress', () => {
      if (navigation.isFocused()) scrollToTop(true);
    });
    return unsub;
  }, [navigation, scrollToTop]);

  // 导览开始前：收起菜单、回到顶部，保证聚光灯对准的控件都在屏幕里
  useEffect(() => {
    setTourHandler('home.prepare', () => {
      setFabOpen(false);
      setDropOpen(false);
      closeOpenSwipeRow();
      scrollToTop(false);
    });
    return () => setTourHandler('home.prepare', null);
  }, [scrollToTop]);

  // 快捷新建菜单：弹簧展开，收起时先播完动画再卸载
  const fabAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (fabOpen) {
      setFabMounted(true);
      Animated.spring(fabAnim, { toValue: 1, useNativeDriver: USE_NATIVE, ...SPRING.pop }).start();
    } else {
      Animated.timing(fabAnim, { toValue: 0, duration: 160, useNativeDriver: USE_NATIVE }).start(({ finished }) => {
        if (finished) setFabMounted(false);
      });
    }
  }, [fabOpen, fabAnim]);

  const currentNotebook = useMemo(
    () => (activeNotebook ? notebooks.find(n => n.id === activeNotebook) : undefined),
    [notebooks, activeNotebook],
  );

  const aliveEntries = useMemo(() => entries.filter(e => !e.deletedAt && !e.hidden), [entries]);
  const notebookEntries = useMemo(
    () => aliveEntries.filter(e => inNotebook(e, activeNotebook)),
    [aliveEntries, activeNotebook],
  );
  const draftCount = useMemo(
    () => notebookEntries.filter(e => e.status === 'draft').length,
    [notebookEntries],
  );

  const filtered = useMemo(() => {
    let list: Entry[] = notebookEntries;
    if (tab === 'diary') list = list.filter(e => e.status === 'published');
    else if (tab === 'draft') list = list.filter(e => e.status === 'draft');
    else if (tab === 'favorite') list = list.filter(e => e.favorite);
    else if (tab === 'pinned') list = list.filter(e => e.pinned);
    else list = list.filter(e => e.status === 'published');

    if (filterTag) list = list.filter(e => e.tags.includes(filterTag));
    if (filterMood) list = list.filter(e => e.mood === filterMood);

    return [...list].sort((a, b) => {
      if (tab !== 'draft' && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt - a.createdAt;
    });
  }, [notebookEntries, tab, filterTag, filterMood]);

  const listRows = useMemo<FlatListRow[]>(() => {
    const groups = groupEntriesByDate(filtered, Date.now(), tab !== 'draft');
    const out: FlatListRow[] = [];
    let idx = 0;
    for (const g of groups) {
      out.push({ type: 'header', key: `hdr_${g.key}`, title: g.title, count: g.entries.length });
      g.entries.forEach((e, i) => {
        out.push({ type: 'entry', key: e.id, entry: e, index: idx++, first: i === 0, last: i === g.entries.length - 1 });
      });
    }
    return out;
  }, [filtered, tab]);

  const notebookCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const nb of notebooks) {
      counts.set(nb.id, aliveEntries.filter(e => inNotebook(e, nb.id)).length);
    }
    return counts;
  }, [notebooks, aliveEntries]);

  const toggleView = useCallback(() => {
    haptic('light');
    actions.setAppearance({ homeView: homeView === 'list' ? 'card' : 'list' });
  }, [homeView]);

  const openEntry = useCallback((e: Entry) => {
    if (e.status === 'draft') router.push({ pathname: '/write', params: { id: e.id } });
    else router.push({ pathname: '/memory/[id]', params: { id: e.id } });
  }, []);

  const trashWithUndo = useCallback(
    (entry: Entry) => {
      animateNextLayout();
      actions.trashEntry(entry.id);
      toast('已移入最近删除', {
        type: 'info',
        action: {
          label: '撤销',
          onPress: () => {
            animateNextLayout();
            actions.restoreEntry(entry.id);
            toast('已恢复该日记');
          },
        },
      });
    },
    [toast],
  );

  const openNotebookPickerForEntry = useCallback(
    (entry: Entry) => {
      sheet(
        notebooks.map(nb => ({
          label: nb.name + (inNotebook(entry, nb.id) ? '（当前）' : ''),
          icon: FolderInput,
          onPress: () => {
            actions.moveToNotebook([entry.id], nb.id);
            toast(`已移动到「${nb.name}」`);
          },
        })),
        '移动到日记本',
      );
    },
    [notebooks, sheet, toast],
  );

  const openEntrySheet = useCallback(
    (entry: Entry) => {
      haptic('medium');
      sheet(
        [
          {
            label: entry.pinned ? '取消置顶' : '置顶日记',
            icon: Pin,
            onPress: () => {
              const next = actions.togglePinned(entry.id);
              toast(next ? '已置顶到首页' : '已取消置顶');
            },
          },
          {
            label: entry.favorite ? '取消收藏' : '添加到收藏',
            icon: Heart,
            onPress: () => {
              const next = actions.toggleFavorite(entry.id);
              toast(next ? '已添加到我的收藏' : '已取消收藏');
            },
          },
          {
            label: '移动到日记本',
            icon: FolderInput,
            onPress: () => openNotebookPickerForEntry(entry),
          },
          {
            label: '删除日记',
            icon: Trash2,
            destructive: true,
            onPress: () => trashWithUndo(entry),
          },
        ],
        entry.title || '操作日记',
      );
    },
    [openNotebookPickerForEntry, sheet, toast, trashWithUndo],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (account) {
        const res = await actions.syncNow();
        if (!res.ok) toast(res.message || '同步失败', { type: 'warning' });
        else if (res.conflicts > 0) toast(`发现 ${res.conflicts} 条同步冲突`, { type: 'warning', action: { label: '去处理', onPress: () => router.push('/sync-conflict') } });
        else toast('已与云端同步');
      } else {
        await new Promise(r => setTimeout(r, 350));
        toast('已是最新');
      }
    } finally {
      setRefreshing(false);
    }
  }, [account, toast]);

  const loadSamples = useCallback(() => {
    actions.importSamples();
    toast('已导入示例日记', { message: '你可以自由浏览、编辑或随时删除它们' });
  }, [toast]);

  const activeFilterLabel = useMemo(() => {
    const parts: string[] = [];
    if (filterTag) parts.push(`#${tags.find(x => x.id === filterTag)?.name ?? filterTag}`);
    if (filterMood) parts.push(MOODS.find(x => x.key === filterMood)?.label ?? filterMood);
    return parts.join(' · ');
  }, [filterTag, filterMood, tags]);

  const showToday = (tab === 'all' || tab === 'diary') && !filterTag && !filterMood;
  const listHeader = useMemo(() => {
    return (
      <View>
        {showToday && <TodayCard />}

        {homeView === 'card' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: fs(13), color: c.textSub, fontWeight: '500' }}>
              {tab === 'draft' ? '未完成草稿' : tab === 'favorite' ? '收藏瞬间' : tab === 'pinned' ? '置顶记录' : '最近记录'}
            </Text>
            <Text style={{ fontSize: fs(12), color: c.textMuted }}>共 {filtered.length} 篇</Text>
          </View>
        )}
      </View>
    );
  }, [showToday, tab, c, fs, homeView, filtered.length]);

  const makeSwipeActions = useCallback(
    (entry: Entry): SwipeAction[] => [
      {
        key: 'pin',
        label: entry.pinned ? '取消置顶' : '置顶',
        icon: Pin,
        color: c.primaryDark,
        onPress: () => {
          const next = actions.togglePinned(entry.id);
          toast(next ? '已置顶到首页' : '已取消置顶');
        },
      },
      {
        key: 'fav',
        label: entry.favorite ? '取消收藏' : '收藏',
        icon: Heart,
        color: c.warning,
        onPress: () => {
          const next = actions.toggleFavorite(entry.id);
          toast(next ? '已添加到我的收藏' : '已取消收藏');
        },
      },
      {
        key: 'del',
        label: '删除',
        icon: Trash2,
        color: c.danger,
        onPress: () => trashWithUndo(entry),
      },
    ],
    [c.primaryDark, c.warning, c.danger, toast, trashWithUndo],
  );

  const renderListRow = useCallback(
    ({ item }: { item: FlatListRow }) => {
      if (item.type === 'header') {
        // 设计稿1 #9：分组标题用衬线小标题，与卡片拉开层级
        return (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 10, marginBottom: 10, paddingHorizontal: 2 }}>
            <Text style={[t.h3, { fontSize: fs(15.5) }]}>{item.title}</Text>
            <Text style={{ fontSize: fs(11.5), color: c.textMuted }}>{item.count} 篇</Text>
          </View>
        );
      }
      // 同一组日记共用一张卡片：只在组首组尾画圆角，外层统一投一层阴影
      return (
        <AnimatedEntrance index={item.index}>
          <View
            style={{
              marginBottom: item.last ? 18 : 0,
              backgroundColor: c.card,
              borderTopLeftRadius: item.first ? 18 : 0,
              borderTopRightRadius: item.first ? 18 : 0,
              borderBottomLeftRadius: item.last ? 18 : 0,
              borderBottomRightRadius: item.last ? 18 : 0,
              borderLeftWidth: dark ? 0 : StyleSheet.hairlineWidth,
              borderRightWidth: dark ? 0 : StyleSheet.hairlineWidth,
              borderTopWidth: dark || !item.first ? 0 : StyleSheet.hairlineWidth,
              borderBottomWidth: dark || !item.last ? 0 : StyleSheet.hairlineWidth,
              borderColor: c.divider,
              ...(item.last && !dark
                ? { shadowColor: c.shadow, shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 1 }
                : {}),
            }}
          >
            <SwipeRow actions={makeSwipeActions(item.entry)} radius={item.first && item.last ? 18 : 0}>
              <EntryListCard
                entry={item.entry}
                grouped={{ first: item.first, last: item.last }}
                onPress={() => openEntry(item.entry)}
                onLongPress={() => openEntrySheet(item.entry)}
              />
            </SwipeRow>
          </View>
        </AnimatedEntrance>
      );
    },
    [c.card, c.divider, c.shadow, c.textMuted, dark, fs, t.h3, makeSwipeActions, openEntry, openEntrySheet],
  );

  const renderGridItem = useCallback(
    ({ item, index }: { item: Entry; index: number }) => (
      <View style={{ width: '48.2%', flexDirection: 'row' }}>
        <AnimatedEntrance index={index} style={{ flex: 1, minWidth: 0, flexDirection: 'row' }}>
          <EntryGridCard
            entry={item}
            onPress={() => openEntry(item)}
            onLongPress={() => openEntrySheet(item)}
          />
        </AnimatedEntrance>
      </View>
    ),
    [openEntry, openEntrySheet],
  );

  return (
    <Screen edges={['top']}>
      {/* 顶部栏 */}
      <View style={{ height: 52, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          ref={titleTarget}
          collapsable={false}
          onPress={() => {
            haptic('light');
            setDropOpen(true);
          }}
          hitSlop={10}
          accessibilityLabel="日记本与筛选"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 }}
        >
          {currentNotebook && (
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: currentNotebook.color }} />
          )}
          <Text style={[t.h1, { fontSize: fs(22), flexShrink: 1 }]} numberOfLines={1}>
            {currentNotebook ? currentNotebook.name : '记得日记'}
          </Text>
          <ChevronDown size={18} color={c.textSub} />
        </Pressable>

        <View ref={toolsTarget} collapsable={false} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <IconButton icon={Search} label="搜索" onPress={() => router.push('/search')} />
          <IconButton
            icon={homeView === 'list' ? LayoutGrid : List}
            label="切换视图"
            onPress={toggleView}
          />
        </View>
      </View>

      {/* 二级分类栏（全部 / 日记 / 草稿 / 收藏 / 置顶） */}
      <View style={{ paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.divider }}>
        <UnderlineTabs
          value={tab}
          onChange={setTab}
          items={[
            { key: 'all', label: '全部' },
            { key: 'diary', label: '日记' },
            { key: 'draft', label: '草稿', count: draftCount || undefined },
            { key: 'favorite', label: '收藏' },
            { key: 'pinned', label: '置顶' },
          ]}
        />
      </View>

      {!!activeFilterLabel && (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, gap: 8 }}>
          <Text style={{ fontSize: fs(12), color: c.textSub }}>筛选条件：</Text>
          <Chip
            size="sm"
            selected
            label={activeFilterLabel}
            onRemove={() => {
              setFilterTag(null);
              setFilterMood(null);
            }}
          />
        </View>
      )}

      {/* 主内容 */}
      {!hydrated ? (
        <HomeSkeleton />
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 40 }}>
          <EmptyState
            image={IMAGES.emptyBook}
            imageSize={185}
            title={tab === 'all' || tab === 'diary' ? '还没有任何日记' : '这里暂时空空的'}
            desc={
              tab === 'draft'
                ? '写到一半不想丢失的想法，会自动存放在草稿箱里。'
                : tab === 'favorite'
                  ? '遇到特别珍贵的句子，可以在详情页点击收藏。'
                  : tab === 'pinned'
                    ? '把重要的日记置顶，它会一直留在这里等你。'
                    : '写下第一篇日记，开始记录属于你的生活吧。'
            }
            action="写一篇日记"
            onAction={() => router.push('/write')}
            secondary={
              activeNotebook
                ? '查看全部日记本'
                : entries.length === 0
                  ? '加载示例日记体验'
                  : undefined
            }
            onSecondary={
              activeNotebook
                ? () => actions.setActiveNotebook(null)
                : entries.length === 0
                  ? loadSamples
                  : undefined
            }
          />
        </View>
      ) : homeView === 'list' ? (
        <FlatList
          ref={listRef}
          key="list"
          onScrollBeginDrag={closeOpenSwipeRow}
          data={listRows}
          keyExtractor={item => item.key}
          renderItem={renderListRow}
          ListHeaderComponent={listHeader}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 96 }}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== 'web'}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={c.primary} colors={[c.primary]} />}
        />
      ) : (
        <FlatList
          ref={listRef}
          key="grid"
          data={filtered}
          numColumns={2}
          keyExtractor={item => item.id}
          renderItem={renderGridItem}
          ListHeaderComponent={listHeader}
          columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 12 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 96 }}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== 'web'}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={c.primary} colors={[c.primary]} />}
        />
      )}

      {/* 悬浮写作按钮 & 5 项快捷新建菜单 */}
      {fabMounted && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { zIndex: 20, backgroundColor: dark ? 'rgba(0,0,0,0.4)' : 'rgba(47,42,38,0.16)', opacity: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }) },
          ]}
        >
          <Pressable style={{ flex: 1 }} onPress={() => setFabOpen(false)} accessibilityLabel="收起新建菜单" />
          <Animated.View
            style={{
              position: 'absolute',
              right: 20,
              bottom: 86,
              width: 158,
              backgroundColor: c.card,
              borderRadius: 16,
              paddingVertical: 6,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: c.divider,
              shadowColor: c.shadow,
              shadowOpacity: 0.16,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
              transformOrigin: 'right bottom',
              transform: [
                { scale: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) },
                { translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
              ],
            }}
          >
            {[
              { label: '写日记', icon: PenLine, onPress: () => router.push('/write') },
              { label: '用模板', icon: LayoutTemplate, onPress: () => router.push('/templates') },
              { label: '录音记录', icon: Mic, onPress: () => router.push({ pathname: '/write', params: { action: 'audio' } }) },
              { label: '拍照记录', icon: Camera, onPress: () => router.push({ pathname: '/write', params: { action: 'photo' } }) },
              { label: '拍视频', icon: Video, onPress: () => router.push({ pathname: '/write', params: { action: 'video' } }) },
              ...(dictationSupported
                ? [{ label: '语音听写', icon: AudioLines, onPress: () => router.push({ pathname: '/write', params: { action: 'dictate' } }) }]
                : []),
              { label: '视频记录', icon: Video, onPress: () => router.push({ pathname: '/write', params: { action: 'video' } }) },
            ].map((item, idx) => (
              <Pressable
                key={item.label}
                onPress={() => {
                  haptic('light');
                  setFabOpen(false);
                  item.onPress();
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0,
                  borderTopColor: c.divider,
                  backgroundColor: pressed ? c.cardAlt : 'transparent',
                })}
              >
                <item.icon size={17} color={c.primaryDark} strokeWidth={1.7} />
                <Text style={{ fontSize: fs(14), color: c.text }}>{item.label}</Text>
              </Pressable>
            ))}
          </Animated.View>
        </Animated.View>
      )}

      <View ref={fabTarget} collapsable={false} style={{ position: 'absolute', right: 20, bottom: 20, zIndex: 25 }}>
        <PressableScale
          scaleTo={0.9}
          onPress={() => {
            haptic('medium');
            setFabOpen(v => !v);
          }}
          accessibilityLabel={fabOpen ? '收起新建菜单' : '新建日记'}
          style={{
            width: 54,
            height: 54,
            borderRadius: 27,
            backgroundColor: c.primary,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: c.primaryDark,
            shadowOpacity: 0.32,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 5 },
            elevation: 5,
          }}
        >
          <Animated.View style={{ transform: [{ rotate: fabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }}>
            <Plus size={26} color="#fff" strokeWidth={2.2} />
          </Animated.View>
        </PressableScale>
      </View>

      {/* 顶部标题下拉面板：日记本切换 + 内容空间 + 筛选 */}
      <BottomSheet visible={dropOpen} onClose={() => setDropOpen(false)} title="日记本与筛选" maxHeight={0.82}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 6, paddingBottom: 8 }}>
          {/* 日记本切换区 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: fs(12.5), color: c.textSub }}>我的日记本</Text>
            <Pressable
              hitSlop={8}
              onPress={() => {
                setDropOpen(false);
                router.push('/notebooks');
              }}
            >
              <Text style={{ fontSize: fs(12.5), color: c.primaryDark, fontWeight: '500' }}>管理 ›</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
            <Pressable
              onPress={() => {
                haptic('light');
                actions.setActiveNotebook(null);
                setDropOpen(false);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: activeNotebook === null ? c.primaryFaint : c.card,
                borderWidth: 1,
                borderColor: activeNotebook === null ? c.primary : c.divider,
              }}
            >
              <BookOpen size={14} color={activeNotebook === null ? c.primaryDark : c.textSub} />
              <Text style={{ fontSize: fs(13), color: activeNotebook === null ? c.primaryDark : c.text, fontWeight: activeNotebook === null ? '600' : '400' }}>
                全部 ({aliveEntries.length})
              </Text>
            </Pressable>
            {notebooks.map(nb => {
              const active = activeNotebook === nb.id;
              return (
                <Pressable
                  key={nb.id}
                  onPress={() => {
                    haptic('light');
                    actions.setActiveNotebook(nb.id);
                    setDropOpen(false);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 12,
                    backgroundColor: active ? c.primaryFaint : c.card,
                    borderWidth: 1,
                    borderColor: active ? c.primary : c.divider,
                  }}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: nb.color }} />
                  <Text style={{ fontSize: fs(13), color: active ? c.primaryDark : c.text, fontWeight: active ? '600' : '400' }}>
                    {nb.name} ({notebookCounts.get(nb.id) ?? 0})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={{ fontSize: fs(12.5), color: c.textSub, marginBottom: 8 }}>内容空间</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
            {[
              { label: '草稿箱', icon: FileText, path: '/drafts' as const },
              { label: '我的收藏', icon: Heart, path: '/favorites' as const },
              { label: '影像记忆', icon: ImageIcon, path: '/photos' as const },
              { label: '最近删除', icon: Trash2, path: '/trash' as const },
              { label: '隐藏日记', icon: Lock, path: '/hidden' as const },
              { label: '离线状态', icon: CloudOff, path: '/offline' as const },
            ].map(item => (
              <PressableScale
                key={item.label}
                onPress={() => {
                  setDropOpen(false);
                  router.push(item.path);
                }}
                style={{ width: '31%', backgroundColor: c.card, borderRadius: 14, paddingVertical: 12, alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }}
              >
                <item.icon size={18} color={c.primaryDark} strokeWidth={1.7} />
                <Text style={{ fontSize: fs(12), color: c.text }}>{item.label}</Text>
              </PressableScale>
            ))}
          </View>

          <Text style={{ fontSize: fs(12.5), color: c.textSub, marginBottom: 8 }}>按心情筛选</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {MOODS.map(m => (
              <Chip
                key={m.key}
                label={m.label}
                icon={<MoodIcon mood={m.key} size={15} />}
                selected={filterMood === m.key}
                onPress={() => {
                  setFilterMood(cur => (cur === m.key ? null : m.key));
                  setDropOpen(false);
                }}
              />
            ))}
          </View>

          <Text style={{ fontSize: fs(12.5), color: c.textSub, marginBottom: 8 }}>按标签筛选</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {tags.map(tg => (
              <Chip
                key={tg.id}
                label={`#${tg.name}`}
                selected={filterTag === tg.id}
                onPress={() => {
                  setFilterTag(cur => (cur === tg.id ? null : tg.id));
                  setDropOpen(false);
                }}
              />
            ))}
          </View>
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}
